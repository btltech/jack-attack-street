// core/pwa.ts - "Install app" prompt and streak reminders (Web Push) for both games.
//
// Reminders work like this: the browser subscribes to a push service, we tell the Worker the
// subscription's endpoint, the player's preferred time and their current streaks, and the Worker's
// 10-minute cron sends an empty push at that time when a streak is at risk. The service worker then
// asks the Worker what to say (see worker/src/push.ts and public/sw.js).
import { ROOMS_API_BASE } from './online';
import { getDailyStatus, type DailyGame } from './daily';
import { track, type AnalyticsGame } from './analytics';

/** Public VAPID key; must match VAPID_PUBLIC_KEY in worker/wrangler.toml. */
export const VAPID_PUBLIC_KEY = 'BJSneq6BgO-aAu7WM1HgsEaM_xlUoIqzIoUyNQV5EEnGH7BfKjXnpPS9OpGhFFGPmz0wOg45qQNLmzLxHuC-YP4';

/** Local time of day the reminder should arrive. */
const REMIND_LOCAL_HOUR = 19;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  // Registered at module load so we catch the event even if it fires before React renders.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    emit();
  });
}

/** Re-render hook for components: called when install availability changes. */
export const onPwaChange = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
};

export const isStandalone = (): boolean => {
  try {
    return window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  } catch {
    return false;
  }
};

export const isIOS = (): boolean => {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
};

export const canInstall = (): boolean => deferredPrompt !== null && !isStandalone();

export const promptInstall = async (game: AnalyticsGame): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
  const p = deferredPrompt;
  if (!p) return 'unavailable';
  deferredPrompt = null; // a prompt event can be used once
  emit();
  await p.prompt();
  const { outcome } = await p.userChoice;
  track(outcome === 'accepted' ? 'install_accept' : 'install_dismiss', game);
  return outcome;
};

export const pushSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export type ReminderStatus =
  | 'unsupported'  // this browser can't do web push
  | 'ios-install'  // iPhone/iPad: only works once added to the Home Screen
  | 'blocked'      // notifications denied in browser settings
  | 'off'
  | 'on';

const getRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
  try {
    return (await navigator.serviceWorker.getRegistration('/')) ?? (await navigator.serviceWorker.register('/sw.js', { scope: '/' }));
  } catch {
    return null;
  }
};

export const getReminderStatus = async (): Promise<ReminderStatus> => {
  if (!pushSupported()) return isIOS() && !isStandalone() ? 'ios-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === 'granted' ? 'on' : 'off';
  } catch {
    return 'off';
  }
};

const toKeyBytes = (b64url: string): Uint8Array => {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const raw = atob((b64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** UTC hour that is REMIND_LOCAL_HOUR on this device's clock right now. */
const reminderHourUtc = (): number => {
  const offsetMin = new Date().getTimezoneOffset(); // minutes UTC is ahead of local time
  return (((Math.round((REMIND_LOCAL_HOUR * 60 + offsetMin) / 60) % 24) + 24) % 24);
};

const streakState = () => {
  const one = (g: DailyGame) => {
    const s = getDailyStatus(g);
    return { streak: s.streak, lastWinDay: s.lastWinDay };
  };
  return { jack: one('jack'), ayo: one('ayo') };
};

const post = async (path: string, body: unknown): Promise<boolean> => {
  try {
    const res = await fetch(`${ROOMS_API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
};

/** Ask permission and subscribe. Resolves with the resulting status. */
export const enableReminders = async (game: AnalyticsGame): Promise<ReminderStatus> => {
  if (!pushSupported()) return getReminderStatus();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    track('reminder_denied', game, permission);
    return permission === 'denied' ? 'blocked' : 'off';
  }
  const reg = await getRegistration();
  if (!reg) return 'off';
  await navigator.serviceWorker.ready;
  try {
    const sub = (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKeyBytes(VAPID_PUBLIC_KEY) as BufferSource }));
    const ok = await post('/api/push/subscribe', { endpoint: sub.endpoint, hourUtc: reminderHourUtc(), state: streakState() });
    if (!ok) {
      await sub.unsubscribe().catch(() => {});
      return 'off';
    }
    track('reminder_on', game);
    return 'on';
  } catch {
    return 'off';
  }
};

export const disableReminders = async (game: AnalyticsGame): Promise<ReminderStatus> => {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await post('/api/push/unsubscribe', { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
  } catch { /* nothing to undo */ }
  track('reminder_off', game);
  return getReminderStatus();
};

/**
 * Tell the Worker the current streaks and preferred hour (which shifts with daylight saving).
 * Call on app open and after a daily win. Does nothing unless reminders are on.
 */
export const syncReminders = async (): Promise<void> => {
  try {
    if (!pushSupported() || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await post('/api/push/subscribe', { endpoint: sub.endpoint, hourUtc: reminderHourUtc(), state: streakState() });
  } catch {
    // Reminders are best-effort.
  }
};
