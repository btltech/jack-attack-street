// dice-app/api.ts - Street Dice daily leaderboard client (Cloudflare D1, scores verified by the Worker).
import { ROOMS_API_BASE, getGuestId } from '../core/online';
import type { RoundChoice } from '../core/diceEngine';

export interface DiceEntry {
  rank: number;
  playerId: string; // one-way hash of the guest id; see getMyPlayerId in core/dailyLeaderboard.ts
  name: string;
  score: number;
  rolls: number;
}

export interface DiceBoard {
  day: string;
  total: number;
  entries: DiceEntry[];
}

export interface DiceSubmitResult extends DiceBoard {
  ok: boolean;
  score: number;
  rank: number;
}

export const fetchDiceBoard = async (day: string): Promise<DiceBoard> => {
  const res = await fetch(`${ROOMS_API_BASE}/api/dice/${encodeURIComponent(day)}/leaderboard`);
  if (!res.ok) throw new Error('Could not load the leaderboard');
  return (await res.json()) as DiceBoard;
};

export const submitDiceGame = async (day: string, name: string, rounds: RoundChoice[]): Promise<DiceSubmitResult> => {
  const res = await fetch(`${ROOMS_API_BASE}/api/dice/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ day, guestId: getGuestId(), name: name.trim() || 'Player', rounds }),
  });
  if (!res.ok) throw new Error('Could not submit the game');
  return (await res.json()) as DiceSubmitResult;
};
