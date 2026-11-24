// core/analytics.ts - Anonymous, cookieless usage events so we can measure retention.
//
// What is sent: an event name, the game, a short detail (mode/result), a random per-browser id that is
// NOT the guest id used for scores and rooms, and the UTC day this browser was first seen. No IP,
// name, or account is stored. Honours Do Not Track, and anyone can opt out with
// localStorage.setItem('ja-analytics-off', '1').
import { ROOMS_API_BASE } from './online';

export type AnalyticsGame = 'jack' | 'ayo' | 'site';

// Keep in sync with ALLOWED_EVENTS in worker/src/index.ts.
export type AnalyticsEvent =
  | 'app_open'
  | 'game_start'
  | 'game_end'
  | 'daily_start'
  | 'daily_win'
  | 'share'
  | 'tutorial_start'
  | 'tutorial_step'
  | 'tutorial_done'
  | 'tutorial_skip'
  | 'install_accept'
  | 'install_dismiss'
  | 'reminder_on'
  | 'reminder_off'
  | 'reminder_denied';

const ANON_KEY = 'ja-anon-v1';
const FIRST_SEEN_KEY = 'ja-first-seen-v1';
const OPT_OUT_KEY = 'ja-analytics-off';

const today = (): string => new Date().toISOString().slice(0, 10);

const optedOut = (): boolean => {
  try {
    if (localStorage.getItem(OPT_OUT_KEY) === '1') return true;
    const dnt = (navigator as Navigator & { doNotTrack?: string }).doNotTrack;
    return dnt === '1' || (typeof window !== 'undefined' && (window as unknown as { doNotTrack?: string }).doNotTrack === '1');
  } catch {
    return true;
  }
};

const identity = (): { anon: string; cohort: string } | null => {
  try {
    let anon = localStorage.getItem(ANON_KEY);
    if (!anon) {
      anon = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `a-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(ANON_KEY, anon);
    }
    let cohort = localStorage.getItem(FIRST_SEEN_KEY);
    if (!cohort) {
      cohort = today();
      localStorage.setItem(FIRST_SEEN_KEY, cohort);
    }
    return { anon, cohort };
  } catch {
    return null; // storage blocked: skip rather than invent a new identity on every event
  }
};

/** Fire-and-forget. Never throws and never blocks the game. */
export const track = (event: AnalyticsEvent, game: AnalyticsGame, detail = ''): void => {
  try {
    if (typeof window === 'undefined' || optedOut()) return;
    // Local development and preview builds shouldn't pollute the numbers.
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost');
    if (isLocal && localStorage.getItem('ja-analytics-debug') !== '1') return;
    const id = identity();
    if (!id) return;
    const body = JSON.stringify({ event, game, detail: detail.slice(0, 32), anon: id.anon, cohort: id.cohort });
    const url = `${ROOMS_API_BASE}/api/event`;
    // text/plain keeps this a "simple" request, so sendBeacon needs no CORS preflight.
    if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return;
    void fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, keepalive: true }).catch(() => {});
  } catch {
    // Analytics must never break the game.
  }
};

const opened = new Set<string>();
/** One app_open per page load per game. */
export const trackOpen = (game: AnalyticsGame): void => {
  if (opened.has(game)) return;
  opened.add(game);
  // How the visit started: from a streak reminder, from the installed app, or a normal tab.
  let how = '';
  try {
    if (new URLSearchParams(window.location.search).get('source') === 'push') how = 'push';
    else if (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone) how = 'pwa';
  } catch { /* ignore */ }
  track('app_open', game, how);
};
