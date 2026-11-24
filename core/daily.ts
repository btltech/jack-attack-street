// core/daily.ts - Daily streaks, countdown and sharing, shared by Jack Attack and Ayò.
// Everything here is local to the player's browser (no account needed). Days are UTC days
// ("2026-11-24"), the same days the daily seed and the daily Ayò puzzle rotate on.

export type DailyGame = 'jack' | 'ayo';

// Daily #1 is the launch day; later days count up from it.
const LAUNCH_DAY = '2026-11-23';
const DAY_MS = 86_400_000;

export interface DailyStatus {
  /** Current streak: consecutive days with a win. 0 once a day has been missed. */
  streak: number;
  best: number;
  /** Total daily wins ever recorded. */
  wins: number;
  solvedToday: boolean;
}

interface DailyRecord {
  streak: number;
  best: number;
  wins: number;
  lastWinDay: string | null;
}

const storageKey = (game: DailyGame): string => `daily-streak-v1-${game}`;

const emptyRecord = (): DailyRecord => ({ streak: 0, best: 0, wins: 0, lastWinDay: null });

export const utcDay = (now: number = Date.now()): string => new Date(now).toISOString().slice(0, 10);

const dayToMs = (day: string): number => Date.parse(`${day}T00:00:00Z`);

export const shiftDay = (day: string, deltaDays: number): string => utcDay(dayToMs(day) + deltaDays * DAY_MS);

/** "Daily #N" number for a day (launch day is #1). */
export const dailyNumber = (day: string = utcDay()): number =>
  Math.max(1, Math.round((dayToMs(day) - dayToMs(LAUNCH_DAY)) / DAY_MS) + 1);

const load = (game: DailyGame): DailyRecord => {
  try {
    const raw = localStorage.getItem(storageKey(game));
    if (!raw) return emptyRecord();
    const p = JSON.parse(raw) as Partial<DailyRecord>;
    return {
      streak: Number.isFinite(p.streak) ? Math.max(0, Math.floor(p.streak as number)) : 0,
      best: Number.isFinite(p.best) ? Math.max(0, Math.floor(p.best as number)) : 0,
      wins: Number.isFinite(p.wins) ? Math.max(0, Math.floor(p.wins as number)) : 0,
      lastWinDay: typeof p.lastWinDay === 'string' ? p.lastWinDay : null,
    };
  } catch {
    return emptyRecord();
  }
};

const save = (game: DailyGame, rec: DailyRecord): void => {
  try {
    localStorage.setItem(storageKey(game), JSON.stringify(rec));
  } catch {
    // Storage unavailable (private mode): the streak just won't persist.
  }
};

const toStatus = (rec: DailyRecord, today: string): DailyStatus => {
  const solvedToday = rec.lastWinDay === today;
  // The streak survives until a whole day passes without a win.
  const alive = solvedToday || rec.lastWinDay === shiftDay(today, -1);
  return { streak: alive ? rec.streak : 0, best: rec.best, wins: rec.wins, solvedToday };
};

export const getDailyStatus = (game: DailyGame, today: string = utcDay()): DailyStatus =>
  toStatus(load(game), today);

/**
 * Record a win of the daily for `day`. Only the first win of a day counts toward the streak, so
 * replaying the same daily is harmless. Returns the new status and whether this win extended it.
 */
export const recordDailyWin = (
  game: DailyGame,
  day: string = utcDay(),
): DailyStatus & { firstWinToday: boolean } => {
  const rec = load(game);
  if (rec.lastWinDay === day) {
    return { ...toStatus(rec, day), firstWinToday: false };
  }
  const continues = rec.lastWinDay === shiftDay(day, -1);
  rec.streak = continues ? rec.streak + 1 : 1;
  rec.best = Math.max(rec.best, rec.streak);
  rec.wins += 1;
  rec.lastWinDay = day;
  save(game, rec);
  return { ...toStatus(rec, day), firstWinToday: true };
};

export const msUntilNextDay = (now: number = Date.now()): number => {
  const next = dayToMs(utcDay(now)) + DAY_MS;
  return Math.max(0, next - now);
};

/** "5h 12m", "42m" or "<1m". */
export const formatCountdown = (ms: number): string => {
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return totalMin > 0 ? `${m}m` : '<1m';
};

export const streakLabel = (streak: number): string => `${streak}-day streak`;

/** Share sheet on phones that have one, clipboard everywhere else. */
export const shareOrCopy = async (
  text: string,
  url: string,
  title: string,
): Promise<'shared' | 'copied' | 'failed'> => {
  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title, text, url });
      return 'shared';
    }
  } catch {
    // Share sheet dismissed or failed: fall back to copying the text.
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
};
