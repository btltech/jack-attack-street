import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createNewGame, isValidMove, playCard, drawCard, getBotDecision, sortHand, chooseSuit, swapWith, clearPeek, botChooseSuit, botChooseSwap, confirmPassScreen, triggerPassScreen, saveStateForUndo, undoLastMove } from './core/game';
import { GameState, Card, Player, Suit, Rank, Difficulty, GameMode } from './core/types';
import { playCardSound, playDrawSound, playShuffleSound, playAttackSound, playWinSound, playLoseSound, playClickSound, initAudio, toggleBackgroundMusic, isMusicPlaying, playPowerUpSound, playCoinsSound } from './core/sounds';
import { getCommentary, getCommentaryForAction, Commentary, CommentaryType } from './core/commentary';
import { PlayerStats, loadStats, saveStats, recordGame, migrateOldStats, getWinRate, formatDuration, getRank } from './core/stats';
import SuitPicker from './components/SuitPicker';
import SwapPicker from './components/SwapPicker';
import PeekCard from './components/PeekCard';
import CommentaryBubble from './components/CommentaryBubble';
import PassScreen from './components/PassScreen';
import Tutorial from './components/Tutorial';
import DailyChallenge from './components/DailyChallenge';
import ThemePicker from './components/ThemePicker';
import CustomRulesModal, { GameRules, loadRules, defaultRules } from './components/CustomRulesModal';
import HandHints from './components/HandHints';
import PowerUpShop from './components/PowerUpShop';
import PersonalityPicker from './components/PersonalityPicker';
import OnlineRoom from './components/OnlineRoom';
import DailyLeaderboardModal from './components/DailyLeaderboardModal';
import { createOnlineRoom, loadNickname, saveNickname } from './core/online';
import { getDailySeed, getTodayUtcKey, submitDailyScore } from './core/dailyLeaderboard';
import { getTodaysChallenge, getDailyProgress, checkChallengeCompletion } from './core/challenges';
import { getCurrentTheme, CardTheme } from './core/themes';
import { PersonalityType, getCurrentPersonality, getStyledCommentary } from './core/commentaryPersonalities';

type GameView = 'menu' | 'playing' | 'gameover' | 'online';

// --- ANIMATION TYPES ---
interface FlyingCardState {
  card: Card;
  start: DOMRect;
  end: DOMRect;
  faceDown?: boolean;
  onComplete: () => void;
}

// Vibrant pattern for card backs
const cardBackPattern = {
  background: `
    linear-gradient(45deg, #3b82f6 25%, transparent 25%, transparent 75%, #3b82f6 75%, #3b82f6),
    linear-gradient(45deg, #3b82f6 25%, transparent 25%, transparent 75%, #3b82f6 75%, #3b82f6)
  `,
  backgroundColor: '#2563eb',
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0, 10px 10px',
};

// Reusable card styles for consistent look between game and animation
const getCardStyles = (card: Card, playable: boolean, isRed: boolean) => {
  const base = "relative w-20 h-32 md:w-24 md:h-36 rounded-2xl border-b-4 flex flex-col justify-between p-2 shadow-xl transition-all duration-200 select-none bg-white";
  const hover = playable ? "cursor-pointer hover:scale-110 hover:-translate-y-4 hover:shadow-2xl z-40" : "cursor-default opacity-90";
  const borderColor = "border-gray-200";

  return `${base} ${hover} ${borderColor}`;
};

const App: React.FC = () => {
  const [view, setView] = useState<GameView>('menu');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedPlayerCount, setSelectedPlayerCount] = useState<number>(2);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>(Difficulty.Medium);
  const [selectedGameMode, setSelectedGameMode] = useState<GameMode>(GameMode.VsBot);

  // Animation State
  const [flyingCard, setFlyingCard] = useState<FlyingCardState | null>(null);
  const [hiddenCardId, setHiddenCardId] = useState<string | null>(null);
  const [isSorting, setIsSorting] = useState<boolean>(false); // Sort animation state

  // Visual Effects State
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);

  // Commentary State (bot trash talk)
  const [currentCommentary, setCurrentCommentary] = useState<Commentary | null>(null);
  const [commentaryPosition, setCommentaryPosition] = useState<'top' | 'left' | 'right'>('top');

  // Refs
  const discardRef = useRef<HTMLDivElement>(null);
  const drawPileRef = useRef<HTMLButtonElement>(null);
  const playerHandRef = useRef<HTMLDivElement>(null);
  const botRefs = useRef<Array<HTMLDivElement | null>>([]);

  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [showRules, setShowRules] = useState<boolean>(false);
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [musicEnabled, setMusicEnabled] = useState<boolean>(false);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  const [showThemePicker, setShowThemePicker] = useState<boolean>(false);
  const [currentTheme, setCurrentThemeState] = useState<CardTheme>(getCurrentTheme());
  const [showCustomRules, setShowCustomRules] = useState<boolean>(false);
  const [gameRules, setGameRules] = useState<GameRules>(loadRules());
  const [hintsEnabled, setHintsEnabled] = useState<boolean>(true); // Default on for new players
  const [showPowerUpShop, setShowPowerUpShop] = useState<boolean>(false);
  const [showPersonalityPicker, setShowPersonalityPicker] = useState<boolean>(false);
  const [currentPersonality, setPersonality] = useState<PersonalityType>(getCurrentPersonality());
  const [shareCopied, setShareCopied] = useState<boolean>(false);
  const [lastMatchDurationMs, setLastMatchDurationMs] = useState<number>(0);

  // Online multiplayer room state
  const [menuTab, setMenuTab] = useState<'bot' | 'local' | 'online'>('bot');
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>(() => loadNickname());
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [onlineBusy, setOnlineBusy] = useState<boolean>(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);

  // Same-seed Daily Challenge + D1 Leaderboard state
  const [showDailyBoard, setShowDailyBoard] = useState<boolean>(false);
  const [isDailySeedRun, setIsDailySeedRun] = useState<boolean>(false);
  const [dailyRankResult, setDailyRankResult] = useState<{ rank: number; total: number; improved: boolean; day: string } | null>(null);

  // Game tracking for enhanced stats
  const gameStartTimeRef = useRef<number>(0);
  const cardsPlayedRef = useRef<number>(0);
  const attackCardsUsedRef = useRef<number>(0);

  // Load difficulty preference & check ?room=XXXX invite link
  useEffect(() => {
    const savedDifficulty = localStorage.getItem('jack-attack-difficulty') as Difficulty;
    if (savedDifficulty && Object.values(Difficulty).includes(savedDifficulty)) {
      setSelectedDifficulty(savedDifficulty);
    }

    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room')?.trim().toUpperCase();
    if (roomParam && /^[A-Z0-9]{4,6}$/.test(roomParam)) {
      setJoinCodeInput(roomParam);
      setMenuTab('online');
      setActiveRoomCode(roomParam);
      setView('online');
    } else if (params.get('daily') === '1') {
      setShowDailyBoard(true);
    }
  }, []);

  const openRoom = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,6}$/.test(clean)) {
      setOnlineError('Enter a valid 4-letter room code.');
      return;
    }
    saveNickname(nickname || 'Player');
    setOnlineError(null);
    setActiveRoomCode(clean);
    setView('online');
    const url = new URL(window.location.href);
    url.searchParams.set('room', clean);
    window.history.replaceState(null, '', url.toString());
  };

  const handleCreateRoom = async () => {
    playClickSound();
    initAudio();
    setOnlineBusy(true);
    setOnlineError(null);
    try {
      const code = await createOnlineRoom();
      openRoom(code);
    } catch (err) {
      setOnlineError(err instanceof Error ? err.message : 'Failed to create room.');
    } finally {
      setOnlineBusy(false);
    }
  };

  const handleLeaveRoom = () => {
    setActiveRoomCode(null);
    setView('menu');
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState(null, '', url.toString());
  };

  // Trigger screen shake
  const triggerShake = () => {
    setIsShaking(true);
    playAttackSound();
    setTimeout(() => setIsShaking(false), 500);
  };

  // Trigger confetti
  const triggerConfetti = () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
  };

  // Load and migrate stats on mount
  useEffect(() => {
    migrateOldStats();
    setStats(loadStats());
  }, []);

  // Update stats after game completion
  const updateStats = (isWin: boolean, state: GameState) => {
    const duration = Date.now() - gameStartTimeRef.current;
    setLastMatchDurationMs(duration);

    if (isWin && isDailySeedRun) {
      const today = getTodayUtcKey();
      submitDailyScore({
        day: today,
        name: loadNickname() || nickname || 'Player',
        durationMs: duration,
        cardsPlayed: cardsPlayedRef.current,
      })
        .then((res) => {
          setDailyRankResult({ rank: res.rank, total: res.total, improved: res.improved, day: res.day });
        })
        .catch(() => {
          // Non-blocking if offline
        });
    }

    if (!stats) return;

    const newStats = recordGame(stats, {
      won: isWin,
      difficulty: state.difficulty,
      gameMode: state.gameMode,
      opponentCount: state.players.length - 1,
      turnsPlayed: 0, // Could track this in future
      cardsPlayed: cardsPlayedRef.current,
      attackCardsUsed: attackCardsUsedRef.current,
      durationMs: duration,
    });
    setStats(newStats);

    // Check Daily Challenge progress
    const powerCardsUsed = cardsPlayedRef.current - attackCardsUsedRef.current; // Rough estimate
    const deckRemaining = state.deck.length;
    checkChallengeCompletion(
      isWin,
      attackCardsUsedRef.current,
      duration,
      deckRemaining,
      powerCardsUsed,
      cardsPlayedRef.current
    );
  };

  // --- ANIMATION LOGIC ---
  const triggerPlayAnimation = (card: Card, startRect: DOMRect, onComplete: () => void) => {
    if (!discardRef.current) { onComplete(); return; }
    const endRect = discardRef.current.getBoundingClientRect();
    setHiddenCardId(card.id);
    setFlyingCard({ card, start: startRect, end: endRect, faceDown: false, onComplete: () => { setFlyingCard(null); setHiddenCardId(null); onComplete(); } });
  };

  const triggerDrawAnimation = (targetRect: DOMRect, onComplete: () => void) => {
    if (!drawPileRef.current) { onComplete(); return; }
    const startRect = drawPileRef.current.getBoundingClientRect();
    const dummyCard: Card = { id: 'temp-draw', suit: Suit.Spades, rank: Rank.Ace };
    setFlyingCard({ card: dummyCard, start: startRect, end: targetRect, faceDown: true, onComplete: () => { setFlyingCard(null); onComplete(); } });
  };

  // --- BOT LOOP ---
  useEffect(() => {
    if (view !== 'playing' || !gameState || gameState.winnerId || flyingCard) return;

    // Handle bot's pending power-up choices
    if (gameState.pendingSuitChoice && gameState.players[gameState.currentPlayerIndex].isBot) {
      const timer = setTimeout(() => {
        showCommentary('wild', getPlayerPosition(gameState.currentPlayerIndex, gameState.players.length) as 'top' | 'left' | 'right');
        const newState = botChooseSuit(gameState);
        setGameState(newState);
      }, 1000);
      return () => clearTimeout(timer);
    }

    if (gameState.pendingSwap && gameState.players[gameState.currentPlayerIndex].isBot) {
      const timer = setTimeout(() => {
        showCommentary('swap', getPlayerPosition(gameState.currentPlayerIndex, gameState.players.length) as 'top' | 'left' | 'right');
        const newState = botChooseSwap(gameState);
        setGameState(newState);
      }, 1000);
      return () => clearTimeout(timer);
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    if (currentPlayer.isBot) {
      const timer = setTimeout(() => {
        const decision = getBotDecision(gameState);
        const botDiv = botRefs.current[gameState.currentPlayerIndex];
        const botPosition = getPlayerPosition(gameState.currentPlayerIndex, gameState.players.length) as 'top' | 'left' | 'right';

        if (decision.action === 'play' && decision.cardId) {
          const cardToPlay = currentPlayer.hand.find(c => c.id === decision.cardId);
          if (cardToPlay && botDiv) {
            const startRect = botDiv.getBoundingClientRect();
            startRect.x += Math.random() * 20 - 10;
            startRect.y += Math.random() * 20 - 10;

            // Check for special cards
            const isAttackCard = cardToPlay.rank === '2' || (cardToPlay.rank === 'J' && (cardToPlay.suit === '♠' || cardToPlay.suit === '♣'));
            const isSkip = cardToPlay.rank === '8';
            const isPeek = cardToPlay.rank === '7';

            triggerPlayAnimation(cardToPlay, startRect, () => {
              playCardSound();
              const nextState = playCard(gameState, decision.cardId!);

              // Trigger effects and commentary
              if (isAttackCard) {
                triggerShake();
                showCommentary('attack', botPosition);
              } else if (isSkip) {
                showCommentary('skip', botPosition);
              } else if (isPeek) {
                showCommentary('peek', botPosition);
              } else if (currentPlayer.hand.length <= 2) {
                showCommentary('almost_win', botPosition);
              }

              setGameState(nextState);
              checkWin(nextState);
            });
          } else {
            playCardSound();
            const nextState = playCard(gameState, decision.cardId);
            setGameState(nextState);
            checkWin(nextState);
          }
        } else {
          // Bot draws
          showCommentary('draw', botPosition);
          if (botDiv) {
            const targetRect = botDiv.getBoundingClientRect();
            triggerDrawAnimation(targetRect, () => {
              playDrawSound();
              const nextState = drawCard(gameState);
              setGameState(nextState);
            });
          } else {
            playDrawSound();
            const nextState = drawCard(gameState);
            setGameState(nextState);
          }
        }
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [gameState, view, flyingCard]);

  const checkWin = (state: GameState) => {
    if (state.winnerId) {
      const humanWon = state.winnerId === state.players[0].id;
      if (humanWon) {
        playWinSound();
        triggerConfetti();
      } else {
        playLoseSound();
      }
      setTimeout(() => {
        setView('gameover');
        updateStats(humanWon, state);
      }, 800);
    }
  };

  const startNewGame = (
    numPlayers: number,
    difficulty: Difficulty,
    gameMode: GameMode = GameMode.VsBot,
    dailySeed?: string
  ) => {
    initAudio();
    playShuffleSound();
    localStorage.setItem('jack-attack-difficulty', difficulty);
    const initialState = createNewGame(numPlayers, difficulty, gameMode, undefined, dailySeed);
    setGameState(initialState);
    setIsDailySeedRun(Boolean(dailySeed));
    setDailyRankResult(null);
    setErrorMsg(null);
    setShowConfetti(false);
    setCurrentCommentary(null);

    // Reset game tracking
    gameStartTimeRef.current = Date.now();
    cardsPlayedRef.current = 0;
    attackCardsUsedRef.current = 0;

    setView('playing');
  };

  // --- COMMENTARY HELPER ---
  const showCommentary = (type: CommentaryType, position: 'top' | 'left' | 'right') => {
    const commentary = getCommentary(type);
    setCurrentCommentary(commentary);
    setCommentaryPosition(position);
  };

  // --- POWER-UP HANDLERS ---
  const handleSuitChoice = (suit: Suit) => {
    if (!gameState) return;
    playClickSound();
    const newState = chooseSuit(gameState, suit);
    setGameState(newState);
  };

  const handleSwapChoice = (targetPlayerId: string) => {
    if (!gameState) return;
    playClickSound();
    showCommentary('swap', 'top');
    const newState = swapWith(gameState, targetPlayerId);
    setGameState(newState);
  };

  const handleDismissPeek = useCallback(() => {
    if (!gameState) return;
    const newState = clearPeek(gameState);
    setGameState(newState);
  }, [gameState]);

  const handlePassScreenConfirm = () => {
    if (!gameState) return;
    playClickSound();
    const newState = confirmPassScreen(gameState);
    setGameState(newState);
  };

  // --- HANDLERS ---
  const handleCardClick = (e: React.MouseEvent, card: Card) => {
    if (view !== 'playing' || !gameState || flyingCard) return;
    if (gameState.players[gameState.currentPlayerIndex].isBot) return;

    const topCard = gameState.discardPile[gameState.discardPile.length - 1];
    const mustPickup = gameState.pendingPickup > 0;
    const valid = isValidMove(card, topCard, gameState.pendingPickup, gameState.chosenSuit);

    if (mustPickup && !valid) {
      const isBlackJackTop = topCard.rank === Rank.Jack && (topCard.suit === Suit.Spades || topCard.suit === Suit.Clubs);
      setErrorMsg(
        isBlackJackTop
          ? `🛡️ Defend with a Black Jack (J♠/J♣) or Pick Up!`
          : `🛡️ Defend with a ${topCard.rank} or Pick Up!`
      );
      setTimeout(() => setErrorMsg(null), 2500);
      return;
    }

    if (valid) {
      setErrorMsg(null);
      const rect = e.currentTarget.getBoundingClientRect();

      // Check if it's an attack card
      const isAttackCard = card.rank === '2' || (card.rank === 'J' && (card.suit === '♠' || card.suit === '♣'));

      triggerPlayAnimation(card, rect, () => {
        playCardSound();
        // Save state for undo before playing
        const stateWithUndo = saveStateForUndo(gameState);
        const newState = playCard(stateWithUndo, card.id);

        // Track cards played for stats
        cardsPlayedRef.current++;
        if (isAttackCard) {
          attackCardsUsedRef.current++;
          triggerShake();
        }

        setGameState(newState);
        checkWin(newState);
      });
    } else {
      const activeSuit = gameState.chosenSuit ?? topCard.suit;
      setErrorMsg(
        gameState.chosenSuit
          ? `🚫 Match the Wild suit (${activeSuit}) or play a Queen!`
          : `🚫 Oops! Match ${activeSuit} or ${topCard.rank} (or play a Queen)!`
      );
      setTimeout(() => setErrorMsg(null), 2000);
    }
  };

  const handleDrawClick = () => {
    if (view !== 'playing' || !gameState || flyingCard) return;
    if (gameState.players[gameState.currentPlayerIndex].isBot) return;

    if (playerHandRef.current) {
      const targetRect = playerHandRef.current.getBoundingClientRect();
      targetRect.y -= 50;
      triggerDrawAnimation(targetRect, () => {
        playDrawSound();
        const newState = drawCard(gameState);
        setGameState(newState);
        setErrorMsg(null);
      });
    } else {
      playDrawSound();
      const newState = drawCard(gameState);
      setGameState(newState);
      setErrorMsg(null);
    }
  };

  const handleSortClick = () => {
    if (view !== 'playing' || !gameState || isSorting) return;

    // Trigger sort animation
    setIsSorting(true);

    setTimeout(() => {
      const newState = { ...gameState, players: [...gameState.players] };
      const p = newState.players[0];
      p.hand = sortHand(p.hand);
      setGameState(newState);

      setTimeout(() => {
        setIsSorting(false);
      }, 300);
    }, 150);
  };

  const getPlayerPosition = (index: number, total: number) => {
    if (index === 0) return 'bottom';
    if (total === 2) return 'top';
    if (total === 3) return index === 1 ? 'left' : 'right';
    if (index === 1) return 'left';
    if (index === 2) return 'top';
    return 'right';
  };

  // --- RENDER SECTIONS ---

  // 0. ONLINE ROOM
  if (view === 'online' && activeRoomCode) {
    return (
      <OnlineRoom
        roomCode={activeRoomCode}
        nickname={nickname.trim() || 'Player'}
        onLeave={handleLeaveRoom}
      />
    );
  }

  // 1. MENU
  if (view === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-pink-900 flex flex-col items-center justify-center text-white font-sans relative overflow-x-hidden py-4 px-4">
        {/* Back to Portal Link */}
        <a
          href="/"
          className="fixed top-4 left-4 z-40 bg-black/35 hover:bg-black/55 backdrop-blur-md text-purple-100 hover:text-white text-xs sm:text-sm font-bold px-3.5 py-2 rounded-full border border-white/20 transition-all shadow-md"
        >
          ← All Games
        </a>

        {/* Background Shapes */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-yellow-400 rounded-full mix-blend-overlay opacity-20 animate-pulse pointer-events-none"></div>
        <div className="absolute bottom-20 right-10 w-48 h-48 bg-blue-400 rounded-full mix-blend-overlay opacity-20 animate-bounce pointer-events-none"></div>

        <div className="bg-white/10 backdrop-blur-md px-5 py-5 sm:px-7 sm:py-6 rounded-[2rem] shadow-2xl border-4 border-white/20 text-center max-w-lg w-full z-10">
          <div className="mb-3">
            <h1 className="text-4xl sm:text-5xl font-black leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-500 drop-shadow-sm">
              JACK ATTACK
            </h1>
            <h2 className="text-sm sm:text-base font-bold mt-1.5 text-pink-200 tracking-widest uppercase bg-black/25 inline-block px-3.5 py-0.5 rounded-full">
              Street Edition
            </h2>
          </div>

          {/* Stats Bubble - Compact Above-the-Fold */}
          {stats && (
            <>
              {/* Rank + Quick Stats Row */}
              <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
                <div className="bg-gradient-to-r from-yellow-400 to-orange-500 px-4 py-1.5 rounded-full border-b-4 border-orange-600 shadow-md inline-flex items-center gap-1.5">
                  <span className="text-lg">{getRank(stats).emoji}</span>
                  <span className="font-black text-black text-sm">{getRank(stats).name}</span>
                </div>
                <div className="bg-green-500/80 px-3 py-1.5 rounded-full border-b-4 border-green-700 text-xs font-black">
                  {stats.wins}W
                </div>
                <div className="bg-red-500/80 px-3 py-1.5 rounded-full border-b-4 border-red-700 text-xs font-black">
                  {stats.losses}L
                </div>
                <div className="bg-orange-500/80 px-3 py-1.5 rounded-full border-b-4 border-orange-700 text-xs font-black">
                  🔥 {stats.currentWinStreak}
                </div>
              </div>

              {/* Coins & Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 mb-3">
                <div className="bg-yellow-400 text-black px-3.5 py-2 rounded-full font-black text-sm border-b-4 border-yellow-600 flex items-center gap-1.5 shrink-0">
                  <span>🪙</span>
                  <span>{stats.coins}</span>
                </div>
                <button
                  onClick={() => { playClickSound(); setShowLeaderboard(true); }}
                  className="bg-purple-500 hover:bg-purple-400 text-white px-3.5 py-2 rounded-full font-bold text-sm border-b-4 border-purple-700 transition-all shrink-0"
                >
                  📊 Stats
                </button>
                <button
                  onClick={() => { playClickSound(); setShowDailyBoard(true); }}
                  title="Daily Seed Leaderboard"
                  aria-label="Daily Seed Leaderboard"
                  className="bg-amber-400 hover:bg-amber-300 text-black px-3.5 py-2 rounded-full font-black text-sm border-b-4 border-amber-600 transition-all shrink-0"
                >
                  🏆 Daily
                </button>
                <button
                  onClick={() => { playClickSound(); setShowThemePicker(true); }}
                  title="Card Themes"
                  aria-label="Card Themes"
                  className="w-11 h-11 shrink-0 flex items-center justify-center bg-pink-500 hover:bg-pink-400 text-white rounded-full text-lg border-b-4 border-pink-700 transition-all"
                >
                  🎨
                </button>
                <button
                  onClick={() => { playClickSound(); setShowPowerUpShop(true); }}
                  title="Power-Up Shop"
                  aria-label="Power-Up Shop"
                  className="w-11 h-11 shrink-0 flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-white rounded-full text-lg border-b-4 border-emerald-700 transition-all"
                >
                  🛒
                </button>
                <button
                  onClick={() => { playClickSound(); setShowPersonalityPicker(true); }}
                  title="Commentary Style"
                  aria-label="Commentary Style"
                  className="w-11 h-11 shrink-0 flex items-center justify-center bg-indigo-500 hover:bg-indigo-400 text-white rounded-full text-lg border-b-4 border-indigo-700 transition-all"
                >
                  🎙️
                </button>
              </div>

              {/* Daily Challenge */}
              <div className="mb-3">
                <DailyChallenge
                  onClaim={(reward) => {
                    if (stats) {
                      playCoinsSound();
                      const newStats = { ...stats, coins: stats.coins + reward.coins };
                      setStats(newStats);
                      saveStats(newStats);
                    }
                  }}
                />
              </div>
            </>
          )}

          <div className="space-y-3.5">
            {/* Game Mode Tabs */}
            <div>
              <p className="text-purple-200 text-xs mb-1.5 font-bold uppercase tracking-wide">Game Mode</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => { playClickSound(); setMenuTab('bot'); setSelectedGameMode(GameMode.VsBot); }}
                  className={`px-2.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm border-b-4 transition-all ${menuTab === 'bot'
                    ? 'bg-blue-400 border-blue-600 text-black'
                    : 'bg-indigo-700 border-indigo-900 text-indigo-200 hover:bg-indigo-600'
                    }`}
                >
                  🤖 vs Bot
                </button>
                <button
                  onClick={() => { playClickSound(); setMenuTab('online'); }}
                  className={`px-2.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm border-b-4 transition-all ${menuTab === 'online'
                    ? 'bg-emerald-400 border-emerald-600 text-black'
                    : 'bg-indigo-700 border-indigo-900 text-indigo-200 hover:bg-indigo-600'
                    }`}
                >
                  🌐 Online
                </button>
                <button
                  onClick={() => { playClickSound(); setMenuTab('local'); setSelectedGameMode(GameMode.LocalMultiplayer); }}
                  className={`px-2.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm border-b-4 transition-all ${menuTab === 'local'
                    ? 'bg-pink-400 border-pink-600 text-black'
                    : 'bg-indigo-700 border-indigo-900 text-indigo-200 hover:bg-indigo-600'
                    }`}
                >
                  👫 Pass &amp; Play
                </button>
              </div>
            </div>

            {menuTab === 'online' ? (
              <div className="space-y-3 bg-black/20 p-3.5 rounded-2xl border border-white/15">
                <div className="text-left">
                  <label className="block text-purple-200 text-xs font-bold uppercase tracking-wide mb-1">
                    Your Nickname
                  </label>
                  <input
                    type="text"
                    maxLength={16}
                    value={nickname}
                    onChange={(e) => { setNickname(e.target.value); saveNickname(e.target.value); }}
                    placeholder="Enter nickname (e.g. StreetKing)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-indigo-950/80 border-2 border-indigo-400/40 focus:border-yellow-400 focus:outline-none text-white font-bold text-sm placeholder:text-indigo-300/50"
                  />
                </div>

                {onlineError && (
                  <p className="text-xs font-bold text-red-300 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-1.5">
                    ⚠️ {onlineError}
                  </p>
                )}

                <button
                  onClick={handleCreateRoom}
                  disabled={onlineBusy}
                  className="w-full bg-gradient-to-r from-green-400 to-emerald-600 hover:from-green-500 hover:to-emerald-700 disabled:opacity-60 text-white font-black py-3 px-6 rounded-xl shadow-xl text-base sm:text-lg border-b-4 border-green-800 transition-all active:border-b-0 active:translate-y-0.5"
                >
                  {onlineBusy ? 'Creating Room...' : '✨ Create Room & Invite Friends'}
                </button>

                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    maxLength={6}
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    onKeyDown={(e) => { if (e.key === 'Enter' && joinCodeInput.length >= 4) openRoom(joinCodeInput); }}
                    placeholder="ROOM CODE"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-indigo-950/80 border-2 border-indigo-400/40 focus:border-yellow-400 focus:outline-none text-white font-black tracking-widest uppercase text-center text-sm placeholder:text-indigo-300/40"
                  />
                  <button
                    onClick={() => { playClickSound(); initAudio(); openRoom(joinCodeInput); }}
                    className="bg-yellow-400 hover:bg-yellow-300 text-black font-black px-5 py-2.5 rounded-xl border-b-4 border-yellow-600 text-sm transition-all active:border-b-0 active:translate-y-0.5"
                  >
                    Join ▶
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <p className="text-purple-200 text-xs mb-1.5 font-bold uppercase tracking-wide">Players</p>
                    <div className="flex justify-center gap-2.5">
                      {[2, 3, 4].map(num => (
                        <button key={num} onClick={() => { playClickSound(); setSelectedPlayerCount(num); }} className={`w-12 h-11 rounded-xl font-black text-xl border-b-4 transition-all ${selectedPlayerCount === num ? 'bg-yellow-400 border-yellow-600 text-black scale-105 shadow-lg' : 'bg-indigo-700 border-indigo-900 text-indigo-200 hover:bg-indigo-600'}`}>{num}</button>
                      ))}
                    </div>
                  </div>

                  {menuTab === 'bot' && (
                    <div>
                      <p className="text-purple-200 text-xs mb-1.5 font-bold uppercase tracking-wide">Difficulty</p>
                      <div className="flex justify-center gap-1.5">
                        {[
                          { level: Difficulty.Easy, label: '🌟 Easy', color: 'green' },
                          { level: Difficulty.Medium, label: '🔥 Med', color: 'yellow' },
                          { level: Difficulty.Hard, label: '💀 Hard', color: 'red' },
                        ].map(({ level, label, color }) => (
                          <button
                            key={level}
                            onClick={() => { playClickSound(); setSelectedDifficulty(level); }}
                            className={`flex-1 px-2 py-2.5 rounded-xl font-bold text-xs border-b-4 transition-all ${selectedDifficulty === level
                              ? 'scale-105 shadow-lg'
                              : 'bg-indigo-700 border-indigo-900 text-indigo-200 hover:bg-indigo-600'
                              }`}
                            style={selectedDifficulty === level ? {
                              backgroundColor: color === 'green' ? '#4ade80' : color === 'yellow' ? '#facc15' : '#f87171',
                              borderColor: color === 'green' ? '#16a34a' : color === 'yellow' ? '#ca8a04' : '#dc2626',
                              color: 'black'
                            } : {}}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button onClick={() => startNewGame(selectedPlayerCount, selectedDifficulty, selectedGameMode)} className="w-full bg-gradient-to-r from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white font-black py-3.5 px-8 rounded-2xl shadow-xl text-xl sm:text-2xl border-b-4 border-green-800 transition-all hover:scale-[1.02] active:scale-95 active:border-b-0 active:translate-y-1">PLAY NOW ▶</button>
              </>
            )}

            <div className="flex gap-5 justify-center text-sm pt-0.5">
              <button onClick={() => { playClickSound(); setShowTutorial(true); }} className="text-pink-200 hover:text-white font-bold underline decoration-2 underline-offset-4">How to Play?</button>
              <button onClick={() => { playClickSound(); setShowCustomRules(true); }} className="text-blue-200 hover:text-white font-bold underline decoration-2 underline-offset-4">⚙️ Custom Rules</button>
            </div>
          </div>
        </div>

        {/* Rules Modal */}
        {showRules && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in">
            <div className="bg-white text-gray-800 p-8 rounded-[2rem] max-w-lg w-full relative shadow-2xl border-4 border-yellow-400 max-h-[90vh] overflow-y-auto">
              <button onClick={() => setShowRules(false)} className="absolute top-4 right-4 text-4xl hover:rotate-90 transition-transform">❌</button>
              <h3 className="text-3xl font-black mb-6 text-purple-600 text-center">Street Rules 🛹</h3>
              <ul className="space-y-4 text-lg font-bold text-gray-600">
                <li className="flex items-center gap-3"><span className="text-3xl">🎯</span> Match the <strong>Suit</strong> or <strong>Number</strong>.</li>
                <li className="flex items-center gap-3"><span className="text-3xl">💥</span> <strong>2</strong> = Next player picks up 2!</li>
                <li className="flex items-center gap-3"><span className="text-3xl">🔥</span> <strong>Black Jack</strong> = Pick up 5!</li>
                <li className="flex items-center gap-3"><span className="text-3xl">🏆</span> Empty your hand to <strong>WIN!</strong></li>
              </ul>
              <button onClick={() => setShowRules(false)} className="w-full mt-8 bg-purple-600 text-white font-bold py-3 rounded-xl border-b-4 border-purple-800 hover:bg-purple-700">Let's Go!</button>
            </div>
          </div>
        )}

        {/* Leaderboard/Stats Modal */}
        {showLeaderboard && stats && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in">
            <div className="bg-gradient-to-br from-indigo-900 to-purple-900 text-white p-6 rounded-[2rem] max-w-md w-full relative shadow-2xl border-4 border-yellow-400 max-h-[90vh] overflow-y-auto">
              <button onClick={() => setShowLeaderboard(false)} className="absolute top-4 right-4 text-3xl hover:rotate-90 transition-transform">❌</button>

              <h3 className="text-3xl font-black mb-6 text-center text-yellow-400">📊 Your Stats</h3>

              {/* Rank Section */}
              <div className="text-center mb-6">
                <div className="text-6xl mb-2">{getRank(stats).emoji}</div>
                <div className="text-2xl font-black text-yellow-400">{getRank(stats).name}</div>
                <div className="text-sm text-purple-300">
                  {stats.wins < getRank(stats).nextAt
                    ? `${getRank(stats).nextAt - stats.wins} wins to next rank`
                    : 'Max rank achieved!'}
                </div>
              </div>

              {/* Main Stats */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-white/10 p-4 rounded-xl text-center">
                  <div className="text-3xl font-black text-green-400">{getWinRate(stats)}%</div>
                  <div className="text-xs text-purple-300 uppercase">Win Rate</div>
                </div>
                <div className="bg-white/10 p-4 rounded-xl text-center">
                  <div className="text-3xl font-black text-orange-400">{stats.bestWinStreak}</div>
                  <div className="text-xs text-purple-300 uppercase">Best Streak</div>
                </div>
                <div className="bg-white/10 p-4 rounded-xl text-center">
                  <div className="text-3xl font-black text-blue-400">{formatDuration(stats.fastestWinMs)}</div>
                  <div className="text-xs text-purple-300 uppercase">Fastest Win</div>
                </div>
                <div className="bg-white/10 p-4 rounded-xl text-center">
                  <div className="text-3xl font-black text-pink-400">{stats.totalCardsPlayed}</div>
                  <div className="text-xs text-purple-300 uppercase">Cards Played</div>
                </div>
              </div>

              {/* Per-Difficulty Stats */}
              <div className="bg-white/5 p-4 rounded-xl mb-6">
                <h4 className="font-bold mb-3 text-purple-300">By Difficulty</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>🌟 Easy</span>
                    <span className="font-bold">{stats.easyWins}W / {stats.easyLosses}L</span>
                  </div>
                  <div className="flex justify-between">
                    <span>🔥 Medium</span>
                    <span className="font-bold">{stats.mediumWins}W / {stats.mediumLosses}L</span>
                  </div>
                  <div className="flex justify-between">
                    <span>💀 Hard</span>
                    <span className="font-bold">{stats.hardWins}W / {stats.hardLosses}L</span>
                  </div>
                </div>
              </div>

              {/* Recent Games */}
              {stats.recentGames.length > 0 && (
                <div className="bg-white/5 p-4 rounded-xl mb-6">
                  <h4 className="font-bold mb-3 text-purple-300">Recent Games</h4>
                  <div className="space-y-2 text-sm max-h-32 overflow-y-auto">
                    {stats.recentGames.slice(0, 5).map((game, i) => (
                      <div key={game.id} className="flex justify-between items-center">
                        <span className={game.won ? 'text-green-400' : 'text-red-400'}>
                          {game.won ? '✓ Win' : '✗ Loss'}
                        </span>
                        <span className="text-purple-300">{formatDuration(game.durationMs)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowLeaderboard(false)}
                className="w-full bg-yellow-400 text-black font-bold py-3 rounded-xl border-b-4 border-yellow-600 hover:bg-yellow-300"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Tutorial Modal */}
        {showTutorial && (
          <Tutorial
            onComplete={() => setShowTutorial(false)}
            onSkip={() => setShowTutorial(false)}
          />
        )}

        {/* Theme Picker Modal */}
        {showThemePicker && (
          <ThemePicker
            onClose={() => setShowThemePicker(false)}
            onThemeChange={(theme) => setCurrentThemeState(theme)}
          />
        )}

        {/* Custom Rules Modal */}
        {showCustomRules && (
          <CustomRulesModal
            onClose={() => setShowCustomRules(false)}
            rules={gameRules}
            onRulesChange={setGameRules}
          />
        )}

        {/* Power-Up Shop Modal */}
        {showPowerUpShop && stats && (
          <PowerUpShop
            coins={stats.coins}
            onPurchase={(newCoins) => {
              const newStats = { ...stats, coins: newCoins };
              setStats(newStats);
              saveStats(newStats);
            }}
            onClose={() => setShowPowerUpShop(false)}
          />
        )}

        {/* Personality Picker Modal */}
        {showPersonalityPicker && (
          <PersonalityPicker
            onClose={() => setShowPersonalityPicker(false)}
            onPersonalityChange={setPersonality}
          />
        )}

        {/* Daily Seed Leaderboard Modal */}
        {showDailyBoard && (
          <DailyLeaderboardModal
            onClose={() => setShowDailyBoard(false)}
            onPlayDailySeed={(name) => {
              setNickname(name);
              setShowDailyBoard(false);
              startNewGame(2, Difficulty.Medium, GameMode.VsBot, getDailySeed());
            }}
          />
        )}
      </div>
    );
  }

  // 2. GAME OVER
  if (view === 'gameover' && gameState) {
    const humanPlayer = gameState.players[0];
    const isHumanWinner = gameState.winnerId === humanPlayer.id;
    const winner = gameState.players.find(p => p.id === gameState.winnerId);
    const shareText = isHumanWinner
      ? isDailySeedRun
        ? `🃏 Jack Attack Street — Daily ${dailyRankResult?.day || getTodayUtcKey()}\n🏆 ${dailyRankResult ? `Ranked #${dailyRankResult.rank} of ${dailyRankResult.total}` : 'Cleared!'} • ⏱️ ${formatDuration(lastMatchDurationMs)} • 🃏 ${cardsPlayedRef.current} cards\nSame deck for everyone — can you beat my time?\nhttps://www.jackattackstreets.com/jackattack/?daily=1`
        : `🃏 I just won Jack Attack Street (${gameState.difficulty.toUpperCase()}) in ${formatDuration(lastMatchDurationMs)} playing ${cardsPlayedRef.current} cards! 🏆 Can you beat me?\nhttps://www.jackattackstreets.com/jackattack/`
      : `🃏 Just played a wild match of Jack Attack Street! Think you can beat ${winner?.name || 'the bots'}?\nhttps://www.jackattackstreets.com/jackattack/`;

    const handleShareResult = async () => {
      playClickSound();
      try {
        if (navigator.share) {
          await navigator.share({
            title: 'Jack Attack Street',
            text: shareText,
            url: 'https://www.jackattackstreets.com/jackattack/',
          });
          return;
        }
      } catch {
        // Fall back to clipboard copy if share sheet dismissed or unsupported
      }
      try {
        await navigator.clipboard.writeText(shareText);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      } catch {
        // Ignore clipboard errors in restricted contexts
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-pink-900 flex flex-col items-center justify-center text-white relative font-sans p-4 text-center">
        {/* Confetti on win */}
        {showConfetti && <ConfettiEffect />}

        <div className="bg-white/10 p-8 sm:p-10 rounded-[2.5rem] border-4 border-white/20 backdrop-blur-md shadow-2xl max-w-md w-full">
          <div className="text-7xl sm:text-8xl mb-4 filter drop-shadow-lg animate-bounce">{isHumanWinner ? "🏆" : "😭"}</div>
          <h1 className="text-5xl sm:text-6xl font-black mb-3 drop-shadow-lg text-yellow-400">{isHumanWinner ? "YOU WON!" : "GAME OVER"}</h1>
          <p className="text-xl sm:text-2xl font-bold mb-5 text-pink-100">{isHumanWinner ? "You're the King of the Street!" : `${winner?.avatar} ${winner?.name} won this time!`}</p>

          {isHumanWinner && isDailySeedRun && dailyRankResult && (
            <div className="mb-5 bg-yellow-400/20 border-2 border-yellow-400 rounded-2xl px-4 py-2.5 text-yellow-200 font-black text-sm">
              🏆 Daily Seed Rank: #{dailyRankResult.rank} of {dailyRankResult.total} {dailyRankResult.improved ? '(New Best!)' : ''}
            </div>
          )}

          {/* Match Summary */}
          <div className="flex justify-center gap-3 mb-6 text-sm">
            <div className="bg-black/25 px-4 py-2 rounded-xl border border-white/15">
              <div className="text-purple-200 text-xs uppercase font-bold">Time</div>
              <div className="font-black text-base">{formatDuration(lastMatchDurationMs)}</div>
            </div>
            <div className="bg-black/25 px-4 py-2 rounded-xl border border-white/15">
              <div className="text-purple-200 text-xs uppercase font-bold">Cards Played</div>
              <div className="font-black text-base">{cardsPlayedRef.current}</div>
            </div>
            {stats && isHumanWinner && (
              <div className="bg-black/25 px-4 py-2 rounded-xl border border-white/15">
                <div className="text-purple-200 text-xs uppercase font-bold">Streak</div>
                <div className="font-black text-base">🔥 {stats.currentWinStreak}</div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3 justify-center">
            <button onClick={() => setView('menu')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-full border-b-4 border-gray-800 transition-transform active:border-b-0 active:translate-y-1">Menu</button>
            <button onClick={handleShareResult} className="bg-purple-500 hover:bg-purple-400 text-white font-bold py-3 px-6 rounded-full border-b-4 border-purple-700 transition-transform active:border-b-0 active:translate-y-1">
              {shareCopied ? '✓ Copied!' : '📤 Share'}
            </button>
            <button onClick={() => startNewGame(gameState.players.length, gameState.difficulty, gameState.gameMode)} className="bg-yellow-400 hover:bg-yellow-300 text-black font-black py-3 px-7 rounded-full border-b-4 border-yellow-600 shadow-xl transition-transform hover:scale-105 active:border-b-0 active:translate-y-1">Play Again ↺</button>
          </div>
        </div>
      </div>
    );
  }

  if (!gameState) return null;

  const humanPlayer = gameState.players[0];
  const topCard = gameState.discardPile[gameState.discardPile.length - 1];
  const isPlayerTurn = gameState.currentPlayerIndex === 0;
  const mustPickup = isPlayerTurn && gameState.pendingPickup > 0;

  // 3. GAMEPLAY
  return (
    <div className={`min-h-screen bg-gradient-to-br from-violet-600 via-indigo-700 to-purple-800 text-white overflow-hidden relative font-sans select-none touch-none ${isShaking ? 'animate-shake' : ''}`}
      style={isShaking ? { animation: 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both' } : {}}
    >
      {/* Shake Animation Styles */}
      <style>{`
        @keyframes shake {
          10%, 90% { transform: translate3d(-2px, 0, 0); }
          20%, 80% { transform: translate3d(4px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-6px, 0, 0); }
          40%, 60% { transform: translate3d(6px, 0, 0); }
        }
        @keyframes confetti-fall {
          0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes card-glow {
          0%, 100% { box-shadow: 0 0 15px 5px rgba(250, 204, 21, 0.4); }
          50% { box-shadow: 0 0 25px 10px rgba(250, 204, 21, 0.7); }
        }
        @keyframes card-slide-in {
          0% { transform: translateY(50px) scale(0.8); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes float-up {
          0% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
          100% { transform: translateY(0); }
        }
        .playable-card-glow {
          animation: card-glow 1.5s ease-in-out infinite;
        }
        .card-enter {
          animation: card-slide-in 0.3s ease-out forwards;
        }
        @keyframes sort-shuffle {
          0% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
        .sorting-card {
          animation: sort-shuffle 0.3s ease-in-out;
        }
        @keyframes toast-slide-in {
          0% { transform: translateX(-100%); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        .toast-enter {
          animation: toast-slide-in 0.3s ease-out forwards;
        }
      `}</style>

      {/* POWER-UP MODALS */}
      {gameState.pendingSuitChoice && !gameState.players[gameState.currentPlayerIndex].isBot && (
        <SuitPicker onSelectSuit={handleSuitChoice} />
      )}

      {gameState.pendingSwap && !gameState.players[gameState.currentPlayerIndex].isBot && (
        <SwapPicker
          players={gameState.players}
          currentPlayerId={gameState.players[gameState.currentPlayerIndex].id}
          onSelectPlayer={handleSwapChoice}
        />
      )}

      {gameState.peekingCard && (
        <PeekCard
          card={gameState.peekingCard}
          player={gameState.players.find(p => p.id === gameState.peekingPlayerId)}
          onDismiss={handleDismissPeek}
        />
      )}

      {/* LOCAL MULTIPLAYER PASS SCREEN */}
      {gameState.showPassScreen && gameState.gameMode === GameMode.LocalMultiplayer && (
        <PassScreen
          playerName={gameState.nextPlayerName}
          playerAvatar={gameState.players[gameState.currentPlayerIndex]?.avatar || '😎'}
          onReady={handlePassScreenConfirm}
        />
      )}

      {/* COMMENTARY BUBBLE */}
      {currentCommentary && (
        <CommentaryBubble
          commentary={currentCommentary}
          position={commentaryPosition}
          onComplete={() => setCurrentCommentary(null)}
        />
      )}

      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>

      {flyingCard && (
        <FlyingCardComponent
          card={flyingCard.card}
          start={flyingCard.start}
          end={flyingCard.end}
          faceDown={flyingCard.faceDown}
          onComplete={flyingCard.onComplete}
        />
      )}

      {/* TOP BAR */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-50 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="bg-black/30 backdrop-blur px-4 py-2 rounded-full text-white font-bold border border-white/20 flex items-center gap-2">
            <span className="text-xl">{gameState.direction === 1 ? '➡️' : '⬅️'}</span>
            {gameState.direction === 1 ? 'Clockwise' : 'Reverse'}
          </div>
          <button
            onClick={() => {
              toggleBackgroundMusic();
              setMusicEnabled(!musicEnabled);
            }}
            className={`backdrop-blur px-3 py-2 rounded-full font-bold border transition-all text-xl ${musicEnabled ? 'bg-green-500/50 border-green-400' : 'bg-black/30 border-white/20'}`}
            title="Toggle commentary & sound"
            aria-label={musicEnabled ? 'Sound enabled - click to mute' : 'Sound muted - click to enable'}
          >
            {musicEnabled ? '🔊' : '🔇'}
          </button>
          <button
            onClick={() => setHintsEnabled(!hintsEnabled)}
            className={`backdrop-blur px-3 py-2 rounded-full font-bold border transition-all text-xl ${hintsEnabled ? 'bg-green-500/50 border-green-400' : 'bg-black/30 border-white/20'
              }`}
            title="Show a tip for this turn"
            aria-label={hintsEnabled ? 'Hints enabled - click to disable' : 'Hints disabled - click to enable'}
          >
            💡
          </button>
        </div>
        <button onClick={() => setView('menu')} className="pointer-events-auto bg-red-500 hover:bg-red-600 text-white font-bold px-4 py-2 rounded-full border-b-4 border-red-700 active:border-b-0 active:translate-y-1 transition-all">EXIT</button>
      </div>

      {/* HAND HINTS */}
      <HandHints gameState={gameState} enabled={hintsEnabled} />

      {/* ERROR MESSAGE / TOAST - Small top-left notification */}
      {errorMsg && (
        <div className="fixed top-4 left-4 z-[60] max-w-xs bg-red-500/95 text-white px-4 py-2 rounded-xl shadow-lg toast-enter border-2 border-red-300 font-bold text-sm backdrop-blur-sm">
          {errorMsg}
        </div>
      )}

      {/* CENTER TABLE */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Game Status Banner */}
        <div className="absolute top-[20%] md:top-[28%] z-0 w-full text-center pointer-events-none">
          <span className="inline-block bg-indigo-900/60 text-indigo-100 px-6 py-2 rounded-full text-sm md:text-lg font-bold backdrop-blur-md border border-indigo-500/50 shadow-lg max-w-[90%] truncate">
            {gameState.lastAction}
          </span>
        </div>

        <div className="flex items-center gap-8 md:gap-20 z-10 mt-[-40px]">
          {/* Draw Pile */}
          <div className="flex flex-col items-center group relative">
            <button
              ref={drawPileRef}
              onClick={handleDrawClick}
              disabled={!isPlayerTurn}
              style={{ ...cardBackPattern }}
              className={`w-24 h-36 md:w-32 md:h-48 rounded-2xl border-4 border-white/30 shadow-2xl flex items-center justify-center transition-all transform ${mustPickup ? 'ring-8 ring-red-500 animate-pulse scale-105' : 'hover:-translate-y-2 hover:shadow-indigo-500/50'} ${!isPlayerTurn ? 'opacity-80' : 'cursor-pointer'}`}
            >
              <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
                <span className="font-black text-2xl text-white drop-shadow-md">{mustPickup ? `+${gameState.pendingPickup}` : 'DRAW'}</span>
              </div>
            </button>
            {/* Deck thickness illusion */}
            <div className="absolute top-1 left-1 w-full h-full rounded-2xl bg-blue-800 -z-10"></div>
            <div className="absolute top-2 left-2 w-full h-full rounded-2xl bg-blue-900 -z-20"></div>

            <p className="mt-4 text-sm font-bold text-indigo-200 bg-black/30 px-3 py-1 rounded-full">{gameState.deck.length} Cards</p>
          </div>

          {/* Discard Pile */}
          <div ref={discardRef} className="flex flex-col items-center relative">
            {gameState.pendingPickup > 0 && <div className="absolute -top-16 bg-red-600 text-white font-black text-xl px-6 py-2 rounded-full shadow-lg animate-bounce z-20 border-4 border-white rotate-6 whitespace-nowrap">ATTACK INCOMING!</div>}
            {gameState.chosenSuit && gameState.pendingPickup === 0 && (
              <div className="absolute -top-12 bg-yellow-400 text-black font-black text-sm md:text-base px-4 py-1.5 rounded-full shadow-lg z-20 border-2 border-white whitespace-nowrap flex items-center gap-1.5">
                <span>👑 Wild Suit:</span>
                <span className={`text-xl leading-none ${['♥', '♦'].includes(gameState.chosenSuit) ? 'text-red-600' : 'text-gray-900'}`}>{gameState.chosenSuit}</span>
              </div>
            )}

            <div className={`w-24 h-36 md:w-32 md:h-48 bg-white text-black rounded-2xl shadow-2xl flex flex-col items-center justify-center border-b-8 border-r-8 border-gray-300 relative overflow-hidden transform rotate-3 transition-transform`}>
              <span className="font-black text-6xl md:text-7xl z-10 drop-shadow-sm">{topCard.rank}</span>
              <span className={`absolute text-[9rem] opacity-10 ${['♥', '♦'].includes(topCard.suit) ? 'text-red-600' : 'text-gray-900'}`}>{topCard.suit}</span>

              {/* Corner Indices - Large and High Contrast */}
              <div className="absolute top-1.5 left-2 flex flex-col items-center leading-none">
                <span className={`text-2xl md:text-3xl font-black ${['♥', '♦'].includes(topCard.suit) ? 'text-red-600' : 'text-gray-900'}`}>{topCard.rank}</span>
                <span className={`text-3xl md:text-4xl font-black ${['♥', '♦'].includes(topCard.suit) ? 'text-red-600' : 'text-gray-900'}`}>{topCard.suit}</span>
              </div>
              <div className="absolute bottom-1.5 right-2 flex flex-col items-center leading-none transform rotate-180">
                <span className={`text-2xl md:text-3xl font-black ${['♥', '♦'].includes(topCard.suit) ? 'text-red-600' : 'text-gray-900'}`}>{topCard.rank}</span>
                <span className={`text-3xl md:text-4xl font-black ${['♥', '♦'].includes(topCard.suit) ? 'text-red-600' : 'text-gray-900'}`}>{topCard.suit}</span>
              </div>
            </div>
            <p className="mt-4 text-sm font-bold text-indigo-200 bg-black/30 px-3 py-1 rounded-full">
              {gameState.chosenSuit ? `Suit: ${gameState.chosenSuit}` : 'Top Card'}
            </p>
          </div>
        </div>
      </div>

      {/* BOTS */}
      {gameState.players.map((p, idx) => {
        if (!p.isBot) return null;
        const position = getPlayerPosition(idx, gameState.players.length);
        const isCurrentTurn = gameState.players[gameState.currentPlayerIndex].id === p.id;

        let containerClass = "absolute flex flex-col items-center p-2 transition-all duration-300 z-20 ";
        if (position === 'top') containerClass += "top-4 left-1/2 -translate-x-1/2";
        if (position === 'left') containerClass += "left-2 top-[40%] md:top-1/2 -translate-y-1/2 origin-left scale-90";
        if (position === 'right') containerClass += "right-2 top-[40%] md:top-1/2 -translate-y-1/2 origin-right scale-90";

        return (
          <div key={p.id} ref={el => { botRefs.current[idx] = el }} className={containerClass}>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full border-b-4 mb-2 text-sm font-bold shadow-lg transition-all ${isCurrentTurn ? 'bg-yellow-400 text-black border-yellow-600 scale-110' : 'bg-gray-800 border-gray-900 text-gray-300'}`}>
              <span className="text-2xl">{p.avatar}</span>
              <span>{p.name}</span>
              {isCurrentTurn && <span className="animate-spin">⏳</span>}
            </div>

            <div className="flex -space-x-8">
              {p.hand.map((card, cIdx) => (
                cIdx < 6 && (
                  <div key={card.id} className="w-10 h-14 md:w-12 md:h-16 rounded-lg border-2 border-white shadow-md relative overflow-hidden transform hover:-translate-y-2 transition-transform" style={{ zIndex: cIdx, ...cardBackPattern }}></div>
                )
              ))}
              {p.hand.length > 6 && (
                <div className="w-10 h-14 flex items-center justify-center font-bold text-white bg-indigo-900 rounded-lg border-2 border-white z-10 shadow-lg">
                  +{p.hand.length - 6}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* PLAYER HAND */}
      <div ref={playerHandRef} className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-safe pt-2 z-30">
        {/* Control Bar */}
        <div className="flex gap-3 items-center mb-3 z-50">
          <div className={`px-6 py-2.5 rounded-full text-base md:text-lg font-black shadow-xl transition-all border-b-4 ${isPlayerTurn ? mustPickup ? 'bg-red-500 text-white border-red-700 scale-105 animate-bounce' : 'bg-yellow-400 text-black border-yellow-600' : 'bg-gray-700 text-gray-400 border-gray-900'}`}>
            {isPlayerTurn ? (mustPickup ? "DEFEND OR DRAW!" : "YOUR TURN!") : "WAITING..."}
          </div>
          {isPlayerTurn && <button onClick={handleSortClick} className="bg-blue-500 hover:bg-blue-400 text-white font-bold px-4 py-2.5 rounded-full border-b-4 border-blue-700 active:border-b-0 active:translate-y-1 transition-all text-sm md:text-base">Sort Cards</button>}
          {gameState.canUndo && isPlayerTurn && (
            <button
              onClick={() => {
                const previousState = undoLastMove(gameState);
                if (previousState) {
                  playClickSound();
                  setGameState(previousState);
                }
              }}
              className="bg-orange-500 hover:bg-orange-400 text-white font-bold px-4 py-2.5 rounded-full border-b-4 border-orange-700 active:border-b-0 active:translate-y-1 transition-all text-sm md:text-base"
            >
              ↩️ Undo
            </button>
          )}
        </div>

        {/* Cards Container */}
        <div className={`flex flex-wrap justify-center ${humanPlayer.hand.length > 9 ? '-space-x-7 md:-space-x-9' : '-space-x-4 md:-space-x-6'} px-4 w-full max-w-5xl pb-4 min-h-[145px] items-end`}>
          {humanPlayer.hand.map((card, i) => {
            const canStack = mustPickup && isValidMove(card, topCard, gameState.pendingPickup, gameState.chosenSuit);
            const normalPlay = !mustPickup && isPlayerTurn && isValidMove(card, topCard, 0, gameState.chosenSuit);
            const playable = canStack || normalPlay;
            const isRed = ['♥', '♦'].includes(card.suit);
            const isHidden = card.id === hiddenCardId;

            // High-contrast suit colors
            const suitColor = isRed ? 'text-red-600' : 'text-gray-900';

            return (
              <div
                key={card.id}
                data-card-id={card.id} // Add data attribute for easier ref finding
                onClick={(e) => handleCardClick(e, card)}
                style={{
                  marginBottom: playable ? '22px' : '0px',
                  zIndex: i,
                  opacity: isHidden ? 0 : 1,
                  transform: `rotate(${(i - humanPlayer.hand.length / 2) * (humanPlayer.hand.length > 9 ? 1.2 : 2)}deg)` // Slight fan effect
                }}
                className={`${getCardStyles(card, playable, isRed)} ${playable ? 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-purple-800 playable-card-glow' : ''} ${mustPickup && !playable ? 'grayscale opacity-60' : ''} ${canStack ? 'ring-red-500 animate-pulse' : ''} ${isSorting ? 'sorting-card' : ''}`}
              >
                {/* Top-left corner - Large rank and suit */}
                <div className="flex flex-col items-center leading-none self-start">
                  <span className={`font-black text-2xl md:text-3xl ${suitColor}`}>{card.rank}</span>
                  <span className={`text-3xl md:text-4xl font-black ${suitColor}`}>{card.suit}</span>
                </div>
                {/* Center watermark */}
                <div className={`absolute inset-0 flex items-center justify-center text-7xl opacity-10 pointer-events-none ${suitColor}`}>{card.suit}</div>
                {/* Bottom-right corner - Large rank and suit (rotated) */}
                <div className="flex flex-col items-center leading-none self-end transform rotate-180">
                  <span className={`font-black text-2xl md:text-3xl ${suitColor}`}>{card.rank}</span>
                  <span className={`text-3xl md:text-4xl font-black ${suitColor}`}>{card.suit}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- FLYING CARD (Animation) ---
const FlyingCardComponent: React.FC<FlyingCardState> = ({ card, start, end, faceDown, onComplete }) => {
  const [style, setStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    top: start.top,
    left: start.left,
    width: start.width,
    height: start.height,
    zIndex: 9999,
    transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)', // Bouncy bezier
    transform: 'scale(1) rotate(0deg)',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  });

  useEffect(() => {
    requestAnimationFrame(() => {
      setStyle(prev => ({
        ...prev,
        top: end.top,
        left: end.left,
        width: end.width,
        height: end.height,
        transform: 'scale(1) rotate(360deg)',
      }));
    });
  }, []);

  if (faceDown) {
    return (
      <div onTransitionEnd={onComplete} style={{ ...style, ...cardBackPattern }} className="rounded-2xl border-4 border-white/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-1 left-1 w-full h-full rounded-xl bg-black/10"></div>
      </div>
    );
  }

  const isRed = ['♥', '♦'].includes(card.suit);
  const suitColor = isRed ? 'text-red-600' : 'text-gray-900';

  return (
    <div onTransitionEnd={onComplete} style={style} className="bg-white rounded-2xl border-b-4 border-gray-300 flex flex-col justify-between p-2 pointer-events-none">
      <div className="flex flex-col items-center leading-none self-start"><span className={`font-black text-2xl md:text-3xl ${suitColor}`}>{card.rank}</span><span className={`text-3xl md:text-4xl font-black ${suitColor}`}>{card.suit}</span></div>
      <div className={`absolute inset-0 flex items-center justify-center text-7xl opacity-10 ${suitColor}`}>{card.suit}</div>
      <div className="flex flex-col items-center leading-none self-end transform rotate-180"><span className={`font-black text-2xl md:text-3xl ${suitColor}`}>{card.rank}</span><span className={`text-3xl md:text-4xl font-black ${suitColor}`}>{card.suit}</span></div>
    </div>
  );
};

// --- ENHANCED CONFETTI EFFECT ---
const ConfettiEffect: React.FC = () => {
  const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ff8800', '#ff0088', '#ffd700', '#7fff00'];
  const emojis = ['🎉', '🎊', '⭐', '✨', '🏆', '👑', '💎', '🔥'];

  const confettiPieces = Array.from({ length: 80 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.5,
    duration: 2.5 + Math.random() * 2.5,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: 6 + Math.random() * 10,
    rotation: Math.random() * 360,
    rotationSpeed: 180 + Math.random() * 540, // degrees to rotate during fall
    type: Math.random() > 0.85 ? 'emoji' : (Math.random() > 0.5 ? 'circle' : (Math.random() > 0.5 ? 'square' : 'star')),
    emoji: emojis[Math.floor(Math.random() * emojis.length)],
    horizontalDrift: (Math.random() - 0.5) * 100, // drift left or right
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      <style>{`
        @keyframes confetti-enhanced {
          0% { 
            transform: translateY(-100px) translateX(0) rotate(0deg) scale(1); 
            opacity: 1; 
          }
          50% {
            opacity: 1;
          }
          100% { 
            transform: translateY(100vh) translateX(var(--drift)) rotate(var(--rotation)) scale(0.5); 
            opacity: 0; 
          }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      `}</style>
      {confettiPieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute"
          style={{
            left: `${piece.left}%`,
            top: '-20px',
            width: piece.type === 'emoji' ? 'auto' : `${piece.size}px`,
            height: piece.type === 'emoji' ? 'auto' : `${piece.size}px`,
            backgroundColor: piece.type === 'emoji' ? 'transparent' : piece.color,
            borderRadius: piece.type === 'circle' ? '50%' : piece.type === 'star' ? '0%' : '2px',
            clipPath: piece.type === 'star' ? 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' : undefined,
            fontSize: piece.type === 'emoji' ? `${piece.size + 8}px` : undefined,
            ['--drift' as string]: `${piece.horizontalDrift}px`,
            ['--rotation' as string]: `${piece.rotationSpeed}deg`,
            animation: `confetti-enhanced ${piece.duration}s ease-out ${piece.delay}s forwards`,
            transformOrigin: 'center center',
          }}
        >
          {piece.type === 'emoji' ? piece.emoji : null}
        </div>
      ))}
      {/* Extra sparkle bursts */}
      {Array.from({ length: 12 }, (_, i) => (
        <div
          key={`sparkle-${i}`}
          className="absolute text-4xl"
          style={{
            left: `${10 + (i * 7)}%`,
            top: `${20 + Math.random() * 30}%`,
            animation: `sparkle 0.5s ease-in-out ${i * 0.1}s 3`,
          }}
        >
          ✨
        </div>
      ))}
    </div>
  );
};

export default App;
