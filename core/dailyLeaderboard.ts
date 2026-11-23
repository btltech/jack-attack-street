// core/dailyLeaderboard.ts - Same-seed Daily Challenge API client (Cloudflare D1)
import { ROOMS_API_BASE, getGuestId } from './online';

export interface LeaderboardEntry {
  rank: number;
  playerId: string; // one-way hash of the guest ID (see getMyPlayerId); never the raw ID
  name: string;
  durationMs: number;
  cardsPlayed: number;
}

export interface DailyLeaderboardResponse {
  day: string;
  total: number;
  entries: LeaderboardEntry[];
}

export interface DailyScoreSubmitResponse extends DailyLeaderboardResponse {
  ok: boolean;
  improved: boolean;
  rank: number;
  bestDurationMs: number;
}

// Must match publicPlayerId() in worker/src/index.ts: first 8 bytes of SHA-256(guestId), hex.
export const getMyPlayerId = async (): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(getGuestId()));
  return Array.from(new Uint8Array(digest).slice(0, 8), b => b.toString(16).padStart(2, '0')).join('');
};

export const getTodayUtcKey = (): string => new Date().toISOString().slice(0, 10);

export const getDailySeed = (day: string = getTodayUtcKey()): string => `jack-attack-daily-${day}`;

export const fetchDailyLeaderboard = async (day: string = getTodayUtcKey()): Promise<DailyLeaderboardResponse> => {
  const res = await fetch(`${ROOMS_API_BASE}/api/daily/${encodeURIComponent(day)}/leaderboard`);
  if (!res.ok) throw new Error('Could not load daily leaderboard');
  return (await res.json()) as DailyLeaderboardResponse;
};

export const submitDailyScore = async (params: {
  day?: string;
  name: string;
  durationMs: number;
  cardsPlayed: number;
}): Promise<DailyScoreSubmitResponse> => {
  const res = await fetch(`${ROOMS_API_BASE}/api/daily/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      day: params.day || getTodayUtcKey(),
      guestId: getGuestId(),
      name: params.name.trim() || 'Player',
      durationMs: Math.max(2000, Math.floor(params.durationMs)),
      cardsPlayed: Math.max(1, Math.floor(params.cardsPlayed)),
    }),
  });
  if (!res.ok) throw new Error('Could not submit score');
  return (await res.json()) as DailyScoreSubmitResponse;
};
