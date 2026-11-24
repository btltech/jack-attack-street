// dice-app/DiceApp.tsx - Street Dice: a 60-second daily push-your-luck dice game.
// Five rounds. Roll two dice, add them to your pot, bank before a 1 busts you. Everyone gets the same
// rolls each day, and only your first game of the day counts, like a crossword.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MAX_ROLLS, ROUNDS, Roll, RoundChoice, RunResult, bestForRound, dailySeedKey, isBust, resolveRun, rollValue, rollsForRound, shareRows,
} from '../core/diceEngine';
import { dailyNumber, formatCountdown, getDailyStatus, msUntilNextDay, recordDailyWin, shareOrCopy, streakLabel, utcDay } from '../core/daily';
import { loadNickname, saveNickname } from '../core/online';
import { getMyPlayerId } from '../core/dailyLeaderboard';
import { track, trackOpen } from '../core/analytics';
import DailyStreakBadge from '../components/DailyStreakBadge';
import StreakReminder from '../components/StreakReminder';
import { DiceBoard, DiceSubmitResult, fetchDiceBoard, submitDiceGame } from './api';
import { buzz, isDiceMuted, playBank, playBust, playClick, playDoubles, playFinish, playRoll, setDiceMuted } from './sounds';

const SITE_URL = 'https://www.jackattackstreets.com/dice/';
const SAVE_KEY = 'street-dice-daily-v1';
const REDUCED_MOTION = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const ROLL_MS = REDUCED_MOTION ? 220 : 680;
// Chance that one roll of two dice shows at least one 1.
const BUST_PERCENT = Math.round((11 / 36) * 100);

type Screen = 'home' | 'play' | 'result';
type Mode = 'daily' | 'practice';
type RoundPhase = 'ready' | 'rolling' | 'busted' | 'banked';

interface SavedDaily { day: string; choices: RoundChoice[] }

const loadSaved = (day: string): SavedDaily | null => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as SavedDaily;
    if (p.day !== day || !resolveRun(dailySeedKey(day), p.choices)) return null;
    return p;
  } catch {
    return null;
  }
};

const PIPS: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

// Everything inside a die is sized from its own width (percentage padding would use the parent's).
const DIE_SIZE = 'clamp(84px, 24vw, 128px)';

const Die: React.FC<{ value: number; rolling: boolean; hot?: boolean; delay?: number }> = ({ value, rolling, hot, delay = 0 }) => (
  <div
    className={`dice-face relative grid grid-cols-3 grid-rows-3 bg-gradient-to-br from-white to-slate-200 shadow-[0_10px_0_#94a3b8,0_16px_24px_rgba(0,0,0,0.45)] ${rolling ? 'dice-tumble' : ''} ${hot ? 'ring-4 ring-yellow-300' : ''}`}
    style={{
      animationDelay: `${delay}ms`,
      width: DIE_SIZE,
      height: DIE_SIZE,
      padding: `calc(${DIE_SIZE} * 0.14)`,
      gap: `calc(${DIE_SIZE} * 0.04)`,
      borderRadius: `calc(${DIE_SIZE} * 0.2)`,
    }}
    role="img"
    aria-label={`Die showing ${value}`}
  >
    {Array.from({ length: 9 }, (_, i) => (
      <span key={i} className="flex items-center justify-center">
        {PIPS[value]?.includes(i) && (
          <span className={`block w-[88%] aspect-square rounded-full ${value === 1 ? 'bg-red-600' : 'bg-slate-900'} shadow-inner`} />
        )}
      </span>
    ))}
  </div>
);

const DiceApp: React.FC = () => {
  const today = utcDay();
  const saved = useMemo(() => loadSaved(today), [today]);

  const [screen, setScreen] = useState<Screen>(() => (saved ? 'result' : 'home'));
  const [mode, setMode] = useState<Mode>('daily');
  const [seedKey, setSeedKey] = useState<string>(() => dailySeedKey(today));
  const [choices, setChoices] = useState<RoundChoice[]>(() => saved?.choices ?? []);
  const [round, setRound] = useState(0);
  const [taken, setTaken] = useState(0);
  const [pot, setPot] = useState(0);
  const [phase, setPhase] = useState<RoundPhase>('ready');
  const [shown, setShown] = useState<Roll>({ a: 3, b: 4 });
  const [history, setHistory] = useState<Roll[]>([]);
  const [muted, setMuted] = useState(isDiceMuted());
  const [streakVersion, setStreakVersion] = useState(0);
  const [nickname, setNickname] = useState(() => loadNickname());
  const [board, setBoard] = useState<DiceBoard | null>(null);
  const [submit, setSubmit] = useState<DiceSubmitResult | null>(null);
  const [boardError, setBoardError] = useState(false);
  const [myId, setMyId] = useState('');
  const [shareState, setShareState] = useState<'' | 'copied' | 'shared' | 'failed'>('');
  const [msLeft, setMsLeft] = useState(msUntilNextDay());
  const [hotDoubles, setHotDoubles] = useState(false);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

  const rounds = useMemo(() => Array.from({ length: ROUNDS }, (_, i) => rollsForRound(seedKey, i)), [seedKey]);
  const run: RunResult | null = useMemo(
    () => (choices.length === ROUNDS ? resolveRun(seedKey, choices) : null),
    [choices, seedKey],
  );
  const bankedTotal = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < choices.length; i++) {
      const r = rounds[i];
      let p = 0;
      for (let k = 0; k < choices[i].n; k++) p += isBust(r[k]) ? 0 : rollValue(r[k]);
      if (choices[i].banked) sum += p;
    }
    return sum;
  }, [choices, rounds]);

  useEffect(() => {
    trackOpen('dice');
    getMyPlayerId().then(setMyId).catch(() => {});
    const t = window.setInterval(() => setMsLeft(msUntilNextDay()), 30_000);
    return () => { window.clearInterval(t); timers.current.forEach((x) => window.clearTimeout(x)); };
  }, []);

  // ---- daily result: leaderboard + submission ----
  const submitted = useRef(false);
  const sendResult = useCallback(async (finalChoices: RoundChoice[]) => {
    try {
      const res = await submitDiceGame(today, nickname || 'Player', finalChoices);
      setSubmit(res);
      setBoard({ day: res.day, total: res.total, entries: res.entries });
      setBoardError(false);
    } catch {
      setBoardError(true);
    }
  }, [nickname, today]);

  useEffect(() => {
    if (screen !== 'result' || mode !== 'daily' || !run || submitted.current) return;
    submitted.current = true;
    void sendResult(choices);
  }, [screen, mode, run, choices, sendResult]);

  // ---- game flow ----
  const resetRound = (nextRound: number) => {
    setRound(nextRound);
    setTaken(0);
    setPot(0);
    setPhase('ready');
    setHistory([]);
    setHotDoubles(false);
  };

  const start = (m: Mode) => {
    playClick();
    const key = m === 'daily' ? dailySeedKey(today) : `practice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setMode(m);
    setSeedKey(key);
    setChoices([]);
    setSubmit(null);
    setShareState('');
    submitted.current = m !== 'daily';
    resetRound(0);
    setScreen('play');
    track(m === 'daily' ? 'daily_start' : 'game_start', 'dice', m === 'daily' ? '' : 'practice');
  };

  const finishRound = (choice: RoundChoice, endPhase: 'busted' | 'banked') => {
    setChoices((c) => [...c, choice]);
    setPhase(endPhase);
  };

  const roll = () => {
    if (phase !== 'ready') return;
    const k = taken;
    const r = rounds[round][k];
    setPhase('rolling');
    playRoll();
    buzz(15);
    // tumble through random faces, then land on the real roll
    const flicker = window.setInterval(() => setShown({ a: 1 + Math.floor(Math.random() * 6), b: 1 + Math.floor(Math.random() * 6) }), 70);
    timers.current.push(flicker);
    later(() => {
      window.clearInterval(flicker);
      setShown(r);
      setTaken(k + 1);
      setHistory((h) => [...h, r]);
      if (isBust(r)) {
        setPot(0);
        playBust();
        buzz([60, 40, 90]);
        finishRound({ n: k + 1, banked: false }, 'busted');
        return;
      }
      const newPot = pot + rollValue(r);
      setPot(newPot);
      const dbl = r.a === r.b;
      setHotDoubles(dbl);
      if (dbl) playDoubles();
      if (k + 1 >= MAX_ROLLS) {
        // survived the roll limit: banked for you
        playBank(newPot);
        finishRound({ n: k + 1, banked: true }, 'banked');
        return;
      }
      setPhase('ready');
    }, ROLL_MS);
  };

  const bank = () => {
    if (phase !== 'ready' || taken < 1 || pot <= 0) return;
    playBank(pot);
    buzz(25);
    finishRound({ n: taken, banked: true }, 'banked');
  };

  const nextRound = () => {
    playClick();
    if (round + 1 < ROUNDS) {
      resetRound(round + 1);
      return;
    }
    // game over
    const final = resolveRun(seedKey, choices);
    if (mode === 'daily' && final) {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify({ day: today, choices } satisfies SavedDaily)); } catch { /* storage unavailable */ }
      recordDailyWin('dice', today);
      setStreakVersion((v) => v + 1);
      track('daily_win', 'dice', String(final.score));
    } else {
      track('game_end', 'dice', 'practice');
    }
    if (final) playFinish(final.best > 0 ? final.score / (final.best * 0.5) : 0);
    setScreen('result');
  };

  const toggleMute = () => { const v = !muted; setDiceMuted(v); setMuted(v); if (!v) playClick(); };

  // ---- share ----
  const share = async () => {
    if (!run) return;
    playClick();
    const streak = getDailyStatus('dice').streak;
    const header = mode === 'daily'
      ? `🎲 Street Dice #${dailyNumber(today)} · ${run.score} pts`
      : `🎲 Street Dice practice · ${run.score} pts`;
    const extras = [
      mode === 'daily' && submit ? `Rank #${submit.rank} of ${submit.total}` : '',
      mode === 'daily' && streak > 1 ? `🔥 ${streakLabel(streak)}` : '',
    ].filter(Boolean).join(' · ');
    const text = [header, shareRows(run.rounds), extras, 'Same rolls for everyone. Can you beat me?'].filter(Boolean).join('\n');
    track('share', 'dice', mode === 'daily' ? 'daily' : 'practice');
    const res = await shareOrCopy(text, SITE_URL, 'Street Dice');
    setShareState(res);
    later(() => setShareState(''), 2500);
  };

  const saveName = () => {
    saveNickname(nickname || 'Player');
    if (mode === 'daily') void sendResult(choices);
  };

  // ---------------- views ----------------
  const header = (
    <header className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-4 flex items-center justify-between gap-3">
      <a href="/" className="bg-black/40 hover:bg-black/60 text-rose-100 text-xs sm:text-sm font-bold px-4 py-2 rounded-full border border-white/20">← All Games</a>
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline text-xs font-bold text-rose-200/80">Daily #{dailyNumber(today)}</span>
        <button onClick={toggleMute} className="bg-black/40 px-3 py-1.5 rounded-full text-sm border border-white/20" aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </header>
  );

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-gradient-to-br from-rose-950 via-red-950 to-slate-950 text-white flex flex-col">
      {header}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-5 flex items-center">{children}</main>
    </div>
  );

  if (screen === 'home') {
    return shell(
      <div className="w-full grid lg:grid-cols-2 gap-6 lg:gap-12 items-center">
        <div className="text-center lg:text-left">
          <div className="text-6xl sm:text-7xl mb-2" aria-hidden="true">🎲</div>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-black text-amber-300 leading-none mb-3">Street Dice</h1>
          <p className="text-lg sm:text-xl text-rose-100 font-semibold mb-5">Push your luck. Bank before it busts.<br className="hidden sm:block" /> Five rounds, one minute, same rolls for everyone.</p>
          <DailyStreakBadge game="dice" refreshKey={streakVersion} className="mb-4 max-w-md mx-auto lg:mx-0" />
          <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
            <button onClick={() => start('daily')} className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-black text-xl py-4 px-8 rounded-full border-b-4 border-amber-600 shadow-xl active:translate-y-1 active:border-b-0">
              🔥 Play Daily #{dailyNumber(today)}
            </button>
            <button onClick={() => start('practice')} className="bg-white/10 hover:bg-white/20 text-white font-bold py-4 px-7 rounded-full border border-white/25">
              Practice (random rolls)
            </button>
          </div>
          <p className="text-xs text-rose-200/70 mt-3">One scored game a day. No sign-up.</p>
        </div>

        <div className="bg-black/30 border border-white/15 rounded-[2rem] p-5 sm:p-6">
          <h2 className="font-display text-2xl font-black text-amber-300 mb-3">How it works</h2>
          <ol className="space-y-3 text-rose-50">
            <li className="flex gap-3"><span className="text-2xl" aria-hidden="true">🎲</span><span><b>Roll two dice</b> and the total goes into your pot. Doubles count <b>double</b>.</span></li>
            <li className="flex gap-3"><span className="text-2xl" aria-hidden="true">🏦</span><span><b>Bank</b> any time to lock the pot into your score.</span></li>
            <li className="flex gap-3"><span className="text-2xl" aria-hidden="true">💥</span><span>Any die showing a <b className="text-red-400">1</b> is a <b>bust</b>: you lose the pot. About {BUST_PERCENT}% of rolls bust.</span></li>
            <li className="flex gap-3"><span className="text-2xl" aria-hidden="true">🏆</span><span>Five rounds. Highest score wins the day.</span></li>
          </ol>
          <div className="mt-4 flex items-center justify-center gap-3" aria-hidden="true">
            <Die value={6} rolling={false} /><Die value={6} rolling={false} hot />
          </div>
          <p className="text-center text-sm text-amber-200 font-bold mt-3">Double sixes = +24</p>
        </div>
      </div>,
    );
  }

  if (screen === 'play') {
    const busted = phase === 'busted';
    const banked = phase === 'banked';
    const rolling = phase === 'rolling';
    const last = choices[choices.length - 1];
    // What the pot was worth just before a bust (shown struck through, and as the amount lost).
    const lost = busted ? history.slice(0, -1).reduce((s, x) => s + rollValue(x), 0) : 0;
    return shell(
      <div className="w-full max-w-xl mx-auto">
        {/* round tracker */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1.5" aria-label={`Round ${round + 1} of ${ROUNDS}`}>
            {Array.from({ length: ROUNDS }, (_, i) => {
              const c = choices[i];
              return (
                <span key={i} className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black border-2 ${
                  i === round ? 'border-amber-300 bg-amber-300/20 text-amber-200' : c ? (c.banked ? 'border-emerald-400 bg-emerald-500/25' : 'border-red-400 bg-red-500/25') : 'border-white/20 text-white/40'
                }`}>
                  {c ? (c.banked ? '🏦' : '💥') : i + 1}
                </span>
              );
            })}
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase font-bold text-rose-200/80">Banked</div>
            <div className="font-display font-black text-3xl text-amber-300 tabular-nums leading-none">{bankedTotal}</div>
          </div>
        </div>

        {mode === 'practice' && <div className="text-center text-xs font-bold text-rose-200/80 mb-1">Practice: random rolls, nothing is saved</div>}

        <div className={`rounded-[2rem] border-2 p-5 sm:p-7 text-center transition-colors ${busted ? 'bg-red-900/50 border-red-400 dice-shake' : banked ? 'bg-emerald-900/40 border-emerald-400' : 'bg-black/30 border-white/15'}`}>
          <div className="text-[11px] uppercase font-bold tracking-widest text-rose-200/80">Round {round + 1} pot</div>
          <div className={`font-display font-black text-6xl sm:text-7xl tabular-nums leading-tight ${busted ? 'text-red-400 line-through' : 'text-white'}`} aria-live="polite">
            {busted ? lost : pot}
          </div>

          <div className="flex justify-center gap-4 sm:gap-6 my-4 min-h-[8rem]">
            {taken === 0 && !rolling ? (
              <div className="self-center text-rose-100/80 font-semibold">Tap Roll to start the round</div>
            ) : (
              <>
                <Die value={shown.a} rolling={rolling} hot={!rolling && hotDoubles} />
                <Die value={shown.b} rolling={rolling} hot={!rolling && hotDoubles} delay={60} />
              </>
            )}
          </div>

          <div className="min-h-[3rem] flex flex-wrap justify-center gap-1.5 mb-3" aria-label="Rolls this round">
            {history.map((r, i) => (
              <span key={i} className={`px-2.5 py-1 rounded-full text-sm font-black tabular-nums ${isBust(r) ? 'bg-red-500 text-white' : r.a === r.b ? 'bg-amber-300 text-slate-900' : 'bg-white/15 text-white'}`}>
                {isBust(r) ? '💥 1' : `+${rollValue(r)}${r.a === r.b ? ' ×2' : ''}`}
              </span>
            ))}
          </div>

          {(busted || banked) ? (
            <div>
              <p className="font-display text-2xl font-black mb-1">
                {busted ? `💥 Bust! You lost ${lost}` : `🏦 Banked ${pot}`}
              </p>
              {last && (
                <p className="text-sm text-rose-100/90 mb-3">
                  {(() => {
                    const best = bestForRound(rounds[round]);
                    if (busted) return best > 0 ? `You could have banked up to ${best} this round.` : 'The very first roll was a bust. Nothing you could do.';
                    return pot >= best ? 'You banked the most this round could give. Perfect.' : `The most this round could give was ${best}.`;
                  })()}
                </p>
              )}
              <button onClick={nextRound} className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-black text-lg py-3 px-8 rounded-full border-b-4 border-amber-600 shadow-xl">
                {round + 1 < ROUNDS ? 'Next round →' : 'See my score →'}
              </button>
            </div>
          ) : (
            <div className="flex gap-3 justify-center">
              <button onClick={roll} disabled={rolling} className="flex-1 max-w-[13rem] bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 font-display font-black text-2xl py-4 rounded-2xl border-b-4 border-amber-600 shadow-xl active:translate-y-1 active:border-b-0">
                🎲 Roll
              </button>
              <button onClick={bank} disabled={rolling || taken < 1} className="flex-1 max-w-[13rem] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-display font-black text-2xl py-4 rounded-2xl border-b-4 border-emerald-700 shadow-xl active:translate-y-1 active:border-b-0">
                🏦 Bank {pot > 0 ? pot : ''}
              </button>
            </div>
          )}
          {!busted && !banked && (
            <p className="text-xs text-rose-200/70 mt-3">Next roll busts on any 1 · about {BUST_PERCENT}% chance</p>
          )}
        </div>
      </div>,
    );
  }

  // ---- result ----
  const r = run;
  const verdict = !r ? '' : r.score >= 75 ? 'Street legend!' : r.score >= 55 ? 'Sharp roller' : r.score >= 35 ? 'Not bad at all' : 'Rough night. Run it back tomorrow';
  return shell(
    <div className="w-full grid lg:grid-cols-2 gap-6 lg:gap-12 items-start">
      <div className="text-center lg:text-left">
        <div className="text-sm font-bold text-rose-200/80">{mode === 'daily' ? `Daily #${dailyNumber(today)}` : 'Practice game'}</div>
        <div className="font-display font-black text-8xl sm:text-9xl text-amber-300 tabular-nums leading-none my-1">{r?.score ?? 0}</div>
        <div className="font-display text-2xl font-black mb-1">{verdict}</div>
        {r && <p className="text-rose-100/90 mb-4">With perfect hindsight these rolls were worth {r.best}. Nobody can see ahead, so around half of that is a strong day.</p>}

        {mode === 'daily' && submit && (
          <div className="inline-block bg-yellow-400/20 border-2 border-yellow-400 rounded-2xl px-4 py-2 text-yellow-200 font-black mb-4">
            🏆 Rank #{submit.rank} of {submit.total} today
          </div>
        )}
        {mode === 'daily' && boardError && <p className="text-sm text-rose-200/80 mb-3">Couldn't reach the leaderboard. Your score is saved here.</p>}

        {mode === 'daily' && <DailyStreakBadge game="dice" refreshKey={streakVersion} className="mb-3 max-w-md mx-auto lg:mx-0" />}
        {mode === 'daily' && <StreakReminder game="dice" context="win" refreshKey={streakVersion} className="mb-4 max-w-md mx-auto lg:mx-0" />}

        <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
          <button onClick={share} className="bg-purple-500 hover:bg-purple-400 text-white font-bold py-3 px-7 rounded-full border-b-4 border-purple-700">
            {shareState === 'copied' ? '✓ Copied!' : shareState === 'shared' ? '✓ Shared' : '📤 Share'}
          </button>
          <button onClick={() => start('practice')} className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-6 rounded-full border border-white/25">
            🎲 Practice
          </button>
          <a href="/" className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-full border-b-4 border-slate-900">More games</a>
        </div>
        {mode === 'daily' && <p className="text-sm text-rose-200/80 mt-4">Next daily in {formatCountdown(msLeft)}. New rolls every day.</p>}
      </div>

      <div className="space-y-4">
        {r && (
          <div className="bg-black/30 border border-white/15 rounded-[1.6rem] p-4">
            <h2 className="font-display text-xl font-black text-amber-300 mb-2">Your rounds</h2>
            <ul className="space-y-1.5">
              {r.rounds.map((x, i) => (
                <li key={i} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold w-8">R{i + 1}</span>
                  <span className="flex-1 truncate tracking-tight" aria-hidden="true">{'🎲'.repeat(x.busted ? x.n - 1 : x.n)}{x.busted ? '💥' : '🏦'}</span>
                  <span className="text-rose-200/80 text-xs">best {x.best}</span>
                  <span className={`font-display font-black text-lg tabular-nums w-10 text-right ${x.busted ? 'text-red-400' : 'text-emerald-300'}`}>{x.score}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {mode === 'daily' && (
          <div className="bg-black/30 border border-white/15 rounded-[1.6rem] p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-xl font-black text-amber-300">Today's leaderboard</h2>
              <button onClick={() => { fetchDiceBoard(today).then(setBoard).catch(() => setBoardError(true)); }} className="text-xs text-rose-200 underline">Refresh</button>
            </div>
            <div className="flex gap-2 mb-3">
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, 16))}
                placeholder="Your nickname"
                aria-label="Your nickname"
                className="flex-1 min-w-0 bg-black/40 border border-white/20 rounded-full px-4 py-2 text-sm"
              />
              <button onClick={saveName} className="bg-white/15 hover:bg-white/25 rounded-full px-4 text-sm font-bold">Save</button>
            </div>
            {!board ? (
              <p className="text-sm text-rose-200/70">{boardError ? 'Leaderboard unavailable right now.' : 'Loading…'}</p>
            ) : board.entries.length === 0 ? (
              <p className="text-sm text-rose-200/70">No scores yet. You're first!</p>
            ) : (
              <ol className="space-y-1">
                {board.entries.map((e) => (
                  <li key={e.playerId + e.rank} className={`flex items-center gap-3 rounded-xl px-3 py-1.5 text-sm ${e.playerId === myId ? 'bg-amber-400/25 border border-amber-300' : 'bg-white/5'}`}>
                    <span className="w-6 font-black tabular-nums text-rose-200">{e.rank}</span>
                    <span className="flex-1 truncate font-semibold">{e.name}{e.playerId === myId ? ' (you)' : ''}</span>
                    <span className="font-display font-black tabular-nums">{e.score}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>,
  );
};

export default DiceApp;
