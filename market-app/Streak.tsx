// market-app/Streak.tsx - Daily streak strip and "remind me" card for Market Margin.
// Same logic as the other games (core/daily.ts, core/pwa.ts), dressed in this page's own styles
// because Market Margin doesn't load Tailwind. Finishing the daily is what counts: there is no losing.
import { useCallback, useEffect, useState } from 'react';
import { formatCountdown, getDailyStatus, msUntilNextDay, streakLabel } from '../core/daily';
import {
  canInstall, disableReminders, enableReminders, getReminderStatus, onPwaChange, promptInstall, syncReminders,
} from '../core/pwa';
import type { ReminderStatus } from '../core/pwa';

export function StreakStrip({ refreshKey }: { refreshKey: number }) {
  const read = () => ({ status: getDailyStatus('market'), msLeft: msUntilNextDay() });
  const [state, setState] = useState(read);

  useEffect(() => {
    setState(read());
    const timer = window.setInterval(() => setState(read()), 30_000);
    return () => window.clearInterval(timer);
  }, [refreshKey]);

  const { status, msLeft } = state;
  const message = status.solvedToday
    ? `Played today ✓ · next daily in ${formatCountdown(msLeft)}`
    : status.streak > 0
      ? `Play today to keep it going · resets in ${formatCountdown(msLeft)}`
      : `Play today’s daily to start a streak · ${formatCountdown(msLeft)} left`;

  return (
    <div className={`streak ${status.streak > 0 ? 'alive' : ''}`}>
      <span className="streak-icon" aria-hidden="true">{status.streak > 0 ? '🔥' : '📅'}</span>
      <div>
        <strong>
          {status.streak > 0 ? streakLabel(status.streak) : 'No streak yet'}
          {status.best > status.streak && <small> best {status.best}</small>}
        </strong>
        <span>{message}</span>
      </div>
    </div>
  );
}

/**
 * "Remind me before my streak ends" and "Install app". Shown after finishing the daily ('win'), or on the
 * trading screen only for players who have finished a daily before ('menu').
 */
export function ReminderCard({ context, refreshKey }: { context: 'win' | 'menu'; refreshKey: number }) {
  const [status, setStatus] = useState<ReminderStatus | null>(null);
  const [installable, setInstallable] = useState(() => canInstall());
  const [busy, setBusy] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  const refresh = useCallback(() => {
    void getReminderStatus().then(setStatus);
    setInstallable(canInstall());
  }, []);

  useEffect(() => {
    refresh();
    return onPwaChange(refresh);
  }, [refresh, refreshKey]);

  // Keep the Worker's copy of the streak current whenever reminders are on.
  useEffect(() => { if (status === 'on') void syncReminders(); }, [status, refreshKey]);

  if (status === null) return null;
  if (context === 'menu' && getDailyStatus('market').wins === 0) return null;
  if (status === 'unsupported' && !installable) return null;
  if (context === 'menu' && status === 'on' && !installable) return null;

  async function turnOn() { setBusy(true); setStatus(await enableReminders('market')); setBusy(false); }
  async function turnOff() { setBusy(true); setStatus(await disableReminders('market')); setBusy(false); }
  async function install() { await promptInstall('market'); refresh(); }

  return (
    <div className="reminder">
      {status === 'off' && (
        <>
          <div className="reminder-row">
            <span>🔔 Get a nudge before your streak ends</span>
            <button className="primary" onClick={turnOn} disabled={busy}>{busy ? '…' : 'Remind me'}</button>
          </div>
          <a className="reminder-link" href="/privacy/" target="_blank" rel="noopener">What we store for reminders</a>
        </>
      )}
      {status === 'on' && (
        <div className="reminder-row">
          <span className="reminder-on">🔔 Reminder on: about 7pm, only if your streak is at risk</span>
          <button className="secondary" onClick={turnOff} disabled={busy}>Turn off</button>
        </div>
      )}
      {status === 'blocked' && (
        <div className="reminder-row"><span>🔕 Notifications are blocked for this site. Allow them in your browser’s site settings to get streak reminders.</span></div>
      )}
      {status === 'ios-install' && (
        <>
          <div className="reminder-row">
            <span>📲 Add to your Home Screen to get streak reminders</span>
            <button className="primary" onClick={() => setIosHelp(!iosHelp)}>{iosHelp ? 'Hide' : 'How?'}</button>
          </div>
          {iosHelp && (
            <ol className="reminder-steps">
              <li>Tap the Share button in Safari.</li>
              <li>Choose “Add to Home Screen”.</li>
              <li>Open Market Margin from your Home Screen, then tap “Remind me”.</li>
            </ol>
          )}
        </>
      )}
      {installable && (
        <div className={`reminder-row ${status === 'unsupported' ? '' : 'reminder-install'}`}>
          <span>📲 Install the app for one-tap access</span>
          <button className="secondary" onClick={install}>Install</button>
        </div>
      )}
    </div>
  );
}
