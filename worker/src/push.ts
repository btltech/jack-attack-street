// worker/src/push.ts - Streak reminders over Web Push (RFC 8030 + VAPID, RFC 8292).
//
// Design: pushes carry NO payload, so there is nothing to encrypt and no subscriber keys to store.
// When one arrives, the service worker (public/sw.js) asks POST /api/push/message what to show, and
// this module answers from the streak state the app last synced. Subscriptions are therefore just
// (endpoint, preferred UTC hour, per-game streak + last win day).

export interface PushEnv {
  DB: D1Database;
  /** Public VAPID key, base64url of the 65-byte uncompressed P-256 point (also compiled into the app). */
  VAPID_PUBLIC_KEY?: string;
  /** Private VAPID key as a JWK JSON string: `wrangler secret put VAPID_PRIVATE_JWK`. */
  VAPID_PRIVATE_JWK?: string;
  /** Comma-separated extra push-service hosts, for local testing only. */
  PUSH_EXTRA_HOSTS?: string;
}

type Game = 'jack' | 'ayo' | 'dice';
const GAMES: Game[] = ['jack', 'ayo', 'dice'];
const DAY_MS = 86_400_000;
const MAX_PER_RUN = 40; // stay well inside the Workers subrequest limit; the 10-minute cron picks up the rest

const utcDay = (now = Date.now()): string => new Date(now).toISOString().slice(0, 10);
const shiftDay = (day: string, delta: number): string => utcDay(Date.parse(`${day}T00:00:00Z`) + delta * DAY_MS);
const isDay = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

// Only real browser push services: stops the Worker being used to POST to arbitrary URLs.
const PUSH_HOST_SUFFIXES = ['.push.services.mozilla.com', '.push.apple.com', '.notify.windows.com'];
const PUSH_HOSTS = new Set(['fcm.googleapis.com', 'android.googleapis.com']);

export const isAllowedPushEndpoint = (endpoint: string, extraHosts?: string): boolean => {
  if (endpoint.length > 700) return false;
  let u: URL;
  try {
    u = new URL(endpoint);
  } catch {
    return false;
  }
  const extra = (extraHosts || '').split(',').map((h) => h.trim()).filter(Boolean);
  if (extra.includes(u.host)) return true; // test hosts may be plain http
  if (u.protocol !== 'https:') return false;
  return PUSH_HOSTS.has(u.hostname) || PUSH_HOST_SUFFIXES.some((s) => u.hostname.endsWith(s));
};

// ---- storage ----

let tableReady = false;
const ensureTable = async (db: D1Database): Promise<void> => {
  if (tableReady) return;
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS push_subs (
         endpoint TEXT PRIMARY KEY,
         hour_utc INTEGER NOT NULL DEFAULT 18,
         streak_jack INTEGER NOT NULL DEFAULT 0, win_jack TEXT,
         streak_ayo INTEGER NOT NULL DEFAULT 0, win_ayo TEXT,
         last_sent_day TEXT,
         created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
       )`
    ),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_push_subs_hour ON push_subs (hour_utc, last_sent_day)'),
  ]);
  // Street Dice was added after the table existed: add its columns once (fails harmlessly if already there).
  for (const col of ['ALTER TABLE push_subs ADD COLUMN streak_dice INTEGER NOT NULL DEFAULT 0', 'ALTER TABLE push_subs ADD COLUMN win_dice TEXT']) {
    try { await db.prepare(col).run(); } catch { /* column already exists */ }
  }
  tableReady = true;
};

interface SubRow {
  endpoint: string;
  hour_utc: number;
  streak_jack: number; win_jack: string | null;
  streak_ayo: number; win_ayo: string | null;
  streak_dice: number | null; win_dice: string | null;
  last_sent_day: string | null;
}

const clampInt = (v: unknown, lo: number, hi: number, fallback: number): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

interface GameState { streak?: unknown; lastWinDay?: unknown }

const readGame = (s: GameState | undefined): { streak: number; win: string | null } | null => {
  if (!s || typeof s !== 'object') return null;
  return { streak: clampInt(s.streak, 0, 100000, 0), win: isDay(s.lastWinDay) ? s.lastWinDay : null };
};

export interface PushBody {
  endpoint?: unknown;
  hourUtc?: unknown;
  game?: unknown;
  streak?: unknown;
  lastWinDay?: unknown;
  state?: { jack?: GameState; ayo?: GameState; dice?: GameState };
}

export const subscribe = async (env: PushEnv, body: PushBody): Promise<{ ok: boolean; error?: string }> => {
  const endpoint = String(body.endpoint ?? '');
  if (!isAllowedPushEndpoint(endpoint, env.PUSH_EXTRA_HOSTS)) return { ok: false, error: 'Unsupported push endpoint' };
  await ensureTable(env.DB);
  const now = Date.now();
  const jack = readGame(body.state?.jack);
  const ayo = readGame(body.state?.ayo);
  const dice = readGame(body.state?.dice);
  await env.DB
    .prepare(
      `INSERT INTO push_subs (endpoint, hour_utc, streak_jack, win_jack, streak_ayo, win_ayo, streak_dice, win_dice, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         hour_utc = excluded.hour_utc,
         streak_jack = excluded.streak_jack, win_jack = excluded.win_jack,
         streak_ayo = excluded.streak_ayo, win_ayo = excluded.win_ayo,
        streak_dice = excluded.streak_dice, win_dice = excluded.win_dice,
         updated_at = excluded.updated_at`
    )
    .bind(endpoint, clampInt(body.hourUtc, 0, 23, 18), jack?.streak ?? 0, jack?.win ?? null, ayo?.streak ?? 0, ayo?.win ?? null, dice?.streak ?? 0, dice?.win ?? null, now, now)
    .run();
  return { ok: true };
};

export const sync = async (env: PushEnv, body: PushBody): Promise<{ ok: boolean; error?: string }> => {
  const endpoint = String(body.endpoint ?? '');
  const game = String(body.game ?? '');
  if (!isAllowedPushEndpoint(endpoint, env.PUSH_EXTRA_HOSTS) || (game !== 'jack' && game !== 'ayo' && game !== 'dice')) {
    return { ok: false, error: 'Bad request' };
  }
  await ensureTable(env.DB);
  const streak = clampInt(body.streak, 0, 100000, 0);
  const win = isDay(body.lastWinDay) ? body.lastWinDay : null;
  const sql = game === 'jack'
    ? 'UPDATE push_subs SET streak_jack = ?, win_jack = ?, updated_at = ? WHERE endpoint = ?'
    : game === 'ayo'
      ? 'UPDATE push_subs SET streak_ayo = ?, win_ayo = ?, updated_at = ? WHERE endpoint = ?'
      : 'UPDATE push_subs SET streak_dice = ?, win_dice = ?, updated_at = ? WHERE endpoint = ?';
  await env.DB.prepare(sql).bind(streak, win, Date.now(), endpoint).run();
  return { ok: true };
};

export const unsubscribe = async (env: PushEnv, body: PushBody): Promise<{ ok: boolean }> => {
  const endpoint = String(body.endpoint ?? '').slice(0, 700);
  await ensureTable(env.DB);
  await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(endpoint).run();
  return { ok: true };
};

// ---- what to say ----

interface Reminder { title: string; body: string; url: string; icon: string }

/** A game's streak is "in danger" when it is still alive (won yesterday) but not yet extended today. */
const atRisk = (streak: number, win: string | null, today: string): boolean =>
  streak > 0 && win === shiftDay(today, -1);

const hoursLeft = (now: number): number => Math.max(1, Math.round((Date.parse(`${utcDay(now)}T00:00:00Z`) + DAY_MS - now) / 3_600_000));

export const composeReminder = (row: SubRow, now = Date.now()): Reminder | null => {
  const today = utcDay(now);
  const risks = GAMES
    .map((g) => ({
      g,
      streak: (g === 'jack' ? row.streak_jack : g === 'ayo' ? row.streak_ayo : row.streak_dice) ?? 0,
      win: g === 'jack' ? row.win_jack : g === 'ayo' ? row.win_ayo : row.win_dice,
    }))
    .filter((r) => atRisk(r.streak, r.win, today))
    .sort((a, b) => b.streak - a.streak);
  if (risks.length === 0) return null;
  const top = risks[0];
  const left = hoursLeft(now);
  const name = top.g === 'ayo' ? 'Ayò' : top.g === 'dice' ? 'Street Dice' : 'Jack Attack';
  const more = risks.length > 1 ? ' (and your other streak too)' : '';
  return {
    title: '🔥 Keep your streak alive',
    body: `Your ${top.streak}-day ${name} streak ends in ${left}h${more}. Today's daily is waiting.`,
    url: top.g === 'ayo' ? '/ayo/?source=push' : top.g === 'dice' ? '/dice/?source=push' : '/jackattack/?daily=1&source=push',
    icon: top.g === 'ayo' ? '/ayo/icon-192.png' : top.g === 'dice' ? '/dice/icon-192.png' : '/icon-192.png',
  };
};

const GENERIC: Reminder = {
  title: "Today's daily is ready",
  body: 'A new daily is waiting for you.',
  url: '/?source=push',
  icon: '/icon-192.png',
};

/** Called by the service worker when a push arrives. Always answers, so a notification is always shown. */
export const messageFor = async (env: PushEnv, body: PushBody): Promise<Reminder> => {
  const endpoint = String(body.endpoint ?? '');
  if (!isAllowedPushEndpoint(endpoint, env.PUSH_EXTRA_HOSTS)) return GENERIC;
  await ensureTable(env.DB);
  const row = await env.DB.prepare('SELECT * FROM push_subs WHERE endpoint = ?').bind(endpoint).first<SubRow>();
  return (row && composeReminder(row)) || GENERIC;
};

// ---- sending ----

const b64url = (bytes: ArrayBuffer | Uint8Array): string => {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64urlText = (text: string): string => b64url(new TextEncoder().encode(text));

let signingKey: CryptoKey | null = null;
let signingKeySource = '';

const getSigningKey = async (jwk: string): Promise<CryptoKey> => {
  if (signingKey && signingKeySource === jwk) return signingKey;
  signingKey = await crypto.subtle.importKey('jwk', JSON.parse(jwk), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  signingKeySource = jwk;
  return signingKey;
};

/** `Authorization` header value for a push to `endpoint` (RFC 8292, "vapid" scheme). */
export const vapidAuthorization = async (env: PushEnv, endpoint: string, now = Date.now()): Promise<string> => {
  if (!env.VAPID_PRIVATE_JWK || !env.VAPID_PUBLIC_KEY) throw new Error('VAPID keys are not configured');
  const aud = new URL(endpoint).origin;
  const header = b64urlText(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64urlText(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: 'https://jackattackstreets.com' }));
  const signingInput = `${header}.${claims}`;
  const key = await getSigningKey(env.VAPID_PRIVATE_JWK);
  // WebCrypto returns the raw 64-byte r||s signature, which is exactly what JWT's ES256 wants.
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(signingInput));
  return `vapid t=${signingInput}.${b64url(sig)}, k=${env.VAPID_PUBLIC_KEY}`;
};

/** Send an empty push. Returns the push service's status code. */
export const sendEmptyPush = async (env: PushEnv, endpoint: string): Promise<number> => {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(env, endpoint),
      TTL: '10800', // a streak reminder is worthless after a few hours
      Urgency: 'normal',
      'Content-Length': '0',
    },
  });
  return res.status;
};

/**
 * Cron entry (every 10 minutes): remind everyone whose chosen UTC hour it is, whose streak is still alive
 * but not yet extended today, at most once per day. Dead endpoints (404/410) are removed.
 */
export const sendDueReminders = async (env: PushEnv, now = Date.now()): Promise<{ checked: number; sent: number; removed: number; skipped: number }> => {
  const stats = { checked: 0, sent: 0, removed: 0, skipped: 0 };
  if (!env.VAPID_PRIVATE_JWK || !env.VAPID_PUBLIC_KEY) return stats;
  await ensureTable(env.DB);
  const today = utcDay(now);
  const hour = new Date(now).getUTCHours();
  const { results } = await env.DB
    .prepare('SELECT * FROM push_subs WHERE hour_utc = ? AND (last_sent_day IS NULL OR last_sent_day != ?) LIMIT ?')
    .bind(hour, today, MAX_PER_RUN)
    .all<SubRow>();

  const markDone: D1PreparedStatement[] = [];
  const remove: D1PreparedStatement[] = [];
  const mark = (endpoint: string) =>
    markDone.push(env.DB.prepare('UPDATE push_subs SET last_sent_day = ? WHERE endpoint = ?').bind(today, endpoint));

  for (const row of results ?? []) {
    stats.checked++;
    if (!composeReminder(row, now)) {
      stats.skipped++;
      mark(row.endpoint); // nothing at risk today: don't look at this one again until tomorrow
      continue;
    }
    try {
      const status = await sendEmptyPush(env, row.endpoint);
      if (status === 404 || status === 410) {
        stats.removed++;
        remove.push(env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(row.endpoint));
      } else if (status >= 200 && status < 300) {
        stats.sent++;
        mark(row.endpoint);
      }
      // 429/5xx: leave it unmarked so the next 10-minute run tries again within the hour
    } catch {
      // network error: same as above
    }
  }
  const all = [...markDone, ...remove];
  if (all.length) await env.DB.batch(all);
  return stats;
};
