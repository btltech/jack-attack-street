// components/StreakReminder.tsx - "Remind me before my streak ends" + "Install app", shared by both games.
// Asked at the right moment only: after a daily win, or in the menu once the player has won a daily before.
import React, { useCallback, useEffect, useState } from 'react';
import { getDailyStatus, type DailyGame } from '../core/daily';
import {
  ReminderStatus, getReminderStatus, enableReminders, disableReminders, syncReminders,
  canInstall, promptInstall, onPwaChange,
} from '../core/pwa';

interface StreakReminderProps {
  game: DailyGame;
  /** 'win' = right after winning the daily (always asks); 'menu' = only for players who have won a daily before. */
  context: 'win' | 'menu';
  /** Change to re-evaluate after a win. */
  refreshKey?: number | string;
  className?: string;
}

const btn = 'shrink-0 rounded-full px-3 py-1.5 text-xs font-black border-b-2 transition-colors';

const StreakReminder: React.FC<StreakReminderProps> = ({ game, context, refreshKey, className = '' }) => {
  const [status, setStatus] = useState<ReminderStatus | null>(null);
  const [installable, setInstallable] = useState<boolean>(() => canInstall());
  const [busy, setBusy] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  const refresh = useCallback(() => {
    getReminderStatus().then(setStatus);
    setInstallable(canInstall());
  }, []);

  useEffect(() => {
    refresh();
    return onPwaChange(refresh);
  }, [refresh, refreshKey]);

  // Keep the Worker's copy of the streak current whenever the player has reminders on.
  useEffect(() => { if (status === 'on') void syncReminders(); }, [status, refreshKey]);

  if (status === null) return null;
  if (context === 'menu' && getDailyStatus(game).wins === 0) return null;
  if (status === 'unsupported' && !installable) return null;
  // In the menu, a player who already has reminders on and nothing to install doesn't need the card.
  if (context === 'menu' && status === 'on' && !installable) return null;

  const turnOn = async () => {
    setBusy(true);
    setStatus(await enableReminders(game));
    setBusy(false);
  };
  const turnOff = async () => {
    setBusy(true);
    setStatus(await disableReminders(game));
    setBusy(false);
  };
  const install = async () => {
    await promptInstall(game);
    refresh();
  };

  return (
    <div className={`rounded-2xl border border-white/15 bg-black/25 px-3.5 py-2.5 text-left ${className}`}>
      {status === 'off' && (
        <div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-[12px] font-bold text-white/85 leading-tight">🔔 Get a nudge before your streak ends</div>
            <button onClick={turnOn} disabled={busy} className={`${btn} bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-600`}>
              {busy ? '…' : 'Remind me'}
            </button>
          </div>
          <a href="/privacy/" target="_blank" rel="noopener" className="block mt-1 text-[10px] font-semibold text-white/55 underline underline-offset-2 hover:text-white/80">
            What we store for reminders
          </a>
        </div>
      )}
      {status === 'on' && (
        <div className="flex items-center justify-between gap-3">
          <div className="text-[12px] font-bold text-emerald-200 leading-tight">🔔 Reminder on: about 7pm, only if your streak is at risk</div>
          <button onClick={turnOff} disabled={busy} className={`${btn} bg-white/10 hover:bg-white/20 text-white border-white/20`}>
            Turn off
          </button>
        </div>
      )}
      {status === 'blocked' && (
        <div className="text-[12px] font-bold text-white/75 leading-tight">
          🔕 Notifications are blocked for this site. Allow them in your browser's site settings to get streak reminders.
        </div>
      )}
      {status === 'ios-install' && (
        <div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-[12px] font-bold text-white/85 leading-tight">📲 Add to your Home Screen to get streak reminders</div>
            <button onClick={() => setIosHelp((v) => !v)} className={`${btn} bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-600`}>
              {iosHelp ? 'Hide' : 'How?'}
            </button>
          </div>
          {iosHelp && (
            <ol className="mt-2 list-decimal pl-5 text-[12px] font-semibold text-white/80 space-y-0.5">
              <li>Tap the Share button in Safari.</li>
              <li>Choose “Add to Home Screen”.</li>
              <li>Open the game from your Home Screen, then tap “Remind me”.</li>
            </ol>
          )}
        </div>
      )}
      {installable && (
        <div className={`flex items-center justify-between gap-3 ${status === 'unsupported' ? '' : 'mt-2 pt-2 border-t border-white/10'}`}>
          <div className="text-[12px] font-bold text-white/85 leading-tight">📲 Install the app for one-tap access</div>
          <button onClick={install} className={`${btn} bg-white/10 hover:bg-white/20 text-white border-white/20`}>Install</button>
        </div>
      )}
    </div>
  );
};

export default StreakReminder;
