// ayo-app/AyoApp.tsx - Full-featured, accessible Ayò Ọlọ́pọ́n v2 (AI, Online 1v1, Pass & Play, Challenges, 3D View, Seed Skins, Pictorial Guide)
import React, { useState, useEffect, useRef } from 'react';
import {
  AyoState, AyoDifficulty, AyoRuleSet, AyoChallenge,
  AI_OPPONENTS, SEED_SKINS, AYO_CHALLENGES,
  createAyoGame, applyAyoMove, getLegalMoves, chooseAyoAIMove,
} from './engine';
import {
  playSeedClack, playSeedScoop, playCaptureSound, playAyoClick, playAyoWinSound,
  playAyoGoodGameSound, setAyoMuted, isAyoMuted,
} from './sounds';
import {
  createAyoOnlineRoom, getAyoInviteUrl, useAyoOnlineRoom,
} from './online';
import { loadNickname, saveNickname } from '../core/online';

interface AyoProfile {
  xp: number;
  wins: number;
  games: number;
  skinId: string;
}

const PROFILE_KEY = 'ayo-olopon-profile-v2';

const loadProfile = (): AyoProfile => {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return { xp: 0, wins: 0, games: 0, skinId: 'classic', ...JSON.parse(raw) };
  } catch {}
  return { xp: 0, wins: 0, games: 0, skinId: 'classic' };
};

const saveProfile = (p: AyoProfile) => {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {}
};

const getLevel = (xp: number) => Math.floor(xp / 100) + 1;

const REACTIONS = ['👏', '🔥', '😱', '😂', '👑', 'E kú iṣẹ́!'];

const AyoApp: React.FC = () => {
  const [screen, setScreen] = useState<'lobby' | 'game' | 'online'>('lobby');
  const [modeTab, setModeTab] = useState<'ai' | 'online' | 'local' | 'challenge'>('ai');
  const [selectedOppIdx, setSelectedOppIdx] = useState<number>(0);
  const [ruleSet, setRuleSet] = useState<AyoRuleSet>('yoruba_ayo');
  const [sowPace, setSowPace] = useState<'slow' | 'steady' | 'brisk'>('steady');
  const [is3D, setIs3D] = useState<boolean>(true);
  const [muted, setMuted] = useState<boolean>(() => isAyoMuted());
  const [profile, setProfile] = useState<AyoProfile>(() => loadProfile());
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [showSkins, setShowSkins] = useState<boolean>(false);

  // Solo / Local / Challenge game state
  const [gameState, setGameState] = useState<AyoState | null>(null);
  const [displayPits, setDisplayPits] = useState<number[]>(Array(12).fill(4));
  const [displayScores, setDisplayScores] = useState<[number, number]>([0, 0]);
  const [animatingPit, setAnimatingPit] = useState<number | null>(null);
  const [animStepKind, setAnimStepKind] = useState<'drop' | 'scoop' | 'capture' | null>(null);
  const [seedsInHand, setSeedsInHand] = useState<number>(0);
  const [capturedPits, setCapturedPits] = useState<number[]>([]);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [captureFlash, setCaptureFlash] = useState<string | null>(null);
  const [activeChallenge, setActiveChallenge] = useState<AyoChallenge | null>(null);
  const [isPassAndPlay, setIsPassAndPlay] = useState<boolean>(false);
  const [lastXpEarned, setLastXpEarned] = useState<number>(0);
  const [shareCopied, setShareCopied] = useState<boolean>(false);

  // Online 1v1 state
  const [nickname, setNickname] = useState<string>(() => loadNickname());
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState<string>('');
  const [onlineBusy, setOnlineBusy] = useState<boolean>(false);
  const [onlineErr, setOnlineErr] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState<boolean>(false);

  const online = useAyoOnlineRoom(roomCode, nickname);
  const animTimersRef = useRef<number[]>([]);

  const level = getLevel(profile.xp);
  const xpInLevel = profile.xp % 100;
  const currentSkin = SEED_SKINS.find((s) => s.id === profile.skinId) || SEED_SKINS[0];
  const opponent = AI_OPPONENTS[selectedOppIdx];

  // Deep-link ?room=XXXX check
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('room')?.trim().toUpperCase();
    if (code && /^[A-Z0-9]{4,6}$/.test(code)) {
      setJoinInput(code);
      setRoomCode(code);
      setScreen('online');
    }
  }, []);

  const clearAnimTimers = () => {
    animTimersRef.current.forEach((id) => clearTimeout(id));
    animTimersRef.current = [];
  };

  useEffect(() => () => clearAnimTimers(), []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setAyoMuted(next);
  };

  const awardXp = (won: boolean) => {
    const earned = won ? 45 : 15; // Always reward effort — zero-shame progression!
    setLastXpEarned(earned);
    setProfile((prev) => {
      const updated: AyoProfile = {
        ...prev,
        xp: prev.xp + earned,
        wins: prev.wins + (won ? 1 : 0),
        games: prev.games + 1,
      };
      saveProfile(updated);
      return updated;
    });
  };

  const startLocalGame = (passPlay: boolean, challenge?: AyoChallenge) => {
    playAyoClick();
    clearAnimTimers();
    setIsAnimating(false);
    setAnimatingPit(null);
    setCapturedPits([]);
    setCaptureFlash(null);
    setLastXpEarned(0);
    setIsPassAndPlay(passPlay);
    setActiveChallenge(challenge || null);

    const rules: AyoRuleSet = challenge ? 'oware' : ruleSet;
    const init = createAyoGame(rules, challenge?.pits, challenge?.scores);
    if (challenge) {
      init.lastAction = `🧩 ${challenge.title}: ${challenge.goal}`;
    } else if (passPlay) {
      init.lastAction = 'Ìsàlẹ̀ (South) goes first! Tap a pit on the bottom row.';
    } else {
      init.lastAction = `Your turn against ${opponent.name}! Tap any pit on your row.`;
    }
    setGameState(init);
    setDisplayPits([...init.pits]);
    setDisplayScores([init.scores[0], init.scores[1]]);
    setScreen('game');
  };

  const executeMove = (state: AyoState, pit: number) => {
    const names: [string, string] = isPassAndPlay
      ? ['Ìsàlẹ̀ (South)', 'Òkè (North)']
      : ['You', opponent.name];

    const { nextState, steps, captured } = applyAyoMove(state, pit, names);
    if (steps.length === 0) return;

    setIsAnimating(true);
    clearAnimTimers();

    // Immediate tactile seed-scoop rattle when lifting seeds from the chosen pit
    playSeedScoop(state.pits[pit]);

    // Deliberate, calm wooden-board sowing rhythm so every seed drop, relay scoop, and 4-seed capture is effortless to follow
    const baseDelay = sowPace === 'slow' ? 920 : sowPace === 'brisk' ? 380 : 680;
    let elapsed = 260;

    steps.forEach((step, i) => {
      const tid = window.setTimeout(() => {
        setDisplayPits(step.pits);
        setDisplayScores(step.scores);
        setAnimatingPit(step.activePit);
        setAnimStepKind(step.kind);
        setSeedsInHand(step.seedsInHand);

        if (step.kind === 'capture' && step.capturedPits && step.capturedPits.length > 0) {
          setCapturedPits(step.capturedPits);
          playCaptureSound(step.capturedCount || 4);
          const capLabel = step.capturedBy !== undefined
            ? `${names[step.capturedBy]} +${step.capturedCount}`
            : `+${step.capturedCount} Captured`;
          setCaptureFlash(capLabel);
          window.setTimeout(() => setCaptureFlash(null), 1300);
        } else if (step.kind === 'scoop') {
          setCapturedPits([]);
          playSeedScoop(step.seedsInHand);
        } else {
          setCapturedPits([]);
          playSeedClack(i, step.pits[step.activePit]);
        }
      }, elapsed);
      animTimersRef.current.push(tid);

      // Generous pauses on relay scoops and 4-seed captures so the board breathes naturally
      elapsed += step.kind === 'capture' ? baseDelay + 560 : step.kind === 'scoop' ? baseDelay + 420 : baseDelay;
    });

    const endTid = window.setTimeout(() => {
      setGameState(nextState);
      setDisplayPits([...nextState.pits]);
      setDisplayScores([nextState.scores[0], nextState.scores[1]]);
      setAnimatingPit(null);
      setAnimStepKind(null);
      setSeedsInHand(0);
      setCapturedPits([]);
      setIsAnimating(false);

      if (nextState.winner !== null) {
        const humanWon = isPassAndPlay ? true : nextState.winner === 0;
        if (humanWon) playAyoWinSound();
        else playAyoGoodGameSound();
        if (!isPassAndPlay) awardXp(nextState.winner === 0);
      } else if (captured >= 4) {
        setCaptureFlash(`Master Capture +${captured}`);
        window.setTimeout(() => setCaptureFlash(null), 1300);
      }
    }, elapsed + 380);
    animTimersRef.current.push(endTid);
  };

  // AI Turn trigger (calm pause before AI begins sowing)
  useEffect(() => {
    if (screen !== 'game' || !gameState || isAnimating || isPassAndPlay) return;
    if (gameState.winner !== null || gameState.turn !== 1) return;

    const diff: AyoDifficulty = activeChallenge ? activeChallenge.difficulty : opponent.difficulty;
    const tid = window.setTimeout(() => {
      const move = chooseAyoAIMove(gameState, diff);
      if (move !== null) {
        executeMove(gameState, move);
      }
    }, 1250);
    return () => clearTimeout(tid);
  }, [screen, gameState, isAnimating, isPassAndPlay, opponent, activeChallenge]);

  // Online helpers
  const openOnlineRoom = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,6}$/.test(clean)) {
      setOnlineErr('Enter a valid 4-letter room code.');
      return;
    }
    saveNickname(nickname || 'Player');
    setOnlineErr(null);
    setRoomCode(clean);
    setScreen('online');
    const u = new URL(window.location.href);
    u.searchParams.set('room', clean);
    window.history.replaceState(null, '', u.toString());
  };

  const handleCreateRoom = async () => {
    playAyoClick();
    setOnlineBusy(true);
    setOnlineErr(null);
    try {
      const code = await createAyoOnlineRoom();
      openOnlineRoom(code);
    } catch (e) {
      setOnlineErr(e instanceof Error ? e.message : 'Could not create room.');
    } finally {
      setOnlineBusy(false);
    }
  };

  const leaveOnline = () => {
    playAyoClick();
    setRoomCode(null);
    setScreen('lobby');
    const u = new URL(window.location.href);
    u.searchParams.delete('room');
    window.history.replaceState(null, '', u.toString());
  };

  // Render seeds inside a pit (visual cluster + crisp accessible count badge)
  const renderSeeds = (count: number) => {
    const visible = Math.min(count, 12);
    return (
      <div className="relative w-full h-full flex flex-wrap items-center justify-center content-center gap-1 p-1.5 pointer-events-none">
        {Array.from({ length: visible }, (_, i) => (
          <span
            key={i}
            className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full shadow-md inline-block transition-transform duration-200"
            style={{
              background: currentSkin.gradient,
              border: `1.5px solid ${currentSkin.border}`,
              transform: `translate(${((i % 3) - 1) * 1.5}px, ${((i % 2) - 0.5) * 1.5}px)`,
            }}
          />
        ))}
      </div>
    );
  };

  // Render carved hardwood Ayò board (shared between Solo, Pass & Play, and Online 1v1!)
  const renderBoard = (
    pits: number[],
    scores: [number, number],
    legalMoves: number[],
    canInteract: boolean,
    onPitClick: (pit: number) => void,
    flipPerspective: boolean,
    topLabel: string,
    bottomLabel: string,
    topActive: boolean,
    bottomActive: boolean
  ) => {
    // Bottom row is always the viewer's side; Top row is opponent's side (reversed so counter-clockwise flows naturally!)
    const bottomIndices = flipPerspective ? [6, 7, 8, 9, 10, 11] : [0, 1, 2, 3, 4, 5];
    const topIndices = flipPerspective ? [5, 4, 3, 2, 1, 0] : [11, 10, 9, 8, 7, 6];
    const topScore = flipPerspective ? scores[0] : scores[1];
    const bottomScore = flipPerspective ? scores[1] : scores[0];

    return (
      <div className="w-full max-w-4xl mx-auto" style={{ perspective: is3D ? '1100px' : undefined }}>
        {/* Top Row Header */}
        <div className="flex items-center justify-between mb-2.5 px-2">
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold border-2 transition-all ${
            topActive ? 'bg-amber-400 text-slate-950 border-yellow-200 scale-105 shadow-lg' : 'bg-black/45 text-emerald-100 border-white/15'
          }`}>
            <span>{topLabel}</span>
            {topActive && <span className="animate-pulse">⏳</span>}
          </div>
          <div className="bg-black/50 border border-amber-400/40 px-4 py-1.5 rounded-full font-display font-black text-amber-300 text-sm sm:text-base tabular-nums">
            Captured: {topScore} / 25
          </div>
        </div>

        {/* Carved Hardwood Ọpọ́n Board */}
        <div
          className="relative rounded-[2.2rem] p-4 sm:p-6 shadow-[0_28px_60px_rgba(0,0,0,0.65)] border-4 border-amber-500/80 transition-transform duration-500"
          style={{
            background: 'linear-gradient(155deg, #7c3a14 0%, #59260a 48%, #3e1905 100%)',
            transform: is3D ? 'rotateX(14deg)' : 'none',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Decorative wood grain sheen */}
          <div className="absolute inset-0 rounded-[2rem] opacity-20 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 2px, transparent 2px, transparent 18px)' }} />

          {/* Top Row (Opponent) */}
          <div className="grid grid-cols-6 gap-2 sm:gap-3.5 mb-3 sm:mb-4 relative z-10">
            {topIndices.map((pitIdx) => {
              const count = pits[pitIdx];
              const isLegal = canInteract && legalMoves.includes(pitIdx);
              const isActive = animatingPit === pitIdx;
              const isCaptured = capturedPits.includes(pitIdx);
              return (
                <button
                  key={pitIdx}
                  type="button"
                  disabled={!isLegal}
                  onClick={() => isLegal && onPitClick(pitIdx)}
                  aria-label={`${topLabel} pit ${(pitIdx % 6) + 1}, ${count} seeds${isLegal ? ', playable' : ''}`}
                  className={`relative aspect-square rounded-full flex items-center justify-center transition-all duration-200 border-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300 ${
                    isCaptured
                      ? 'bg-emerald-900 border-emerald-300 ring-4 ring-emerald-400 scale-105'
                      : isActive
                        ? 'bg-amber-900 border-yellow-300 ring-4 ring-yellow-300 scale-105'
                        : isLegal
                          ? 'bg-[#2c1104] border-amber-400 hover:scale-105 hover:ring-4 hover:ring-yellow-300 cursor-pointer shadow-[inset_0_8px_18px_rgba(0,0,0,0.85)]'
                          : 'bg-[#2c1104] border-amber-800/70 cursor-default shadow-[inset_0_8px_18px_rgba(0,0,0,0.85)]'
                  }`}
                >
                  {renderSeeds(count)}
                  <span className="absolute -top-2 -right-1 bg-slate-950 text-amber-200 border border-amber-400/60 font-display font-black text-xs sm:text-sm min-w-[26px] h-[26px] px-1.5 rounded-full flex items-center justify-center shadow tabular-nums">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Center Wood Divider */}
          <div className="h-1.5 rounded-full bg-gradient-to-r from-amber-900 via-amber-400/50 to-amber-900 mb-3 sm:mb-4 opacity-70" />

          {/* Bottom Row (Player) */}
          <div className="grid grid-cols-6 gap-2 sm:gap-3.5 relative z-10">
            {bottomIndices.map((pitIdx) => {
              const count = pits[pitIdx];
              const isLegal = canInteract && legalMoves.includes(pitIdx);
              const isActive = animatingPit === pitIdx;
              const isCaptured = capturedPits.includes(pitIdx);
              return (
                <button
                  key={pitIdx}
                  type="button"
                  disabled={!isLegal}
                  onClick={() => isLegal && onPitClick(pitIdx)}
                  aria-label={`${bottomLabel} pit ${(pitIdx % 6) + 1}, ${count} seeds${isLegal ? ', playable' : ''}`}
                  className={`relative aspect-square rounded-full flex items-center justify-center transition-all duration-200 border-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300 ${
                    isCaptured
                      ? 'bg-emerald-900 border-emerald-300 ring-4 ring-emerald-400 scale-105'
                      : isActive
                        ? 'bg-amber-900 border-yellow-300 ring-4 ring-yellow-300 scale-105'
                        : isLegal
                          ? 'bg-[#2c1104] border-yellow-300 hover:scale-105 hover:ring-4 hover:ring-yellow-300 cursor-pointer shadow-[inset_0_8px_18px_rgba(0,0,0,0.85)]'
                          : 'bg-[#2c1104] border-amber-900/60 opacity-75 cursor-default shadow-[inset_0_8px_18px_rgba(0,0,0,0.85)]'
                  }`}
                >
                  {renderSeeds(count)}
                  <span className={`absolute -bottom-2 -right-1 border font-display font-black text-xs sm:text-sm min-w-[26px] h-[26px] px-1.5 rounded-full flex items-center justify-center shadow tabular-nums ${
                    isLegal ? 'bg-yellow-400 text-slate-950 border-white' : 'bg-slate-950 text-amber-200 border-amber-400/60'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Row Header */}
        <div className="flex items-center justify-between mt-3 px-2">
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold border-2 transition-all ${
            bottomActive ? 'bg-yellow-400 text-slate-950 border-white scale-105 shadow-lg' : 'bg-black/45 text-emerald-100 border-white/15'
          }`}>
            <span>{bottomLabel}</span>
            {bottomActive && <span>◀ Your Move</span>}
          </div>
          <div className="bg-black/50 border border-emerald-400/50 px-4 py-1.5 rounded-full font-display font-black text-emerald-300 text-sm sm:text-base tabular-nums">
            Captured: {bottomScore} / 25
          </div>
        </div>
      </div>
    );
  };

  // --- PICTORIAL VISUAL GUIDE MODAL ---
  const renderPictorialGuide = () => (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[100] p-4">
      <div className="bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-950 text-white p-6 rounded-[2rem] max-w-xl w-full relative shadow-2xl border-4 border-amber-400 max-h-[90vh] overflow-y-auto">
        <button
          onClick={() => setShowGuide(false)}
          className="absolute top-4 right-4 text-xl bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full font-bold"
          aria-label="Close guide"
        >
          ✕
        </button>

        <h2 className="font-display text-2xl sm:text-3xl font-black text-amber-300 text-center mb-4">
          🐚 How to Play Ayò Ọlọ́pọ́n
        </h2>

        {/* Mini Visual Board Diagram */}
        <div className="bg-[#4b2009] border-2 border-amber-400 rounded-2xl p-3.5 mb-4 text-center">
          <div className="text-[11px] font-bold text-amber-200 mb-1.5">⬅️ Counter-Clockwise Relay Sowing (Nigerian Yorùbá Ayò)</div>
          <div className="grid grid-cols-6 gap-1.5 mb-2">
            {[4, 4, 4, 3, 4, 4].map((n, i) => (
              <div key={i} className={`py-2 rounded-full font-display font-black text-sm border ${i === 3 ? 'bg-emerald-700 border-emerald-300 text-white' : 'bg-[#2a1003] border-amber-700 text-amber-200'}`}>
                {i === 3 ? '3+1=4!' : n}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {[4, 4, 4, 4, 0, 4].map((n, i) => (
              <div key={i} className={`py-2 rounded-full font-display font-black text-sm border ${i === 4 ? 'bg-amber-400 text-slate-950 border-white' : 'bg-[#2a1003] border-amber-700 text-amber-200'}`}>
                {i === 4 ? '✋' : n}
              </div>
            ))}
          </div>
          <div className="text-[11px] font-bold text-emerald-200 mt-1.5">
            Any pit reaching 4 seeds is CAPTURED! Land on a non-empty pit? Scoop &amp; keep sowing! ➡️
          </div>
        </div>

        <ul className="space-y-2.5 text-sm text-emerald-50 mb-5">
          <li><strong>🌱 Counter-Clockwise Sowing:</strong> Pick up all seeds from any pit on your row and drop them one by one counter-clockwise.</li>
          <li><strong>🔄 Relay Sowing (Continuous Play):</strong> If your last seed lands in a pit that already has seeds, <strong>scoop up all seeds</strong> in that pit and keep sowing! Your turn ends when your last seed lands in an empty pit (making 1) or completes a 4-seed capture.</li>
          <li><strong>🔥 4-Seed Capture (Yorùbá Rule):</strong> Whenever a pit reaches <strong>4 seeds</strong> during sowing, those 4 seeds are captured immediately (by the pit’s owner mid-sow, or by YOU if it was your final seed!).</li>
          <li><strong>🤝 Golden Rule (Feed Opponent):</strong> If your opponent’s row is empty, you must play a move that drops seeds into their row if possible.</li>
          <li><strong>🏆 Win:</strong> First player to capture <strong>25 or more seeds</strong> out of 48 wins!</li>
        </ul>

        <button
          onClick={() => setShowGuide(false)}
          className="w-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-black py-3 rounded-xl border-b-4 border-amber-600 text-lg"
        >
          Got It — Let&apos;s Play! 🐚
        </button>
      </div>
    </div>
  );

  // --- SEED SKINS MODAL ---
  const renderSkinsModal = () => (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[100] p-4">
      <div className="bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-950 text-white p-6 rounded-[2rem] max-w-md w-full relative shadow-2xl border-4 border-amber-400 max-h-[90vh] overflow-y-auto">
        <button onClick={() => setShowSkins(false)} className="absolute top-4 right-4 text-xl bg-white/10 px-3 py-1 rounded-full font-bold">✕</button>
        <h2 className="font-display text-2xl font-black text-amber-300 text-center mb-1">🎨 Seed Skins</h2>
        <p className="text-xs text-emerald-200 text-center mb-4">You are Level {level} ({profile.xp} XP) — earn XP every match!</p>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {SEED_SKINS.map((skin) => {
            const unlocked = level >= skin.unlockLevel;
            const active = profile.skinId === skin.id;
            return (
              <button
                key={skin.id}
                disabled={!unlocked}
                onClick={() => {
                  playAyoClick();
                  const next = { ...profile, skinId: skin.id };
                  setProfile(next);
                  saveProfile(next);
                }}
                className={`p-3.5 rounded-2xl border-2 text-center transition-all ${
                  active
                    ? 'border-amber-400 bg-amber-400/20'
                    : unlocked
                      ? 'border-white/20 bg-white/5 hover:bg-white/15'
                      : 'border-white/10 bg-black/30 opacity-50 cursor-not-allowed'
                }`}
              >
                <div
                  className="w-10 h-10 rounded-full mx-auto mb-2 shadow-lg"
                  style={{ background: skin.gradient, border: `2px solid ${skin.border}` }}
                />
                <div className="font-bold text-sm">{skin.emoji} {skin.name}</div>
                <div className="text-[11px] text-emerald-200 mt-0.5">
                  {active ? '✓ Active' : unlocked ? 'Tap to equip' : `🔒 Level ${skin.unlockLevel}`}
                </div>
              </button>
            );
          })}
        </div>
        <button onClick={() => setShowSkins(false)} className="w-full bg-amber-400 text-slate-950 font-display font-black py-2.5 rounded-xl border-b-4 border-amber-600">
          Done
        </button>
      </div>
    </div>
  );

  // =========================================================================
  // 1. ONLINE 1v1 ROOM SCREEN
  // =========================================================================
  if (screen === 'online' && roomCode) {
    const v = online.view;
    const inviteUrl = getAyoInviteUrl(roomCode);
    const isHost = v?.you === 0;
    const mySeat = v?.you ?? 0;

    const handleCopyInvite = async () => {
      playAyoClick();
      try {
        await navigator.clipboard.writeText(inviteUrl);
        setInviteCopied(true);
        setTimeout(() => setInviteCopied(false), 2400);
      } catch {}
    };

    const handleShareInvite = async () => {
      playAyoClick();
      const text = `🐚 Challenge me to Ayò Ọlọ́pọ́n (Yorùbá Mancala) live! Join Room ${roomCode}:\n${inviteUrl}`;
      try {
        if (navigator.share) {
          await navigator.share({ title: `Ayò Ọlọ́pọ́n — Room ${roomCode}`, text, url: inviteUrl });
          return;
        }
      } catch {}
      handleCopyInvite();
    };

    if (!v || v.phase === 'lobby') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-green-950 to-slate-950 text-white flex flex-col items-center justify-center p-4">
          <button onClick={leaveOnline} className="fixed top-4 left-4 bg-black/45 hover:bg-black/65 px-4 py-2 rounded-full text-xs sm:text-sm font-bold border border-white/20">
            ← Leave Room
          </button>

          <div className="bg-white/10 backdrop-blur-md p-6 sm:p-8 rounded-[2rem] border-2 border-amber-400/50 shadow-2xl max-w-3xl w-full grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full text-xs font-bold text-emerald-200 mb-2">
                <span className={`w-2.5 h-2.5 rounded-full ${online.status === 'connected' ? 'bg-emerald-400' : 'bg-yellow-400 animate-pulse'}`} />
                Online 1v1 Ayò Room
              </div>
              <h1 className="font-display text-5xl font-black tracking-widest text-amber-300 tabular-nums mb-1">{roomCode}</h1>
              <p className="text-xs sm:text-sm text-emerald-100 mb-4">Send the invite link on WhatsApp — zero sign-up!</p>

              <div className="flex gap-2 mb-4">
                <button onClick={handleCopyInvite} className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-2.5 px-3 rounded-xl border-b-4 border-emerald-900 text-sm">
                  {inviteCopied ? '✓ Link Copied!' : '📋 Copy Invite'}
                </button>
                <button onClick={handleShareInvite} className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black py-2.5 px-4 rounded-xl border-b-4 border-amber-600 text-sm">
                  📤 Share
                </button>
              </div>

              {online.error && (
                <div className="mb-3 bg-red-800/90 border border-red-300 text-white text-xs font-bold px-3 py-2 rounded-xl">
                  ⚠️ {online.error}
                </div>
              )}

              {isHost ? (
                <button
                  disabled={(v?.seats.length ?? 0) < 2}
                  onClick={() => { playAyoClick(); online.sendStart(ruleSet); }}
                  className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-display font-black py-3.5 rounded-2xl text-lg border-b-4 border-amber-600 transition-all"
                >
                  {(v?.seats.length ?? 0) < 2 ? 'Waiting for Friend to Join...' : 'START 1v1 MATCH ▶'}
                </button>
              ) : (
                <div className="bg-black/35 rounded-xl p-3 text-sm font-bold text-amber-200 text-center animate-pulse">
                  ⏳ Waiting for {v?.seats[0]?.name || 'Host'} to start...
                </div>
              )}
            </div>

            <div className="bg-black/30 rounded-2xl p-4 border border-white/15 space-y-2.5">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-200">Players ({v?.seats.length ?? 0} / 2)</div>
              {[0, 1].map((idx) => {
                const s = v?.seats[idx];
                return s ? (
                  <div key={idx} className={`flex items-center justify-between px-3.5 py-3 rounded-xl border ${mySeat === idx ? 'bg-amber-400/20 border-amber-400' : 'bg-white/10 border-white/15'}`}>
                    <span className="font-bold text-sm">{idx === 0 ? '👑' : '🐚'} {s.name} {mySeat === idx && '(You)'}</span>
                    <span className="text-xs font-bold text-emerald-300">Ready</span>
                  </div>
                ) : (
                  <div key={idx} className="px-3.5 py-3 rounded-xl border border-dashed border-white/20 text-sm text-emerald-200/70">
                    Waiting for opponent...
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    const g = v.game!;
    const flip = mySeat === 1;
    const isMyTurn = v.phase === 'playing' && g.turn === mySeat;
    const legal = isMyTurn ? getLegalMoves(g) : [];
    const oppIdx = mySeat === 0 ? 1 : 0;
    const oppSeat = v.seats[oppIdx];
    const meSeat = v.seats[mySeat];

    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-green-950 to-slate-950 text-white flex flex-col justify-between p-4">
        <div className="max-w-5xl w-full mx-auto flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button onClick={leaveOnline} className="bg-red-700 hover:bg-red-600 px-3.5 py-1.5 rounded-full text-xs font-bold border-b-4 border-red-900">
              LEAVE
            </button>
            <button onClick={handleCopyInvite} className="bg-black/45 px-3.5 py-1.5 rounded-full text-xs font-black text-amber-300 border border-amber-400/40 tabular-nums">
              {inviteCopied ? '✓ Copied' : `🌐 Room ${v.code}`}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIs3D(!is3D)} className="bg-black/45 px-3 py-1.5 rounded-full text-xs font-bold border border-white/20">
              {is3D ? '🧊 3D On' : '📐 2D View'}
            </button>
            <button onClick={toggleMute} className="bg-black/45 px-3 py-1.5 rounded-full text-sm border border-white/20" aria-label="Toggle sound">
              {muted ? '🔇' : '🔊'}
            </button>
          </div>
        </div>

        <div className="my-auto py-4">
          <div aria-live="polite" className="text-center mb-3">
            <span className="inline-block bg-black/50 border border-white/20 px-5 py-1.5 rounded-full text-sm font-bold text-amber-100">
              {g.lastAction}
            </span>
          </div>

          {online.reactions.length > 0 && (
            <div className="text-center mb-2">
              <span className="inline-block bg-white text-slate-950 font-display font-black px-4 py-1 rounded-full border-2 border-amber-400 shadow-xl animate-bounce">
                {v.seats[online.reactions[online.reactions.length - 1].seat]?.name}: {online.reactions[online.reactions.length - 1].emoji}
              </span>
            </div>
          )}

          {renderBoard(
            g.pits,
            g.scores,
            legal,
            isMyTurn,
            (pit) => { playSeedClack(pit); online.sendMove(pit); },
            flip,
            `${oppSeat?.name || 'Opponent'} (🏆 ${oppSeat?.wins ?? 0})`,
            `${meSeat?.name || 'You'} (🏆 ${meSeat?.wins ?? 0})`,
            v.phase === 'playing' && g.turn === oppIdx,
            isMyTurn
          )}

          {/* Reactions Bar */}
          <div className="flex justify-center mt-5">
            <div className="flex items-center gap-1.5 bg-black/45 px-3 py-1.5 rounded-full border border-white/15">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { playAyoClick(); online.sendReact(emoji); }}
                  className="hover:scale-125 transition-transform px-2 py-0.5 text-sm font-black"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Online End Banner */}
          {v.phase === 'over' && (
            <div className="max-w-md mx-auto mt-5 bg-white/10 backdrop-blur-md border-2 border-amber-400 rounded-3xl p-5 text-center shadow-2xl">
              <div className="text-5xl mb-2">{g.winner === mySeat ? '🏆' : g.winner === 'draw' ? '🤝' : '🙌'}</div>
              <h2 className="font-display text-3xl font-black text-amber-300 mb-1">
                {g.winner === mySeat ? 'YOU WON!' : g.winner === 'draw' ? 'NOBLE DRAW!' : 'GOOD GAME!'}
              </h2>
              <p className="text-sm text-emerald-100 mb-4">{g.lastAction}</p>
              <div className="flex gap-3 justify-center">
                <button onClick={leaveOnline} className="bg-slate-700 hover:bg-slate-600 px-5 py-2.5 rounded-full font-bold text-sm">
                  Leave
                </button>
                {isHost ? (
                  <button onClick={() => online.sendStart(g.ruleSet)} className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-black px-6 py-2.5 rounded-full text-sm border-b-4 border-amber-600">
                    ⚡ Rematch!
                  </button>
                ) : (
                  <span className="text-xs text-amber-200 self-center animate-pulse">Waiting for host rematch...</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. SOLO / PASS & PLAY / CHALLENGE GAME SCREEN
  // =========================================================================
  if (screen === 'game' && gameState) {
    const canMove = !isAnimating && gameState.winner === null && (isPassAndPlay || gameState.turn === 0);
    const legal = canMove ? getLegalMoves(gameState) : [];
    const humanWon = gameState.winner === 0;
    const closeMatch = Math.abs(gameState.scores[0] - gameState.scores[1]) <= 4;

    const handleShareResult = async () => {
      playAyoClick();
      const text = humanWon
        ? `🐚 I just beat ${opponent.name} (${gameState.scores[0]}–${gameState.scores[1]}) in Ayò Ọlọ́pọ́n! Can you outcalculate the Ọpọ́n?\nhttps://www.jackattackstreets.com/ayo/`
        : `🐚 Just played an intense match of Ayò Ọlọ́pọ́n (${gameState.scores[0]}–${gameState.scores[1]})! Play free in your browser:\nhttps://www.jackattackstreets.com/ayo/`;
      try {
        if (navigator.share) {
          await navigator.share({ title: 'Ayò Ọlọ́pọ́n', text, url: 'https://www.jackattackstreets.com/ayo/' });
          return;
        }
      } catch {}
      try {
        await navigator.clipboard.writeText(text);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2400);
      } catch {}
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-green-950 to-slate-950 text-white flex flex-col justify-between p-4 relative overflow-hidden">
        {showGuide && renderPictorialGuide()}
        {showSkins && renderSkinsModal()}

        {/* Capture Impact Callout */}
        {captureFlash && (
          <div className="fixed inset-x-0 top-20 flex justify-center pointer-events-none z-50">
            <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-display font-black text-xl sm:text-2xl px-6 py-2 rounded-full border-4 border-white shadow-2xl animate-bounce">
              {captureFlash}
            </div>
          </div>
        )}

        {/* Top Bar */}
        <header className="max-w-5xl w-full mx-auto flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button onClick={() => { playAyoClick(); clearAnimTimers(); setScreen('lobby'); }} className="bg-black/45 hover:bg-black/65 px-4 py-2 rounded-full text-xs sm:text-sm font-bold border border-white/20">
              ← Menu
            </button>
            <button onClick={() => setShowGuide(true)} className="bg-black/45 hover:bg-black/65 px-3.5 py-2 rounded-full text-xs sm:text-sm font-bold border border-white/20">
              ❓ Rules
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                playAyoClick();
                setSowPace((p) => (p === 'slow' ? 'steady' : p === 'steady' ? 'brisk' : 'slow'));
              }}
              className="bg-black/45 hover:bg-black/65 px-3.5 py-2 rounded-full text-xs sm:text-sm font-bold border border-emerald-400/40 text-emerald-200"
              title="Change sowing speed"
            >
              {sowPace === 'slow' ? '🐢 Relaxed' : sowPace === 'brisk' ? '⚡ Brisk' : '🪵 Classic'}
            </button>
            <button onClick={() => { playAyoClick(); setIs3D(!is3D); }} className="bg-black/45 hover:bg-black/65 px-3.5 py-2 rounded-full text-xs sm:text-sm font-bold border border-amber-400/40 text-amber-200">
              {is3D ? '🧊 3D View' : '📐 2D View'}
            </button>
            <button onClick={() => setShowSkins(true)} className="bg-black/45 hover:bg-black/65 px-3.5 py-2 rounded-full text-xs sm:text-sm font-bold border border-white/20">
              🎨 Skins
            </button>
            <button onClick={toggleMute} className="bg-black/45 hover:bg-black/65 px-3 py-2 rounded-full text-base border border-white/20" aria-label="Toggle sound">
              {muted ? '🔇' : '🔊'}
            </button>
          </div>
        </header>

        {/* Board Area */}
        <main className="my-auto py-4">
          <div aria-live="polite" className="text-center mb-4 flex items-center justify-center gap-2.5 flex-wrap">
            <span className="inline-block bg-black/50 border border-white/20 px-5 py-2 rounded-full text-sm sm:text-base font-bold text-amber-100 shadow-lg">
              {isAnimating
                ? animStepKind === 'scoop'
                  ? `✋ Scooped ${seedsInHand} seed${seedsInHand === 1 ? '' : 's'} — relay sowing...`
                  : `🌱 Sowing... (${seedsInHand} left in hand)`
                : gameState.lastAction}
            </span>
          </div>

          {renderBoard(
            displayPits,
            displayScores,
            legal,
            canMove,
            (pit) => executeMove(gameState, pit),
            false,
            isPassAndPlay ? 'Òkè (North — Player 2)' : `${opponent.avatar} ${opponent.name} (${opponent.difficulty})`,
            isPassAndPlay ? 'Ìsàlẹ̀ (South — Player 1)' : '😎 You (Ìsàlẹ̀)',
            gameState.winner === null && gameState.turn === 1,
            gameState.winner === null && gameState.turn === 0
          )}
        </main>

        {/* Uplifting End-of-Round Overlay */}
        {gameState.winner !== null && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[90] p-4">
            <div className="bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-950 border-4 border-amber-400 rounded-[2.2rem] p-7 sm:p-8 max-w-md w-full text-center shadow-2xl">
              <div className="text-7xl mb-3 animate-bounce">
                {isPassAndPlay ? '🏆' : humanWon ? '🏆' : gameState.winner === 'draw' ? '🤝' : closeMatch ? '🤝' : '🙌'}
              </div>
              <h2 className="font-display text-4xl sm:text-5xl font-black text-amber-300 mb-2">
                {isPassAndPlay
                  ? (gameState.winner === 0 ? 'SOUTH WINS!' : gameState.winner === 1 ? 'NORTH WINS!' : 'NOBLE DRAW!')
                  : humanWon
                    ? 'YOU WON!'
                    : gameState.winner === 'draw'
                      ? 'NOBLE DRAW!'
                      : closeMatch
                        ? 'SO CLOSE!'
                        : 'GOOD GAME!'}
              </h2>
              <p className="text-base font-bold text-emerald-100 mb-3">
                Final Score: <span className="text-amber-300 font-black tabular-nums">{gameState.scores[0]} – {gameState.scores[1]}</span>
              </p>
              <p className="text-xs italic text-emerald-200/90 bg-black/30 rounded-xl px-3.5 py-2.5 mb-4 border border-white/10">
                {opponent.proverb}
              </p>

              {!isPassAndPlay && lastXpEarned > 0 && (
                <div className="inline-block bg-amber-400/20 border border-amber-400/60 text-amber-200 text-xs font-black px-4 py-1.5 rounded-full mb-5">
                  +{lastXpEarned} XP {humanWon ? 'Victory Bonus!' : 'Good Game Bonus!'} • Level {level}
                </div>
              )}

              <div className="flex flex-wrap gap-2.5 justify-center">
                <button onClick={() => setScreen('lobby')} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-5 rounded-full border-b-4 border-slate-900">
                  Menu
                </button>
                <button onClick={handleShareResult} className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-3 px-5 rounded-full border-b-4 border-emerald-900">
                  {shareCopied ? '✓ Copied!' : '📤 Share'}
                </button>
                <button
                  onClick={() => startLocalGame(isPassAndPlay, activeChallenge || undefined)}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-black py-3 px-6 rounded-full border-b-4 border-amber-600 shadow-xl"
                >
                  {humanWon ? 'Play Again ↺' : '⚡ Rematch!'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 3. FULL-WIDTH 2-COLUMN DESKTOP LOBBY (Start Game always above the fold!)
  // =========================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-green-950 to-slate-950 text-white flex flex-col relative overflow-x-hidden">
      {showGuide && renderPictorialGuide()}
      {showSkins && renderSkinsModal()}

      {/* Top Navigation */}
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-2 flex items-center justify-between gap-3 flex-wrap">
        <a
          href="/"
          className="bg-black/40 hover:bg-black/60 text-emerald-100 hover:text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-full border border-white/20 transition-all"
        >
          ← All Games
        </a>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { playAyoClick(); setShowSkins(true); }}
            className="bg-black/40 hover:bg-black/60 text-amber-200 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold border border-amber-400/40"
          >
            {currentSkin.emoji} Skins
          </button>
          <button
            onClick={() => { playAyoClick(); setShowGuide(true); }}
            className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-4 py-1.5 rounded-full text-xs sm:text-sm font-display font-black border-b-4 border-amber-600"
          >
            ❓ Visual Guide
          </button>
          <button onClick={toggleMute} className="bg-black/40 px-3 py-1.5 rounded-full text-sm border border-white/20" aria-label="Toggle sound">
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>

      {/* Main 2-Column Hub */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* LEFT: Play Hub */}
          <div className="lg:col-span-7 bg-white/10 backdrop-blur-md p-5 sm:p-7 rounded-[2rem] border-2 border-amber-400/35 shadow-2xl flex flex-col justify-between">
            <div className="mb-4">
              <span className="inline-block bg-amber-400/20 text-amber-300 text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full border border-amber-400/40 mb-2">
                Traditional Yorùbá Strategy • 3D &amp; Online
              </span>
              <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tight text-white">
                🐚 AYÒ ỌLỌ́PỌ́N
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-1">
                Pure calculation, wooden percussion, and classic African Mancala — play solo, pass &amp; play, or 1v1 online!
              </p>
            </div>

            {/* Mode Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {[
                { id: 'ai' as const, label: '🥁 vs AI' },
                { id: 'online' as const, label: '🌐 Online 1v1' },
                { id: 'local' as const, label: '👫 Pass & Play' },
                { id: 'challenge' as const, label: '🧩 Challenges' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => { playAyoClick(); setModeTab(t.id); }}
                  className={`py-2.5 px-2 rounded-xl font-bold text-xs sm:text-sm border-b-4 transition-all ${
                    modeTab === t.id
                      ? 'bg-amber-400 border-amber-600 text-slate-950 scale-[1.02]'
                      : 'bg-emerald-900/80 border-emerald-950 text-emerald-100 hover:bg-emerald-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Mode Body */}
            {modeTab === 'ai' && (
              <div className="space-y-4 bg-black/25 p-4 rounded-2xl border border-white/10">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-200 mb-2">Choose Opponent</p>
                  <div className="grid grid-cols-3 gap-2">
                    {AI_OPPONENTS.map((opp, idx) => (
                      <button
                        key={opp.id}
                        onClick={() => { playAyoClick(); setSelectedOppIdx(idx); }}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${
                          selectedOppIdx === idx
                            ? 'bg-amber-400/20 border-amber-400 text-white'
                            : 'bg-white/5 border-white/10 text-emerald-100 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-2xl mb-1">{opp.avatar}</div>
                        <div className="font-display font-black text-sm">{opp.name}</div>
                        <div className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">{opp.difficulty}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1 bg-black/30 p-1 rounded-xl border border-white/10">
                    <button
                      onClick={() => { playAyoClick(); setRuleSet('yoruba_ayo'); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold ${ruleSet === 'yoruba_ayo' ? 'bg-emerald-600 text-white' : 'text-emerald-200'}`}
                    >
                      Yorùbá Ayò (Relay + 4s)
                    </button>
                    <button
                      onClick={() => { playAyoClick(); setRuleSet('oware'); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold ${ruleSet === 'oware' ? 'bg-emerald-600 text-white' : 'text-emerald-200'}`}
                    >
                      Oware (2–3)
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1 bg-black/30 p-1 rounded-xl border border-white/10" aria-label="Sowing pace">
                      {([
                        { id: 'slow' as const, label: 'Relaxed' },
                        { id: 'steady' as const, label: 'Classic' },
                        { id: 'brisk' as const, label: 'Brisk' },
                      ]).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => { playAyoClick(); setSowPace(p.id); }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold ${sowPace === p.id ? 'bg-amber-400 text-slate-950' : 'text-emerald-200'}`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setIs3D(!is3D)} className="text-xs font-bold text-amber-200 bg-black/30 px-3 py-2 rounded-xl border border-white/10">
                      {is3D ? '3D' : '2D'}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => startLocalGame(false)}
                  className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-display font-black py-3.5 px-6 rounded-2xl text-xl border-b-4 border-orange-700 shadow-xl transition-all hover:scale-[1.01]"
                >
                  START MATCH vs {opponent.name.toUpperCase()} ▶
                </button>
              </div>
            )}

            {modeTab === 'online' && (
              <div className="space-y-3 bg-black/25 p-4 rounded-2xl border border-white/10">
                <div>
                  <label className="block text-xs font-bold uppercase text-emerald-200 mb-1">Your Nickname</label>
                  <input
                    type="text"
                    maxLength={16}
                    value={nickname}
                    onChange={(e) => { setNickname(e.target.value); saveNickname(e.target.value); }}
                    placeholder="Enter nickname"
                    className="w-full px-4 py-2.5 rounded-xl bg-emerald-950/90 border-2 border-emerald-500/40 focus:border-amber-400 focus:outline-none text-white font-bold text-sm"
                  />
                </div>
                {onlineErr && <p className="text-xs font-bold text-red-200 bg-red-800/60 px-3 py-1.5 rounded-lg">⚠️ {onlineErr}</p>}
                <button
                  onClick={handleCreateRoom}
                  disabled={onlineBusy}
                  className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-display font-black py-3 rounded-xl text-lg border-b-4 border-orange-700"
                >
                  {onlineBusy ? 'Creating Room...' : '✨ Create 1v1 Room & Invite Friend'}
                </button>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={joinInput}
                    onChange={(e) => setJoinInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    onKeyDown={(e) => { if (e.key === 'Enter' && joinInput.length >= 4) openOnlineRoom(joinInput); }}
                    placeholder="ROOM CODE"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-950/90 border-2 border-emerald-500/40 focus:border-amber-400 focus:outline-none text-white font-display font-black tracking-widest uppercase text-center text-sm"
                  />
                  <button onClick={() => openOnlineRoom(joinInput)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-display font-black px-5 py-2.5 rounded-xl border-b-4 border-emerald-800 text-sm">
                    Join ▶
                  </button>
                </div>
              </div>
            )}

            {modeTab === 'local' && (
              <div className="space-y-4 bg-black/25 p-4 rounded-2xl border border-white/10">
                <p className="text-sm text-emerald-100">
                  Play face-to-face on one screen! <strong>Ìsàlẹ̀ (South)</strong> controls the bottom row and <strong>Òkè (North)</strong> controls the top row.
                </p>
                <button
                  onClick={() => startLocalGame(true)}
                  className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-display font-black py-3.5 rounded-2xl text-xl border-b-4 border-orange-700 shadow-xl"
                >
                  START PASS &amp; PLAY ▶
                </button>
              </div>
            )}

            {modeTab === 'challenge' && (
              <div className="space-y-2.5 bg-black/25 p-4 rounded-2xl border border-white/10">
                {AYO_CHALLENGES.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => startLocalGame(false, ch)}
                    className="w-full text-left bg-white/10 hover:bg-white/15 p-3.5 rounded-xl border border-white/15 flex items-center justify-between gap-3 transition-all"
                  >
                    <div>
                      <div className="font-display font-black text-amber-300 text-base">🧩 {ch.title}</div>
                      <div className="text-xs text-emerald-100">{ch.subtitle}</div>
                    </div>
                    <span className="bg-amber-400 text-slate-950 font-black text-xs px-3 py-1.5 rounded-full shrink-0">
                      Play ▶
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Profile, XP, Cultural Proverb & Quick Guide */}
          <div className="lg:col-span-5 flex flex-col gap-4 justify-between">
            <div className="bg-white/10 backdrop-blur-md p-5 rounded-[2rem] border-2 border-white/15 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs uppercase font-bold text-amber-300">Your Ọpọ́n Rank</div>
                  <div className="font-display text-2xl font-black">Level {level} Strategist</div>
                </div>
                <div className="text-3xl">{currentSkin.emoji}</div>
              </div>
              <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden mb-1.5">
                <div className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full" style={{ width: `${xpInLevel}%` }} />
              </div>
              <div className="flex justify-between text-xs text-emerald-200 mb-4 tabular-nums">
                <span>{xpInLevel} / 100 XP to Level {level + 1}</span>
                <span>{profile.wins}W / {profile.games} Played</span>
              </div>

              <button
                onClick={() => { playAyoClick(); setShowSkins(true); }}
                className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl border-b-4 border-emerald-950 text-sm"
              >
                🎨 Customize Seed Skins ({SEED_SKINS.filter(s => level >= s.unlockLevel).length}/{SEED_SKINS.length} Unlocked)
              </button>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-5 rounded-[2rem] border-2 border-white/15 shadow-2xl flex-1 flex flex-col justify-between">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300 mb-1.5">Yorùbá Wisdom</div>
                <p className="text-sm italic text-emerald-50 leading-relaxed mb-3">
                  {opponent.proverb}
                </p>
                <div className="text-xs text-emerald-200 space-y-1">
                  <p>• <strong>48 seeds</strong> across 12 carved pits — zero luck, pure skill.</p>
                  <p>• First to <strong>25 captured seeds</strong> wins the Ọpọ́n!</p>
                </div>
              </div>
              <a
                href="/ayo-rules/"
                className="mt-4 inline-block text-center bg-black/35 hover:bg-black/55 text-amber-300 font-bold text-xs py-2.5 rounded-xl border border-amber-400/30"
              >
                📖 Read Full Ayò Ọlọ́pọ́n Strategy Guide →
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AyoApp;
