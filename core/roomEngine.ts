// core/roomEngine.ts - Pure, server-authoritative room logic for online play.
// No Cloudflare dependencies here so it can be unit-tested in Node.
import type { Card, GameState } from './types';
import { Suit, Difficulty, GameMode } from './types';
import {
  createNewGame, isValidMove, playCard, drawCard, chooseSuit, swapWith,
  clearPeek, getBotDecision, botChooseSuit, botChooseSwap,
} from './game';

export type Phase = 'lobby' | 'playing' | 'over';

export interface Seat {
  id: string;        // guest id (humans) or 'bot-N'
  name: string;
  isBot: boolean;
  connected: boolean;
}

export interface RoomData {
  code: string;
  phase: Phase;
  seats: Seat[];     // humans first (seat 0 = host), then bots once started
  game: GameState | null;
  deadline: number;  // epoch ms when the current seat will be auto-played
  createdAt: number;
}

export const MAX_SEATS = 4;
export const TURN_MS = 30000;
export const BOT_MS = 1300;
export const AWAY_MS = 2500;

// ---- Client <-> server protocol ----
export type ClientMsg =
  | { t: 'join'; id: string; name: string }
  | { t: 'start'; size?: number; difficulty?: string }
  | { t: 'play'; cardId: string }
  | { t: 'draw' }
  | { t: 'suit'; suit: string }
  | { t: 'swap'; seat: number }
  | { t: 'ping' };

export interface SeatView {
  name: string;
  isBot: boolean;
  connected: boolean;
  avatar: string;
  handCount: number;
}

export interface GameView {
  hand: Card[];
  top: Card;
  deckCount: number;
  pendingPickup: number;
  chosenSuit: Suit | null;
  direction: 1 | -1;
  current: number;
  pendingSuitChoice: boolean;
  pendingSwap: boolean;
  lastAction: string;
  winner: number | null;
  deadline: number;
}

export interface View {
  code: string;
  phase: Phase;
  you: number;
  seats: SeatView[];
  game: GameView | null;
}

export type ServerMsg =
  | { t: 'state'; view: View; now: number }
  | { t: 'peek'; card: Card; seat: number }
  | { t: 'error'; error: string }
  | { t: 'pong' };

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export const newRoom = (code: string, now: number): RoomData => ({
  code, phase: 'lobby', seats: [], game: null, deadline: 0, createdAt: now,
});

export const cleanName = (n: unknown): string => {
  const s = String(n ?? '').replace(/[^\p{L}\p{N} _\-.']/gu, '').trim().slice(0, 16);
  return s || 'Player';
};

const seatIndexOf = (room: RoomData, id: string): number =>
  room.seats.findIndex(s => !s.isBot && s.id === id);

// ---- Lobby ----
export const join = (room: RoomData, id: string, name: unknown): Result<{ seat: number }> => {
  const existing = seatIndexOf(room, id);
  if (existing >= 0) {
    room.seats[existing].connected = true;
    if (room.phase !== 'playing') room.seats[existing].name = cleanName(name);
    return { ok: true, seat: existing };
  }
  if (room.phase === 'playing') return fail('Game already in progress');
  if (room.phase === 'over') {
    // New human joins after a finished game: drop bots, keep humans.
    room.seats = room.seats.filter(s => !s.isBot);
  }
  if (room.seats.length >= MAX_SEATS) return fail('Room is full');
  room.seats.push({ id, name: cleanName(name), isBot: false, connected: true });
  return { ok: true, seat: room.seats.length - 1 };
};

export const disconnect = (room: RoomData, id: string): void => {
  const idx = seatIndexOf(room, id);
  if (idx < 0) return;
  if (room.phase === 'lobby') {
    room.seats.splice(idx, 1);
  } else {
    room.seats[idx].connected = false;
  }
};

export const start = (
  room: RoomData, id: string, size: number | undefined, difficulty: string | undefined, now: number,
): Result => {
  if (room.phase === 'playing') return fail('Game already started');
  if (room.seats.length === 0 || room.seats[0].id !== id) return fail('Only the host can start');

  const humans = room.seats.filter(s => !s.isBot && s.connected);
  if (humans.length === 0) return fail('No players');

  const total = Math.min(MAX_SEATS, Math.max(humans.length, 2, Math.floor(Number(size) || 2)));
  const diff = Object.values(Difficulty).includes(difficulty as Difficulty)
    ? (difficulty as Difficulty) : Difficulty.Medium;

  const seats: Seat[] = [...humans];
  let b = 1;
  while (seats.length < total) {
    seats.push({ id: `bot-${b}`, name: `Bot ${b}`, isBot: true, connected: true });
    b++;
  }
  room.seats = seats;

  const game = createNewGame(total, diff, GameMode.LocalMultiplayer);
  game.showPassScreen = false;
  game.players.forEach((p, i) => {
    p.name = seats[i].name;
    p.isBot = seats[i].isBot;
    p.id = `seat-${i}`;
  });
  game.lastAction = `${seats[0].name} started the game!`;
  room.game = game;
  room.phase = 'playing';
  setDeadline(room, now);
  return { ok: true };
};

// ---- Turn flow ----
export const setDeadline = (room: RoomData, now: number): void => {
  if (room.phase !== 'playing' || !room.game) { room.deadline = 0; return; }
  const seat = room.seats[room.game.currentPlayerIndex];
  room.deadline = now + (seat.isBot ? BOT_MS : seat.connected ? TURN_MS : AWAY_MS);
};

const finish = (room: RoomData, now: number): void => {
  if (room.game?.winnerId) {
    room.phase = 'over';
    room.deadline = 0;
  } else {
    setDeadline(room, now);
  }
};

const topCard = (g: GameState): Card => g.discardPile[g.discardPile.length - 1];

export const act = (
  room: RoomData, id: string, msg: ClientMsg, now: number,
): Result<{ peek?: { card: Card; seat: number } }> => {
  const seat = seatIndexOf(room, id);
  if (room.phase !== 'playing' || !room.game || seat < 0) return fail('Not in a game');
  let g = room.game;
  if (g.currentPlayerIndex !== seat) return fail('Not your turn');
  const choosing = g.pendingSuitChoice || g.pendingSwap;

  switch (msg.t) {
    case 'play': {
      if (choosing) return fail('Finish your power card first');
      const card = g.players[seat].hand.find(c => c.id === msg.cardId);
      if (!card) return fail('Card not in your hand');
      if (!isValidMove(card, topCard(g), g.pendingPickup, g.chosenSuit)) return fail('Illegal move');
      g = playCard(g, card.id);
      break;
    }
    case 'draw':
      if (choosing) return fail('Finish your power card first');
      g = drawCard(g);
      break;
    case 'suit':
      if (!g.pendingSuitChoice) return fail('No suit to choose');
      if (!Object.values(Suit).includes(msg.suit as Suit)) return fail('Bad suit');
      g = chooseSuit(g, msg.suit as Suit);
      break;
    case 'swap': {
      if (!g.pendingSwap) return fail('No swap pending');
      const t = Math.floor(Number(msg.seat));
      if (!(t >= 0 && t < g.players.length) || t === seat) return fail('Bad swap target');
      g = swapWith(g, g.players[t].id);
      break;
    }
    default:
      return fail('Unknown action');
  }

  // Peeks are private to the player who played the 7.
  let peek: { card: Card; seat: number } | undefined;
  if (g.peekingCard) {
    peek = { card: g.peekingCard, seat: g.players.findIndex(p => p.id === g.peekingPlayerId) };
    g = clearPeek(g);
  }
  room.game = g;
  finish(room, now);
  return { ok: true, peek };
};

// Bots and timed-out/disconnected humans are driven by the same logic.
export const autoStep = (room: RoomData, now: number): void => {
  if (room.phase !== 'playing' || !room.game) return;
  let g = room.game;
  if (g.pendingSuitChoice) {
    g = botChooseSuit(g);
  } else if (g.pendingSwap) {
    g = botChooseSwap(g);
  } else {
    const d = getBotDecision(g);
    g = d.action === 'play' && d.cardId ? playCard(g, d.cardId) : drawCard(g);
  }
  if (g.peekingCard) g = clearPeek(g);
  room.game = g;
  finish(room, now);
};

export const tick = (room: RoomData, now: number): boolean => {
  if (room.phase !== 'playing' || !room.game || room.deadline <= 0 || now < room.deadline) return false;
  autoStep(room, now);
  return true;
};

// ---- Per-player sanitized view (never leaks other hands) ----
export const view = (room: RoomData, id: string): View => {
  const you = seatIndexOf(room, id);
  const g = room.game;
  return {
    code: room.code,
    phase: room.phase,
    you,
    seats: room.seats.map((s, i) => ({
      name: s.name,
      isBot: s.isBot,
      connected: s.connected,
      avatar: g ? g.players[i]?.avatar ?? '' : '',
      handCount: g ? g.players[i]?.hand.length ?? 0 : 0,
    })),
    game: g ? {
      hand: you >= 0 ? g.players[you].hand : [],
      top: topCard(g),
      deckCount: g.deck.length,
      pendingPickup: g.pendingPickup,
      chosenSuit: g.chosenSuit,
      direction: g.direction,
      current: g.currentPlayerIndex,
      pendingSuitChoice: g.pendingSuitChoice,
      pendingSwap: g.pendingSwap,
      lastAction: g.lastAction,
      winner: g.winnerId ? g.players.findIndex(p => p.id === g.winnerId) : null,
      deadline: room.deadline,
    } : null,
  };
};
