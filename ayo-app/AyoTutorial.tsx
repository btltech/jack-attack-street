// ayo-app/AyoTutorial.tsx - 60-second hands-on first lesson for traditional Ayò.
// Three tiny scripted positions (sow, relay, capture) played on the real engine, so what the lesson
// shows is exactly what happens in a game. Self-contained: it owns its own small board.
import React, { useEffect, useRef, useState } from 'react';
import { AyoState, createAyoGame, applyAyoMove } from './engine';
import { LESSONS } from './tutorialLessons';
import { playAyoClick, playSeedClack, playSeedScoop, playCaptureSound, playAyoWinSound } from './sounds';
import { track } from '../core/analytics';

export const TUTORIAL_DONE_KEY = 'ayo-tutorial-done-v1';

export const hasSeenTutorial = (): boolean => {
  try { return localStorage.getItem(TUTORIAL_DONE_KEY) === '1'; } catch { return true; }
};
const markSeen = () => {
  try { localStorage.setItem(TUTORIAL_DONE_KEY, '1'); } catch { /* storage blocked: the tutorial may show again */ }
};

type Phase = 'intro' | 'animating' | 'result' | 'finish';

interface Props {
  onClose: () => void;
  /** Called when the player picks what to do after the last lesson. */
  onPlay: (choice: 'daily' | 'ai') => void;
}

const AyoTutorial: React.FC<Props> = ({ onClose, onPlay }) => {
  const [lessonIdx, setLessonIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [pits, setPits] = useState<number[]>(LESSONS[0].pits);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [activePit, setActivePit] = useState<number | null>(null);
  const [handSeeds, setHandSeeds] = useState(0);
  const [captured, setCaptured] = useState<number[]>([]);
  const [nudge, setNudge] = useState(false);
  const timers = useRef<number[]>([]);
  const lessonIdxRef = useRef(0);
  lessonIdxRef.current = lessonIdx;
  const phaseRef = useRef<Phase>('intro');
  phaseRef.current = phase;

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  useEffect(() => {
    track('tutorial_start', 'ayo');
    return clearTimers;
  }, []);

  const lesson = LESSONS[Math.min(lessonIdx, LESSONS.length - 1)];

  const loadLesson = (i: number) => {
    clearTimers();
    setLessonIdx(i);
    setPits(LESSONS[i].pits);
    setScores([0, 0]);
    setActivePit(null);
    setHandSeeds(0);
    setCaptured([]);
    setNudge(false);
    setPhase('intro');
  };

  const skip = () => {
    playAyoClick();
    markSeen();
    track('tutorial_skip', 'ayo', phase === 'finish' ? 'finish' : `lesson-${lessonIdx + 1}`);
    onClose();
  };

  const play = (pit: number) => {
    if (phase !== 'intro') return;
    if (pit !== lesson.target) {
      setNudge(true);
      window.setTimeout(() => setNudge(false), 900);
      return;
    }
    const base: AyoState = createAyoGame('yoruba_ayo', lesson.pits, [0, 0]);
    const { steps } = applyAyoMove(base, pit);
    if (steps.length === 0) return;
    setPhase('animating');
    let t = 0;
    steps.forEach((step, i) => {
      t += i === 0 ? 450 : step.kind === 'capture' ? 650 : 520;
      timers.current.push(window.setTimeout(() => {
        if (step.kind === 'scoop') playSeedScoop(step.seedsInHand, i > 0);
        else if (step.kind === 'capture') playCaptureSound(step.capturedCount ?? 1, true);
        else playSeedClack(i, step.pits[step.activePit], step.activePit, i === steps.length - 1);
        setPits(step.pits);
        setScores(step.scores);
        setActivePit(step.kind === 'capture' ? null : step.activePit);
        setHandSeeds(step.seedsInHand);
        setCaptured(step.kind === 'capture' ? step.capturedPits ?? [] : []);
      }, t));
    });
    timers.current.push(window.setTimeout(() => {
      setActivePit(null);
      setHandSeeds(0);
      setCaptured([]);
      setPhase('result');
      track('tutorial_step', 'ayo', `lesson-${lessonIdxRef.current + 1}`);
    }, t + 700));
  };

  const next = () => {
    playAyoClick();
    if (lessonIdx < LESSONS.length - 1) {
      loadLesson(lessonIdx + 1);
    } else {
      clearTimers();
      markSeen();
      track('tutorial_done', 'ayo');
      playAyoWinSound();
      setPhase('finish');
    }
  };

  const renderPit = (i: number) => {
    const count = pits[i];
    const isTarget = phase === 'intro' && i === lesson.target;
    const isActive = activePit === i;
    const wasCaptured = captured.includes(i);
    const mine = i <= 5;
    return (
      <button
        key={i}
        type="button"
        onClick={() => play(i)}
        disabled={!mine || phase !== 'intro'}
        aria-label={`${mine ? 'Your' : 'Opponent'} pit with ${count} seed${count === 1 ? '' : 's'}${isTarget ? ', tap this one' : ''}`}
        className={`relative aspect-square min-w-0 rounded-full flex items-center justify-center font-display font-black text-lg sm:text-2xl transition-all duration-200 ${
          isTarget
            ? 'bg-amber-300 text-slate-950 ring-4 ring-amber-200 animate-pulse scale-105 shadow-[0_0_22px_rgba(252,211,77,0.9)]'
            : isActive
              ? 'bg-emerald-300 text-slate-950 scale-110 ring-4 ring-white'
              : wasCaptured
                ? 'bg-rose-500 text-white scale-95 ring-4 ring-rose-200'
                : mine
                  ? 'bg-amber-900/80 text-amber-100 border-2 border-amber-600/70'
                  : 'bg-stone-900/70 text-stone-200 border-2 border-stone-600/60'
        } ${nudge && mine && !isTarget && count > 0 ? 'opacity-50' : ''}`}
      >
        {count > 0 ? count : <span className="opacity-30 text-sm">·</span>}
      </button>
    );
  };

  const dots = (
    <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
      {LESSONS.map((_, i) => (
        <span key={i} className={`h-2 rounded-full transition-all ${
          i === lessonIdx && phase !== 'finish' ? 'w-6 bg-amber-300' : i < lessonIdx || phase === 'finish' ? 'w-2 bg-emerald-400' : 'w-2 bg-white/25'
        }`} />
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[120] bg-gradient-to-br from-emerald-950 via-green-950 to-slate-950 text-white overflow-y-auto" role="dialog" aria-modal="true" aria-label="How to play Ayò">
      <div className="min-h-full flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-xl">
          <div className="flex items-center justify-between mb-3">
            {dots}
            <button onClick={skip} className="text-xs sm:text-sm font-bold text-emerald-200/80 hover:text-white underline underline-offset-4">
              {phase === 'finish' ? 'Close' : 'Skip tutorial'}
            </button>
          </div>

          {phase === 'finish' ? (
            <div className="bg-black/35 border-2 border-amber-400/70 rounded-[2rem] p-6 sm:p-8 text-center shadow-2xl">
              <div className="text-6xl mb-3">🐚</div>
              <h2 className="font-display text-3xl sm:text-4xl font-black text-amber-300 mb-2">You know the basics!</h2>
              <ul className="text-left text-sm sm:text-base text-emerald-100 space-y-1.5 my-4 mx-auto max-w-sm">
                <li>🌱 Sow counter-clockwise, one seed per pit.</li>
                <li>🔁 Land on a filled pit and the relay keeps going.</li>
                <li>🎯 End in an empty pit on your side to capture the seeds opposite.</li>
                <li>🏆 Capture 25 seeds to win. Watch out: the other side can do the same to you.</li>
              </ul>
              <div className="flex flex-col sm:flex-row gap-2.5 justify-center mt-5">
                <button onClick={() => { playAyoClick(); onPlay('daily'); }} className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-black py-3 px-6 rounded-full border-b-4 border-amber-600 shadow-xl">
                  🔥 Play today's Daily Ayò
                </button>
                <button onClick={() => { playAyoClick(); onPlay('ai'); }} className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-full border-b-4 border-emerald-900">
                  Play a practice game
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-black/30 border border-white/15 rounded-[2rem] p-4 sm:p-6 shadow-2xl">
              <div className="text-[11px] font-black tracking-widest text-amber-300/90 uppercase mb-1">
                Lesson {lessonIdx + 1} of {LESSONS.length}
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-black text-white mb-2">{lesson.title}</h2>
              <p className="text-sm sm:text-base text-emerald-100 leading-snug min-h-[4.5rem]" aria-live="polite">
                {phase === 'result' ? lesson.result : lesson.intro}
              </p>

              {/* Board: their row on top (travelling left), yours below (travelling right). */}
              <div className="mt-4 rounded-[1.6rem] p-3 sm:p-4 border-4 border-amber-500/80 shadow-xl"
                style={{ background: 'linear-gradient(155deg, #7c3a14 0%, #59260a 48%, #3e1905 100%)' }}>
                <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold text-amber-100/80 mb-1.5 px-1">
                  <span>Opponent's row ←</span>
                  <span className="tabular-nums">Opponent captured: {scores[1]}</span>
                </div>
                <div className="grid grid-cols-6 gap-1.5 sm:gap-3">
                  {[11, 10, 9, 8, 7, 6].map(renderPit)}
                </div>
                <div className="h-2" />
                <div className="grid grid-cols-6 gap-1.5 sm:gap-3">
                  {[0, 1, 2, 3, 4, 5].map(renderPit)}
                </div>
                <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold text-amber-100/80 mt-1.5 px-1">
                  <span>Your row →</span>
                  <span className={`tabular-nums ${scores[0] > 0 ? 'text-amber-300 font-black' : ''}`}>You captured: {scores[0]}</span>
                </div>
              </div>

              <div className="h-6 mt-2 text-center text-xs sm:text-sm font-bold text-amber-200" aria-live="polite">
                {phase === 'animating' && handSeeds > 0 && `✋ ${handSeeds} seed${handSeeds === 1 ? '' : 's'} in hand...`}
                {phase === 'intro' && nudge && 'Tap the glowing pit for this lesson.'}
              </div>

              <div className="flex justify-end mt-2 min-h-[3rem]">
                {phase === 'result' && (
                  <button onClick={next} className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-black py-3 px-7 rounded-full border-b-4 border-amber-600 shadow-xl">
                    {lessonIdx < LESSONS.length - 1 ? 'Next lesson →' : 'Finish ✓'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AyoTutorial;
