// components/DailyStreakBadge.tsx - "🔥 3-day streak · next daily in 5h 12m" strip shared by both games
import React, { useEffect, useState } from 'react';
import {
  DailyGame, DailyStatus, getDailyStatus, msUntilNextDay, formatCountdown, streakLabel,
} from '../core/daily';

interface DailyStreakBadgeProps {
  game: DailyGame;
  /** Change this to re-read the streak straight after a win. */
  refreshKey?: number | string;
  className?: string;
}

const DailyStreakBadge: React.FC<DailyStreakBadgeProps> = ({ game, refreshKey, className = '' }) => {
  const [status, setStatus] = useState<DailyStatus>(() => getDailyStatus(game));
  const [msLeft, setMsLeft] = useState<number>(() => msUntilNextDay());

  useEffect(() => {
    const tick = () => {
      setStatus(getDailyStatus(game));
      setMsLeft(msUntilNextDay());
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [game, refreshKey]);

  const message = status.solvedToday
    ? `Solved today ✓ · next daily in ${formatCountdown(msLeft)}`
    : status.streak > 0
      ? `Win today to keep it going · resets in ${formatCountdown(msLeft)}`
      : `Win today's daily to start a streak · ${formatCountdown(msLeft)} left`;

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-3.5 py-2 ${
        status.streak > 0 ? 'bg-orange-500/20 border-orange-400/60' : 'bg-black/25 border-white/15'
      } ${className}`}
      aria-label={`${status.streak > 0 ? streakLabel(status.streak) : 'No streak yet'}. ${message}`}
    >
      <div className="text-2xl leading-none" aria-hidden="true">{status.streak > 0 ? '🔥' : '📅'}</div>
      <div className="min-w-0 text-left">
        <div className="font-display font-black text-sm leading-tight text-white tabular-nums">
          {status.streak > 0 ? streakLabel(status.streak) : 'No streak yet'}
          {status.best > status.streak && (
            <span className="ml-2 text-[11px] font-bold text-white/70">best {status.best}</span>
          )}
        </div>
        <div className="text-[11px] font-bold text-white/75 leading-tight">{message}</div>
      </div>
    </div>
  );
};

export default DailyStreakBadge;
