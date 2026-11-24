// worker/src/index.ts - Cloudflare Worker + Durable Object for Jack Attack Street online rooms
import { DurableObject } from 'cloudflare:workers';
import {
  RoomData, ClientMsg, ServerMsg,
  newRoom, join, disconnect, start, act, tick, view, cleanName,
} from '../../core/roomEngine';
import {
  AyoState, AyoRuleSet, createAyoGame, applyAyoMove, getLegalMoves,
} from '../../ayo-app/engine';

export interface Env {
  ROOMS: DurableObjectNamespace<GameRoom>;
  AYO_ROOMS: DurableObjectNamespace<AyoRoom>;
  DB: D1Database;
}

const getUtcDay = (): string => new Date().toISOString().slice(0, 10);
const isValidDay = (d: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(d);

// The raw guest ID doubles as the player's secret (it is the key for score updates and room seats),
// so never send it to other clients. Leaderboard rows carry a one-way hash instead; the client
// computes the same hash of its own ID to highlight "You" (see core/dailyLeaderboard.ts).
const publicPlayerId = async (guestId: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(guestId));
  return Array.from(new Uint8Array(digest).slice(0, 8), b => b.toString(16).padStart(2, '0')).join('');
};

// Scores may only be filed for today or the neighbouring UTC day (clock skew around midnight).
const isAcceptableDay = (d: string): boolean => {
  const t = Date.parse(`${d}T00:00:00Z`);
  const today = Date.parse(`${getUtcDay()}T00:00:00Z`);
  return Number.isFinite(t) && Math.abs(t - today) <= 86_400_000;
};

// --- Usage events (anonymous; see core/analytics.ts). Keep in sync with AnalyticsEvent there. ---
const ALLOWED_EVENTS = new Set([
  'app_open', 'game_start', 'game_end', 'daily_start', 'daily_win', 'share',
  'tutorial_start', 'tutorial_step', 'tutorial_done', 'tutorial_skip',
]);
const ALLOWED_GAMES = new Set(['jack', 'ayo', 'site']);

// Created on first use so deploying needs no manual migration (worker/schema.sql documents it).
let eventsTableReady = false;
const ensureEventsTable = async (db: D1Database): Promise<void> => {
  if (eventsTableReady) return;
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS events (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         day TEXT NOT NULL, ts INTEGER NOT NULL, anon TEXT NOT NULL, game TEXT NOT NULL,
         event TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', cohort TEXT NOT NULL
       )`
    ),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_events_day ON events (day, event)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_events_anon ON events (anon, day)'),
  ]);
  eventsTableReady = true;
};

interface DailyScoreRow {
  guest_id: string;
  name: string;
  duration_ms: number;
  cards_played: number;
}

const fetchTopScores = async (db: D1Database, day: string) => {
  const { results } = await db
    .prepare(
      'SELECT guest_id, name, duration_ms, cards_played FROM daily_scores WHERE day = ? ORDER BY duration_ms ASC, cards_played ASC, created_at ASC LIMIT 20'
    )
    .bind(day)
    .all<DailyScoreRow>();

  const countRow = await db
    .prepare('SELECT COUNT(*) as total FROM daily_scores WHERE day = ?')
    .bind(day)
    .first<{ total: number }>();

  return {
    day,
    total: Number(countRow?.total ?? 0),
    entries: await Promise.all((results || []).map(async (row, i) => ({
      rank: i + 1,
      playerId: await publicPlayerId(row.guest_id),
      name: row.name,
      durationMs: row.duration_ms,
      cardsPlayed: row.cards_played,
    }))),
  };
};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const generateRoomCode = (): string => {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
};

// Only these browser origins may call the API. Requests with no Origin header
// (curl, health checks, server-to-server) are unaffected by CORS.
const ALLOWED_ORIGINS = new Set([
  'https://jackattackstreets.com',
  'https://www.jackattackstreets.com',
  'https://btltech.github.io',
]);

const isAllowedOrigin = (origin: string | null): origin is string => {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Local development (vite dev server / preview / wrangler dev)
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
};

const corsHeaders = (origin: string | null): Record<string, string> => {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
  if (isAllowedOrigin(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
};

const jsonResponse = (body: unknown, status = 200, origin: string | null = null): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === '/api/health') {
      return jsonResponse({ ok: true, service: 'jack-attack-rooms' }, 200, origin);
    }

    // Create a new room code
    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      const code = generateRoomCode();
      return jsonResponse({ code }, 200, origin);
    }

    // Daily Challenge Leaderboard: GET /api/daily/:day/leaderboard (or /api/daily/leaderboard)
    const lbMatch = url.pathname.match(/^\/api\/daily(?:\/(\d{4}-\d{2}-\d{2}))?\/leaderboard$/);
    if (lbMatch && request.method === 'GET') {
      const day = lbMatch[1] || getUtcDay();
      if (!isValidDay(day)) return jsonResponse({ error: 'Invalid day' }, 400, origin);
      const data = await fetchTopScores(env.DB, day);
      return jsonResponse(data, 200, origin);
    }

    // Submit Daily Challenge score: POST /api/daily/score
    if (url.pathname === '/api/daily/score' && request.method === 'POST') {
      let body: { day?: string; guestId?: string; name?: string; durationMs?: number; cardsPlayed?: number };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return jsonResponse({ error: 'Invalid JSON' }, 400, origin);
      }

      if (!body || typeof body !== 'object') return jsonResponse({ error: 'Invalid JSON' }, 400, origin);
      const day = body.day && isValidDay(body.day) ? body.day : getUtcDay();
      if (!isAcceptableDay(day)) return jsonResponse({ error: 'Invalid day' }, 400, origin);
      const guestId = String(body.guestId || '').trim().slice(0, 64);
      const name = cleanName(body.name);
      const durationMs = Math.floor(Number(body.durationMs));
      const cardsPlayed = Math.floor(Number(body.cardsPlayed));

      if (!guestId) return jsonResponse({ error: 'Missing guestId' }, 400, origin);
      if (!Number.isFinite(durationMs) || durationMs < 2000 || durationMs > 3600000) {
        return jsonResponse({ error: 'Invalid durationMs' }, 400, origin);
      }
      if (!Number.isFinite(cardsPlayed) || cardsPlayed < 1 || cardsPlayed > 300) {
        return jsonResponse({ error: 'Invalid cardsPlayed' }, 400, origin);
      }

      const existing = await env.DB
        .prepare('SELECT duration_ms, cards_played FROM daily_scores WHERE day = ? AND guest_id = ?')
        .bind(day, guestId)
        .first<{ duration_ms: number; cards_played: number }>();

      const improved = !existing || durationMs < existing.duration_ms ||
        (durationMs === existing.duration_ms && cardsPlayed < existing.cards_played);

      if (improved) {
        await env.DB
          .prepare(
            `INSERT INTO daily_scores (day, guest_id, name, duration_ms, cards_played, created_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(day, guest_id) DO UPDATE SET
               name = excluded.name,
               duration_ms = excluded.duration_ms,
               cards_played = excluded.cards_played,
               created_at = excluded.created_at`
          )
          .bind(day, guestId, name, durationMs, cardsPlayed, Date.now())
          .run();
      } else {
        // Still update nickname if changed
        await env.DB
          .prepare('UPDATE daily_scores SET name = ? WHERE day = ? AND guest_id = ?')
          .bind(name, day, guestId)
          .run();
      }

      const bestDuration = improved ? durationMs : existing!.duration_ms;
      const bestCards = improved ? cardsPlayed : existing!.cards_played;

      const betterCount = await env.DB
        .prepare(
          'SELECT COUNT(*) as c FROM daily_scores WHERE day = ? AND (duration_ms < ? OR (duration_ms = ? AND cards_played < ?))'
        )
        .bind(day, bestDuration, bestDuration, bestCards)
        .first<{ c: number }>();

      const board = await fetchTopScores(env.DB, day);
      return jsonResponse({
        ok: true,
        improved,
        rank: Number(betterCount?.c ?? 0) + 1,
        bestDurationMs: bestDuration,
        ...board,
      }, 200, origin);
    }

    // Anonymous usage events (see core/analytics.ts). Sent as text/plain so sendBeacon needs no preflight.
    if (url.pathname === '/api/event' && request.method === 'POST') {
      // Browsers from other websites are refused; non-browser callers (no Origin) are accepted but validated.
      if (origin && !isAllowedOrigin(origin)) return new Response(null, { status: 403 });
      const raw = (await request.text()).slice(0, 1024);
      let body: { event?: unknown; game?: unknown; detail?: unknown; anon?: unknown; cohort?: unknown };
      try {
        body = JSON.parse(raw);
      } catch {
        return new Response(null, { status: 204 });
      }
      if (!body || typeof body !== 'object') return new Response(null, { status: 204 });
      const event = String(body.event ?? '');
      const game = String(body.game ?? '');
      const anon = String(body.anon ?? '').slice(0, 64);
      const cohort = String(body.cohort ?? '');
      const detail = String(body.detail ?? '').replace(/[^\w .:+-]/g, '').slice(0, 32);
      if (!ALLOWED_EVENTS.has(event) || !ALLOWED_GAMES.has(game) || anon.length < 8 || !isValidDay(cohort)) {
        return new Response(null, { status: 204 });
      }
      try {
        await ensureEventsTable(env.DB);
        await env.DB
          .prepare('INSERT INTO events (day, ts, anon, game, event, detail, cohort) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(getUtcDay(), Date.now(), anon, game, event, detail, cohort)
          .run();
      } catch {
        // Analytics must never produce errors for players.
      }
      return new Response(null, { status: 204 });
    }

    // Browsers always send Origin on WebSocket upgrades: refuse other websites. Non-browser
    // clients (no Origin header) are still allowed.
    if (/\/ws$/.test(url.pathname) && origin && !isAllowedOrigin(origin)) {
      return jsonResponse({ error: 'Origin not allowed' }, 403, origin);
    }

    // Create a new Ayò 1v1 room code
    if (url.pathname === '/api/ayo/rooms' && request.method === 'POST') {
      const code = generateRoomCode();
      return jsonResponse({ code }, 200, origin);
    }

    // WebSocket connection to an Ayò 1v1 room: /api/ayo/rooms/:code/ws
    const ayoWsMatch = url.pathname.match(/^\/api\/ayo\/rooms\/([A-Za-z0-9]{4,6})\/ws$/);
    if (ayoWsMatch) {
      const code = ayoWsMatch[1].toUpperCase();
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return jsonResponse({ error: 'Expected WebSocket upgrade' }, 426, origin);
      }
      const id = env.AYO_ROOMS.idFromName(code);
      const stub = env.AYO_ROOMS.get(id);
      const forwardUrl = new URL(request.url);
      forwardUrl.searchParams.set('code', code);
      return stub.fetch(new Request(forwardUrl.toString(), request));
    }

    // WebSocket connection to a room: /api/rooms/:code/ws
    const wsMatch = url.pathname.match(/^\/api\/rooms\/([A-Za-z0-9]{4,6})\/ws$/);
    if (wsMatch) {
      const code = wsMatch[1].toUpperCase();
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return jsonResponse({ error: 'Expected WebSocket upgrade' }, 426, origin);
      }
      const id = env.ROOMS.idFromName(code);
      const stub = env.ROOMS.get(id);
      const forwardUrl = new URL(request.url);
      forwardUrl.searchParams.set('code', code);
      return stub.fetch(new Request(forwardUrl.toString(), request));
    }

    return jsonResponse({ error: 'Not found' }, 404, origin);
  },
};

interface SocketAttachment {
  id: string | null;
}

export class GameRoom extends DurableObject<Env> {
  private room: RoomData | null = null;

  private async loadRoom(code?: string): Promise<RoomData> {
    if (this.room) return this.room;
    const stored = await this.ctx.storage.get<RoomData>('room');
    if (stored) {
      this.room = stored;
      return stored;
    }
    const created = newRoom(code || 'ROOM', Date.now());
    this.room = created;
    await this.ctx.storage.put('room', created);
    return created;
  }

  private async persistAndSchedule(): Promise<void> {
    if (!this.room) return;
    await this.ctx.storage.put('room', this.room);
    if (this.room.phase === 'playing' && this.room.deadline > 0) {
      await this.ctx.storage.setAlarm(Math.max(Date.now() + 50, this.room.deadline));
    } else {
      await this.ctx.storage.deleteAlarm();
    }
  }

  private send(ws: WebSocket, msg: ServerMsg): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // Socket already closed
    }
  }

  private broadcastState(): void {
    if (!this.room) return;
    const now = Date.now();
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as SocketAttachment | null;
      if (!att?.id) continue;
      this.send(ws, { t: 'state', view: view(this.room, att.id), now });
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const code = (url.searchParams.get('code') || 'ROOM').toUpperCase();
    await this.loadRoom(code);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: null } satisfies SocketAttachment);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const room = await this.loadRoom();
    let msg: ClientMsg;
    try {
      const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
      msg = JSON.parse(text) as ClientMsg;
    } catch {
      this.send(ws, { t: 'error', error: 'Invalid message' });
      return;
    }
    if (!msg || typeof msg !== 'object') {
      this.send(ws, { t: 'error', error: 'Invalid message' });
      return;
    }

    if (msg.t === 'ping') {
      this.send(ws, { t: 'pong' });
      return;
    }

    const now = Date.now();
    const att = (ws.deserializeAttachment() as SocketAttachment | null) || { id: null };

    if (msg.t === 'join') {
      const guestId = String(msg.id || '').trim().slice(0, 64);
      if (!guestId) {
        this.send(ws, { t: 'error', error: 'Missing player ID' });
        return;
      }

      // Close any older socket for the same guestId in this room
      for (const other of this.ctx.getWebSockets()) {
        if (other === ws) continue;
        const otherAtt = other.deserializeAttachment() as SocketAttachment | null;
        if (otherAtt?.id === guestId) {
          other.serializeAttachment({ id: null } satisfies SocketAttachment);
          try { other.close(1000, 'Replaced by new connection'); } catch {}
        }
      }

      const res = join(room, guestId, msg.name);
      if (!res.ok) {
        this.send(ws, { t: 'error', error: res.error });
        return;
      }

      ws.serializeAttachment({ id: guestId } satisfies SocketAttachment);
      await this.persistAndSchedule();
      this.broadcastState();
      return;
    }

    if (!att.id) {
      this.send(ws, { t: 'error', error: 'Join the room first' });
      return;
    }

    if (msg.t === 'start') {
      const res = start(room, att.id, msg.size, msg.difficulty, now);
      if (!res.ok) {
        this.send(ws, { t: 'error', error: res.error });
        return;
      }
      await this.persistAndSchedule();
      this.broadcastState();
      return;
    }

    if (msg.t === 'react') {
      const allowed = ['😂', '😱', '🔥', '💀', '👑', '👏', 'NOOO!'];
      const emoji = allowed.includes(msg.emoji) ? msg.emoji : null;
      const seatIdx = room.seats.findIndex(s => !s.isBot && s.id === att.id);
      if (emoji && seatIdx >= 0) {
        for (const sock of this.ctx.getWebSockets()) {
          this.send(sock, { t: 'react', seat: seatIdx, emoji });
        }
      }
      return;
    }

    const res = act(room, att.id, msg, now);
    if (!res.ok) {
      this.send(ws, { t: 'error', error: res.error });
      return;
    }

    if (res.peek) {
      this.send(ws, { t: 'peek', card: res.peek.card, seat: res.peek.seat });
    }
    await this.persistAndSchedule();
    this.broadcastState();
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.handleDisconnect(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.handleDisconnect(ws);
  }

  private async handleDisconnect(ws: WebSocket): Promise<void> {
    const att = ws.deserializeAttachment() as SocketAttachment | null;
    if (!att?.id) return;
    const room = await this.loadRoom();

    // Check if another active socket already owns this guestId
    const stillConnected = this.ctx.getWebSockets().some(other => {
      if (other === ws) return false;
      const otherAtt = other.deserializeAttachment() as SocketAttachment | null;
      return otherAtt?.id === att.id;
    });
    if (stillConnected) return;

    disconnect(room, att.id);
    // If it's currently this disconnected human's turn, shorten deadline to AWAY_MS
    if (room.phase === 'playing' && room.game) {
      const curSeat = room.seats[room.game.currentPlayerIndex];
      if (curSeat && curSeat.id === att.id) {
        room.deadline = Math.min(room.deadline, Date.now() + 2500);
      }
    }

    await this.persistAndSchedule();
    this.broadcastState();
  }

  async alarm(): Promise<void> {
    const room = await this.loadRoom();
    const now = Date.now();
    const changed = tick(room, now);
    if (changed) {
      await this.persistAndSchedule();
      this.broadcastState();
    } else if (room.phase === 'playing' && room.deadline > now) {
      await this.ctx.storage.setAlarm(room.deadline);
    }
  }
}

// --- AYÒ ỌLỌ́PỌ́N 1v1 DURABLE OBJECT ---
interface AyoRoomData {
  code: string;
  phase: 'lobby' | 'playing' | 'over';
  seats: Array<{ id: string; name: string; connected: boolean }>;
  wins: Record<string, number>;
  game: AyoState | null;
}

export class AyoRoom extends DurableObject<Env> {
  private room: AyoRoomData | null = null;

  private async loadRoom(code?: string): Promise<AyoRoomData> {
    if (this.room) return this.room;
    const stored = await this.ctx.storage.get<AyoRoomData>('ayo_room');
    if (stored) {
      this.room = stored;
      return stored;
    }
    const created: AyoRoomData = { code: code || 'AYO', phase: 'lobby', seats: [], wins: {}, game: null };
    this.room = created;
    await this.ctx.storage.put('ayo_room', created);
    return created;
  }

  private send(ws: WebSocket, msg: unknown): void {
    try { ws.send(JSON.stringify(msg)); } catch {}
  }

  private broadcast(): void {
    if (!this.room) return;
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as SocketAttachment | null;
      if (!att?.id) continue;
      const you = this.room.seats.findIndex(s => s.id === att.id);
      this.send(ws, {
        t: 'state',
        view: {
          code: this.room.code,
          phase: this.room.phase,
          you,
          seats: this.room.seats.map(s => ({
            name: s.name,
            connected: s.connected,
            wins: this.room!.wins[s.id] ?? 0,
          })),
          game: this.room.game,
        },
      });
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const code = (url.searchParams.get('code') || 'AYO').toUpperCase();
    await this.loadRoom(code);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: null } satisfies SocketAttachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const room = await this.loadRoom();
    let msg: { t: string; id?: string; name?: string; pit?: number; ruleSet?: AyoRuleSet; emoji?: string };
    try {
      const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'ping') { this.send(ws, { t: 'pong' }); return; }

    const att = (ws.deserializeAttachment() as SocketAttachment | null) || { id: null };

    if (msg.t === 'join') {
      const guestId = String(msg.id || '').trim().slice(0, 64);
      if (!guestId) return;
      for (const other of this.ctx.getWebSockets()) {
        if (other === ws) continue;
        const oAtt = other.deserializeAttachment() as SocketAttachment | null;
        if (oAtt?.id === guestId) {
          other.serializeAttachment({ id: null } satisfies SocketAttachment);
          try { other.close(1000, 'Replaced'); } catch {}
        }
      }
      const existing = room.seats.findIndex(s => s.id === guestId);
      if (existing >= 0) {
        room.seats[existing].connected = true;
        if (room.phase !== 'playing') room.seats[existing].name = cleanName(msg.name);
      } else {
        if (room.seats.length >= 2) {
          this.send(ws, { t: 'error', error: 'Room is full (2 players max)' });
          return;
        }
        room.seats.push({ id: guestId, name: cleanName(msg.name), connected: true });
      }
      ws.serializeAttachment({ id: guestId } satisfies SocketAttachment);
      await this.ctx.storage.put('ayo_room', room);
      this.broadcast();
      return;
    }

    if (!att.id) return;
    const seatIdx = room.seats.findIndex(s => s.id === att.id);
    if (seatIdx < 0) return;

    if (msg.t === 'react') {
      const allowed = ['👏', '🔥', '😱', '😂', '👑', 'E kú iṣẹ́!'];
      if (msg.emoji && allowed.includes(msg.emoji)) {
        for (const s of this.ctx.getWebSockets()) this.send(s, { t: 'react', seat: seatIdx, emoji: msg.emoji });
      }
      return;
    }

    if (msg.t === 'start') {
      if (seatIdx !== 0) { this.send(ws, { t: 'error', error: 'Only the host can start' }); return; }
      if (room.seats.length < 2) { this.send(ws, { t: 'error', error: 'Wait for a friend to join!' }); return; }
      const ruleSet: AyoRuleSet =
        msg.ruleSet === 'oware' || msg.ruleSet === 'street_ayo' ? msg.ruleSet : 'yoruba_ayo';
      room.game = createAyoGame(ruleSet);
      room.game.lastAction = `${room.seats[0].name}'s turn to sow!`;
      room.phase = 'playing';
      await this.ctx.storage.put('ayo_room', room);
      this.broadcast();
      return;
    }

    if (msg.t === 'move' && room.phase === 'playing' && room.game) {
      if (room.game.turn !== seatIdx) { this.send(ws, { t: 'error', error: 'Not your turn' }); return; }
      const pit = Math.floor(Number(msg.pit));
      if (!getLegalMoves(room.game).includes(pit)) {
        this.send(ws, { t: 'error', error: 'Illegal pit' });
        return;
      }
      const names: [string, string] = [room.seats[0]?.name || 'South', room.seats[1]?.name || 'North'];
      const { nextState } = applyAyoMove(room.game, pit, names);
      room.game = nextState;
      if (nextState.winner !== null) {
        room.phase = 'over';
        if (nextState.winner === 0 || nextState.winner === 1) {
          const winSeat = room.seats[nextState.winner];
          if (winSeat) room.wins[winSeat.id] = (room.wins[winSeat.id] || 0) + 1;
        }
      }
      await this.ctx.storage.put('ayo_room', room);
      this.broadcast();
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const att = ws.deserializeAttachment() as SocketAttachment | null;
    if (!att?.id) return;
    const room = await this.loadRoom();
    const still = this.ctx.getWebSockets().some(o => o !== ws && (o.deserializeAttachment() as SocketAttachment | null)?.id === att.id);
    if (still) return;
    const idx = room.seats.findIndex(s => s.id === att.id);
    if (idx >= 0) {
      if (room.phase === 'lobby') room.seats.splice(idx, 1);
      else room.seats[idx].connected = false;
      await this.ctx.storage.put('ayo_room', room);
      this.broadcast();
    }
  }
}
