// worker/src/index.ts - Cloudflare Worker + Durable Object for Jack Attack Street online rooms
import { DurableObject } from 'cloudflare:workers';
import {
  RoomData, ClientMsg, ServerMsg,
  newRoom, join, disconnect, start, act, tick, view, cleanName,
} from '../../core/roomEngine';

export interface Env {
  ROOMS: DurableObjectNamespace<GameRoom>;
  DB: D1Database;
}

const getUtcDay = (): string => new Date().toISOString().slice(0, 10);
const isValidDay = (d: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(d);

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
    entries: (results || []).map((row, i) => ({
      rank: i + 1,
      guestId: row.guest_id,
      name: row.name,
      durationMs: row.duration_ms,
      cardsPlayed: row.cards_played,
    })),
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

const corsHeaders = (origin: string | null): Record<string, string> => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Vary': 'Origin',
});

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

      const day = body.day && isValidDay(body.day) ? body.day : getUtcDay();
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
