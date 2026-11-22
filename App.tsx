import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createNewGame, isValidMove, playCard, drawCard, getBotDecision, sortHand, chooseSuit, swapWith, clearPeek, botChooseSuit, botChooseSwap, confirmPassScreen, triggerPassScreen, saveStateForUndo, undoLastMove } from './core/game';
import { GameState, Card, Player, Suit, Rank, Difficulty, GameMode } from './core/types';
import { playCardSound, playDrawSound, playShuffleSound, playAttackSound, playWinSound, playLoseSound, playClickSound, initAudio, toggleBackgroundMusic, isMusicPlaying, playPowerUpSound, playCoinsSound, playEncourageSound } from './core/sounds';
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
import PlayingCard, { getThemeCardBackStyle } from './components/PlayingCard';
import ImpactBanner, { ImpactEvent } from './components/ImpactBanner';
import { createOnlineRoom, loadNickname, saveNickname } from './core/online';
import { getDailySeed, getTodayUtcKey, submitDailyScore } from './core/dailyLeaderboard';
import { getTodaysChallenge, getDailyProgress, checkChallengeCompletion } from './core/challenges';
import { getCurrentTheme, CardTheme, unlockTheme, isThemeUnlocked } from './core/themes';
import { loadInventory, usePowerUp, powerUpCatalog, PowerUpInventory } from './core/powerups';
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

  // Drop A & B: Arcade impact banner, power-up inventory, X-Ray overlay, coins earned
  const [impact, setImpact] = useState<ImpactEvent | null>(null);
  const [inventory, setInventory] = useState<PowerUpInventory>(() => loadInventory());
  const [xrayView, setXrayView] = useState<{ name: string; avatar: string; cards: Card[] } | null>(null);
  const [lastCoinsEarned, setLastCoinsEarned] = useState<number>(0);

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

    const coinsBefore = stats.coins;
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
    setLastCoinsEarned(Math.max(0, newStats.coins - coinsBefore));
    setStats(newStats);

    // Auto-unlock themes based on milestones
    if (newStats.wins >= 10 && !isThemeUnlocked('neon')) unlockTheme('neon');
    if (newStats.wins >= 25 && !isThemeUnlocked('vintage')) unlockTheme('vintage');

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
        const activeRules = isDailySeedRun ? undefined : gameRules;
        const decision = getBotDecision(gameState, activeRules);
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
              const nextState = playCard(gameState, decision.cardId!, activeRules);

              // Trigger effects, impact banners, and commentary
              if (nextState.pendingPickup >= 5) {
                triggerShake();
                setImpact({ id: Date.now(), title: `🔥 MEGA +${nextState.pendingPickup} ATTACK!`, subtitle: 'Defend or draw!', tone: 'attack' });
                showCommentary('attack', botPosition);
              } else if (nextState.pendingPickup >= 4) {
                triggerShake();
                setImpact({ id: Date.now(), title: `💥 +${nextState.pendingPickup} STACK!!`, tone: 'attack' });
                showCommentary('attack', botPosition);
              } else if (isAttackCard && nextState.pendingPickup > 0) {
                triggerShake();
                showCommentary('attack', botPosition);
              } else if (cardToPlay.rank === 'K' && (!activeRules || activeRules.enableSwap)) {
                setImpact({ id: Date.now(), title: '🤴 HANDS SWAPPED!', tone: 'swap' });
                showCommentary('swap', botPosition);
              } else if (isSkip) {
                showCommentary('skip', botPosition);
              } else if (isPeek) {
                showCommentary('peek', botPosition);
              } else if (nextState.players[gameState.currentPlayerIndex]?.hand.length === 1) {
                setImpact({ id: Date.now(), title: `⚠️ ${currentPlayer.name}: LAST CARD!`, tone: 'danger' });
                showCommentary('almost_win', botPosition);
              }

              setGameState(nextState);
              checkWin(nextState);
            });
          } else {
            playCardSound();
            const nextState = playCard(gameState, decision.cardId, activeRules);
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

  // --- COMMENTARY HELPER (Uses selected Personality Style!) ---
  const showCommentary = (type: CommentaryType, position: 'top' | 'left' | 'right') => {
    const styledText = getStyledCommentary(type, currentPersonality);
    const fallback = getCommentary(type);
    setCurrentCommentary({
      text: styledText || fallback.text,
      emoji: fallback.emoji,
      type,
    });
    setCommentaryPosition(position);
  };

  // --- IN-GAME POWER-UP ACTIVATION ---
  const handleUsePowerUp = (powerUpId: string) => {
    if (!gameState || view !== 'playing' || gameState.currentPlayerIndex !== 0 || isDailySeedRun) return;
    if (!inventory[powerUpId] || inventory[powerUpId] <= 0) return;

    const topCard = gameState.discardPile[gameState.discardPile.length - 1];

    if (powerUpId === 'block_attack') {
      if (gameState.pendingPickup <= 0) {
        setErrorMsg('🛡️ Use Shield when facing a +2 or +5 attack!');
        setTimeout(() => setErrorMsg(null), 2000);
        return;
      }
      if (!usePowerUp(powerUpId)) return;
      playPowerUpSound();
      setInventory(loadInventory());
      setGameState({ ...gameState, pendingPickup: 0, lastAction: '🛡️ Shield blocked the attack!' });
      setImpact({ id: Date.now(), title: '🛡️ ATTACK BLOCKED!', tone: 'shield' });
      return;
    }

    if (powerUpId === 'draw_best') {
      const idx = gameState.deck.findIndex((c) => isValidMove(c, topCard, gameState.pendingPickup, gameState.chosenSuit, gameRules));
      if (idx === -1) {
        setErrorMsg('🍀 No matching card left in the deck!');
        setTimeout(() => setErrorMsg(null), 2000);
        return;
      }
      if (!usePowerUp(powerUpId)) return;
      playPowerUpSound();
      setInventory(loadInventory());
      const nextDeck = [...gameState.deck];
      const [found] = nextDeck.splice(idx, 1);
      const nextPlayers = gameState.players.map((p, i) =>
        i === 0 ? { ...p, hand: sortHand([...p.hand, found]) } : p
      );
      setGameState({ ...gameState, deck: nextDeck, players: nextPlayers, lastAction: `🍀 Lucky Draw pulled ${found.rank}${found.suit}!` });
      return;
    }

    if (powerUpId === 'peek_all') {
      const opp = gameState.players.find((p) => p.isBot && p.hand.length > 0);
      if (!opp) return;
      if (!usePowerUp(powerUpId)) return;
      playPowerUpSound();
      setInventory(loadInventory());
      setXrayView({ name: opp.name, avatar: opp.avatar, cards: [...opp.hand] });
      window.setTimeout(() => setXrayView(null), 4500);
      return;
    }

    if (powerUpId === 'discard_wild') {
      if (!usePowerUp(powerUpId)) return;
      playPowerUpSound();
      setInventory(loadInventory());
      setGameState({ ...gameState, pendingPickup: 0, pendingSuitChoice: true, lastAction: '🃏 Wild Power-Up! Choose any suit!' });
      return;
    }

    if (powerUpId === 'shuffle_enemy') {
      const oppIdx = gameState.players.findIndex((p) => p.isBot && p.hand.length > 0);
      if (oppIdx < 0 || gameState.deck.length < 2) return;
      if (!usePowerUp(powerUpId)) return;
      playPowerUpSound();
      setInventory(loadInventory());
      const deckCopy = [...gameState.deck];
      const oppHand = [...gameState.players[oppIdx].hand];
      const swapCount = Math.min(2, oppHand.length, deckCopy.length);
      for (let i = 0; i < swapCount; i++) {
        const r = Math.floor(Math.random() * oppHand.length);
        const removed = oppHand.splice(r, 1)[0];
        const drawn = deckCopy.pop()!;
        oppHand.push(drawn);
        deckCopy.unshift(removed);
      }
      const nextPlayers = gameState.players.map((p, i) => (i === oppIdx ? { ...p, hand: oppHand } : p));
      setGameState({ ...gameState, deck: deckCopy, players: nextPlayers, lastAction: `🌀 Confused ${gameState.players[oppIdx].name}'s hand!` });
      return;
    }

    if (powerUpId === 'extra_turn') {
      if (!usePowerUp(powerUpId)) return;
      playPowerUpSound();
      setInventory(loadInventory());
      setErrorMsg('⏩ Double Time active — draw skipped & stay on your turn!');
      setTimeout(() => setErrorMsg(null), 2200);
      setGameState({ ...gameState, pendingPickup: 0, lastAction: '⏩ Double Time! Take another move!' });
    }
  };

  // Helper: trigger Pass & Play privacy screen when turn passes to another human
  const maybeTriggerPass = (prevIdx: number, nextState: GameState): GameState => {
    if (
      nextState.gameMode === GameMode.LocalMultiplayer &&
      !nextState.winnerId &&
      !nextState.pendingSuitChoice &&
      !nextState.pendingSwap &&
      nextState.currentPlayerIndex !== prevIdx
    ) {
      return triggerPassScreen(nextState);
    }
    return nextState;
  };

  // --- POWER-UP HANDLERS ---
  const handleSuitChoice = (suit: Suit) => {
    if (!gameState) return;
    playClickSound();
    const prevIdx = gameState.currentPlayerIndex;
    const newState = maybeTriggerPass(prevIdx, chooseSuit(gameState, suit));
    setGameState(newState);
  };

  const handleSwapChoice = (targetPlayerId: string) => {
    if (!gameState) return;
    playClickSound();
    showCommentary('swap', 'top');
    const prevIdx = gameState.currentPlayerIndex;
    const newState = maybeTriggerPass(prevIdx, swapWith(gameState, targetPlayerId));
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

    const activeRules = isDailySeedRun ? undefined : gameRules;
    const topCard = gameState.discardPile[gameState.discardPile.length - 1];
    const mustPickup = gameState.pendingPickup > 0;
    const valid = isValidMove(card, topCard, gameState.pendingPickup, gameState.chosenSuit, activeRules);

    if (mustPickup && !valid) {
      const isBlackJackTop = topCard.rank === Rank.Jack && (topCard.suit === Suit.Spades || topCard.suit === Suit.Clubs);
      setErrorMsg(
        activeRules?.enableStacking === false
          ? '🛡️ Stacking disabled in Custom Rules — Pick Up!'
          : isBlackJackTop
            ? `🛡️ Stack a Black Jack (J♠/J♣), cancel with a Red Jack (J♥/J♦), or Pick Up!`
            : `🛡️ Defend with a ${topCard.rank} or Pick Up!`
      );
      setTimeout(() => setErrorMsg(null), 2500);
      return;
    }

    if (valid) {
      setErrorMsg(null);
      const rect = e.currentTarget.getBoundingClientRect();
      const prevIdx = gameState.currentPlayerIndex;

      // Check if it's an attack card
      const isAttackCard = card.rank === '2' || (card.rank === 'J' && (card.suit === '♠' || card.suit === '♣'));

      triggerPlayAnimation(card, rect, () => {
        playCardSound();
        // Save state for undo before playing
        const stateWithUndo = saveStateForUndo(gameState);
        const rawNext = playCard(stateWithUndo, card.id, activeRules);

        // Track cards played for stats
        cardsPlayedRef.current++;
        if (rawNext.lastAction.includes('RED JACK')) {
          playPowerUpSound();
          setImpact({ id: Date.now(), title: '🛡️ RED JACK CANCEL!', subtitle: 'Black Jack attack neutralized!', tone: 'shield' });
        } else if (rawNext.pendingPickup >= 5) {
          attackCardsUsedRef.current++;
          triggerShake();
          setImpact({ id: Date.now(), title: `🔥 MEGA +${rawNext.pendingPickup} ATTACK!`, tone: 'attack' });
        } else if (rawNext.pendingPickup >= 4) {
          attackCardsUsedRef.current++;
          triggerShake();
          setImpact({ id: Date.now(), title: `💥 +${rawNext.pendingPickup} STACK!!`, tone: 'attack' });
        } else if (isAttackCard && rawNext.pendingPickup > 0) {
          attackCardsUsedRef.current++;
          triggerShake();
        } else if (card.rank === 'K' && (!activeRules || activeRules.enableSwap)) {
          setImpact({ id: Date.now(), title: '🤴 HANDS SWAPPED!', tone: 'swap' });
        } else if (rawNext.players[prevIdx]?.hand.length === 1 && !rawNext.winnerId) {
          setImpact({ id: Date.now(), title: '⚠️ LAST CARD!', subtitle: 'One more to win!', tone: 'danger' });
        }

        const newState = maybeTriggerPass(prevIdx, rawNext);
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

    const prevIdx = gameState.currentPlayerIndex;
    const wasPenalty = gameState.pendingPickup > 0;
    const finishDraw = () => {
      playDrawSound();
      const newState = maybeTriggerPass(prevIdx, drawCard(gameState));
      setGameState(newState);
      setErrorMsg(null);
      if (wasPenalty) {
        playEncourageSound();
        setImpact({
          id: Date.now(),
          title: '💪 COMEBACK TIME!',
          subtitle: 'One King or Black Jack flips the whole table!',
          tone: 'shield',
        });
      }
    };

    if (playerHandRef.current) {
      const targetRect = playerHandRef.current.getBoundingClientRect();
      targetRect.y -= 50;
      triggerDrawAnimation(targetRect, finishDraw);
    } else {
      finishDraw();
    }
  };

  const handleSortClick = () => {
    if (view !== 'playing' || !gameState || isSorting) return;

    // Trigger sort animation
    setIsSorting(true);

    setTimeout(() => {
      const newState = { ...gameState, players: [...gameState.players] };
      const targetIdx = gameState.gameMode === GameMode.LocalMultiplayer ? gameState.currentPlayerIndex : 0;
      const p = newState.players[targetIdx];
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
        theme={currentTheme}
        onLeave={handleLeaveRoom}
      />
    );
  }

  // 1. MENU (Full-width responsive 2-column Arcade Lobby on desktop, compact stack on mobile)
  if (view === 'menu') {
    const rankInfo = stats ? getRank(stats) : null;
    const rankPct = stats && rankInfo && rankInfo.nextAt > 0
      ? Math.min(100, Math.round((stats.wins / rankInfo.nextAt) * 100))
      : 100;

    return (
      <div className={`min-h-screen bg-gradient-to-br ${currentTheme.tableBackground} flex flex-col text-white font-sans relative overflow-x-hidden`}>
        {/* Subtle Ambient Glows */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 18% 22%, rgba(250, 204, 21, 0.16), transparent 42%), radial-gradient(circle at 82% 78%, rgba(236, 72, 153, 0.18), transparent 45%)',
          }}
        />
        <div
          className="fixed inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, #ffffff 2px, transparent 2px)', backgroundSize: '32px 32px' }}
        />

        {/* Top Navigation Bar */}
        <header className="relative z-20 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-2 flex items-center justify-between gap-3 flex-wrap">
          <a
            href="/"
            className="bg-black/35 hover:bg-black/55 backdrop-blur-md text-purple-100 hover:text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-full border border-white/20 transition-all shadow-md"
          >
            ← All Games
          </a>

          <div className="flex items-center gap-2 flex-wrap">
            {stats && (
              <div className="bg-yellow-400 text-black px-3.5 py-1.5 rounded-full font-display font-black text-sm border-b-4 border-yellow-600 flex items-center gap-1.5 tabular-nums">
                <span>🪙</span>
                <span>{stats.coins}</span>
              </div>
            )}
            <button
              onClick={() => { playClickSound(); setShowDailyBoard(true); }}
              className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-black px-4 py-1.5 rounded-full font-display font-black text-sm border-b-4 border-orange-700 transition-all"
            >
              🏆 Daily Leaderboard
            </button>
            <button
              onClick={() => { playClickSound(); setShowTutorial(true); }}
              className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-3.5 py-1.5 rounded-full font-bold text-xs sm:text-sm border border-white/20 transition-all"
            >
              ❓ How to Play
            </button>
          </div>
        </header>

        {/* Main Full-Canvas Grid */}
        <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center">
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-stretch">
            {/* LEFT COLUMN: Play Arena */}
            <div className="lg:col-span-7 bg-white/10 backdrop-blur-md p-5 sm:p-7 rounded-[2rem] shadow-2xl border-2 border-white/20 flex flex-col justify-between">
              {/* Hero Header + Fanned Power Cards */}
              <div className="flex items-center justify-between gap-4 mb-5">
                <div className="text-left">
                  <span className="inline-block bg-black/30 text-pink-200 text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full border border-white/15 mb-2">
                    Street Edition • Free Online
                  </span>
                  <h1 className="font-display text-4xl sm:text-5xl xl:text-6xl font-black leading-[0.95] tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-500">
                    JACK ATTACK
                  </h1>
                  <p className="text-xs sm:text-sm text-purple-100/90 mt-1.5 font-medium">
                    Stack +2s &amp; Black Jack +5s, swap hands, play online with friends.
                  </p>
                </div>

                {/* Decorative Fanned Power Cards (visible on sm+) */}
                <div className="hidden sm:flex items-center relative w-36 h-24 shrink-0" aria-hidden="true">
                  <div className="absolute left-0 top-2 w-14 h-20 rounded-xl bg-white text-red-600 font-display font-black text-lg flex flex-col items-center justify-center shadow-xl border-2 border-red-300 -rotate-12">
                    <span>2♥</span>
                    <span className="text-[9px] bg-red-500 text-white px-1.5 rounded-full mt-0.5">+2</span>
                  </div>
                  <div className="absolute left-10 top-0 w-16 h-22 rounded-xl bg-gradient-to-b from-slate-900 to-black text-amber-300 font-display font-black text-xl flex flex-col items-center justify-center shadow-2xl border-2 border-amber-400 z-10 py-3">
                    <span>J♠</span>
                    <span className="text-[9px] bg-amber-400 text-black px-1.5 rounded-full mt-0.5">🔥+5</span>
                  </div>
                  <div className="absolute left-20 top-2 w-14 h-20 rounded-xl bg-white text-purple-700 font-display font-black text-lg flex flex-col items-center justify-center shadow-xl border-2 border-purple-400 rotate-12">
                    <span>Q♦</span>
                    <span className="text-[9px] bg-purple-600 text-white px-1.5 rounded-full mt-0.5">WILD</span>
                  </div>
                </div>
              </div>

              {/* Mode Selector + Controls */}
              <div className="space-y-4">
                <div>
                  <p className="text-purple-200 text-xs mb-2 font-bold uppercase tracking-wider text-left">Choose Game Mode</p>
                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      onClick={() => { playClickSound(); setMenuTab('bot'); setSelectedGameMode(GameMode.VsBot); }}
                      className={`px-3 py-3 rounded-xl font-bold text-xs sm:text-sm border-b-4 transition-all ${menuTab === 'bot'
                        ? 'bg-blue-400 border-blue-600 text-black scale-[1.02] shadow-lg'
                        : 'bg-indigo-800/80 border-indigo-950 text-indigo-100 hover:bg-indigo-700'
                        }`}
                    >
                      🤖 vs Bot
                    </button>
                    <button
                      onClick={() => { playClickSound(); setMenuTab('online'); }}
                      className={`px-3 py-3 rounded-xl font-bold text-xs sm:text-sm border-b-4 transition-all ${menuTab === 'online'
                        ? 'bg-emerald-400 border-emerald-600 text-black scale-[1.02] shadow-lg'
                        : 'bg-indigo-800/80 border-indigo-950 text-indigo-100 hover:bg-indigo-700'
                        }`}
                    >
                      🌐 Online
                    </button>
                    <button
                      onClick={() => { playClickSound(); setMenuTab('local'); setSelectedGameMode(GameMode.LocalMultiplayer); }}
                      className={`px-3 py-3 rounded-xl font-bold text-xs sm:text-sm border-b-4 transition-all ${menuTab === 'local'
                        ? 'bg-pink-400 border-pink-600 text-black scale-[1.02] shadow-lg'
                        : 'bg-indigo-800/80 border-indigo-950 text-indigo-100 hover:bg-indigo-700'
                        }`}
                    >
                      👫 Pass &amp; Play
                    </button>
                  </div>
                </div>

                {menuTab === 'online' ? (
                  <div className="space-y-3 bg-black/25 p-4 rounded-2xl border border-white/15">
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
                        className="w-full px-4 py-2.5 rounded-xl bg-indigo-950/80 border-2 border-indigo-400/40 focus:border-yellow-400 focus:outline-none text-white font-bold text-sm placeholder:text-indigo-300/50"
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
                      className="w-full bg-gradient-to-r from-green-400 to-emerald-600 hover:from-green-500 hover:to-emerald-700 disabled:opacity-60 text-white font-display font-black py-3.5 px-6 rounded-xl shadow-xl text-lg sm:text-xl border-b-4 border-green-800 transition-all active:border-b-0 active:translate-y-0.5"
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
                        className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-950/80 border-2 border-indigo-400/40 focus:border-yellow-400 focus:outline-none text-white font-display font-black tracking-widest uppercase text-center text-sm placeholder:text-indigo-300/40"
                      />
                      <button
                        onClick={() => { playClickSound(); initAudio(); openRoom(joinCodeInput); }}
                        className="bg-yellow-400 hover:bg-yellow-300 text-black font-display font-black px-6 py-2.5 rounded-xl border-b-4 border-yellow-600 text-sm transition-all active:border-b-0 active:translate-y-0.5"
                      >
                        Join ▶
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 bg-black/20 p-4 rounded-2xl border border-white/10">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                      <div className="text-left">
                        <p className="text-purple-200 text-xs mb-2 font-bold uppercase tracking-wide">Players</p>
                        <div className="flex gap-2.5">
                          {[2, 3, 4].map(num => (
                            <button key={num} onClick={() => { playClickSound(); setSelectedPlayerCount(num); }} className={`flex-1 h-12 rounded-xl font-display font-black text-2xl border-b-4 transition-all ${selectedPlayerCount === num ? 'bg-yellow-400 border-yellow-600 text-black scale-105 shadow-lg' : 'bg-indigo-800/80 border-indigo-950 text-indigo-200 hover:bg-indigo-700'}`}>{num}</button>
                          ))}
                        </div>
                      </div>

                      {menuTab === 'bot' && (
                        <div className="text-left">
                          <p className="text-purple-200 text-xs mb-2 font-bold uppercase tracking-wide">Difficulty</p>
                          <div className="flex gap-2">
                            {[
                              { level: Difficulty.Easy, label: '🌟 Easy', color: 'green' },
                              { level: Difficulty.Medium, label: '🔥 Med', color: 'yellow' },
                              { level: Difficulty.Hard, label: '💀 Hard', color: 'red' },
                            ].map(({ level, label, color }) => (
                              <button
                                key={level}
                                onClick={() => { playClickSound(); setSelectedDifficulty(level); }}
                                className={`flex-1 h-12 px-2 rounded-xl font-bold text-xs sm:text-sm border-b-4 transition-all ${selectedDifficulty === level
                                  ? 'scale-105 shadow-lg'
                                  : 'bg-indigo-800/80 border-indigo-950 text-indigo-200 hover:bg-indigo-700'
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

                    <button
                      onClick={() => startNewGame(selectedPlayerCount, selectedDifficulty, selectedGameMode)}
                      className="w-full bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 text-white font-display font-black py-4 px-8 rounded-2xl shadow-xl text-2xl border-b-4 border-emerald-900 transition-all hover:scale-[1.01] active:scale-95 active:border-b-0 active:translate-y-1"
                    >
                      PLAY NOW ▶
                    </button>
                  </div>
                )}

                {/* Quick Power Card Legend */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] sm:text-xs text-purple-100/90">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="bg-black/30 px-2.5 py-1 rounded-full border border-white/10">💥 <b>2</b> +2</span>
                    <span className="bg-black/30 px-2.5 py-1 rounded-full border border-amber-400/40 text-amber-200">🔥 <b>J♠/♣</b> +5</span>
                    <span className="bg-black/30 px-2.5 py-1 rounded-full border border-white/10">👑 <b>Q</b> Wild</span>
                    <span className="bg-black/30 px-2.5 py-1 rounded-full border border-white/10">🤴 <b>K</b> Swap</span>
                    <span className="bg-black/30 px-2.5 py-1 rounded-full border border-white/10">🚫 <b>8</b> Skip</span>
                    <span className="bg-black/30 px-2.5 py-1 rounded-full border border-white/10">👁️ <b>7</b> Peek</span>
                  </div>
                  <button
                    onClick={() => { playClickSound(); setShowCustomRules(true); }}
                    className="text-blue-200 hover:text-white font-bold underline decoration-2 underline-offset-4 shrink-0"
                  >
                    ⚙️ Custom Rules
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Profile, Daily Challenge, Themes, Shop & Voices */}
            <div className="lg:col-span-5 flex flex-col gap-4 justify-between">
              {/* Street Profile Card */}
              {stats && rankInfo && (
                <div className="bg-white/10 backdrop-blur-md p-5 rounded-[2rem] shadow-2xl border-2 border-white/20">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-2xl shadow-lg border-b-4 border-orange-700">
                        {rankInfo.emoji}
                      </div>
                      <div className="text-left">
                        <div className="font-display font-black text-lg leading-tight text-yellow-300">
                          {rankInfo.name}
                        </div>
                        <div className="text-xs text-purple-200">
                          {stats.wins < rankInfo.nextAt
                            ? `${rankInfo.nextAt - stats.wins} wins to next rank`
                            : 'Max street rank achieved!'}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => { playClickSound(); setShowLeaderboard(true); }}
                      className="bg-purple-500 hover:bg-purple-400 text-white px-3.5 py-2 rounded-xl font-bold text-xs border-b-4 border-purple-700 transition-all shrink-0"
                    >
                      📊 Full Stats
                    </button>
                  </div>

                  {/* Rank Progress Bar */}
                  <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden mb-4">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-500"
                      style={{ width: `${rankPct}%` }}
                    />
                  </div>

                  {/* Stats Row (WCAG AA+ contrast) */}
                  <div className="grid grid-cols-3 gap-2.5 mb-4 text-center">
                    <div className="bg-emerald-800 py-2.5 px-2 rounded-xl border-b-4 border-emerald-950">
                      <div className="text-[11px] uppercase font-bold text-emerald-100">Wins</div>
                      <div className="font-display text-2xl font-black text-white tabular-nums">{stats.wins}</div>
                    </div>
                    <div className="bg-rose-800 py-2.5 px-2 rounded-xl border-b-4 border-rose-950">
                      <div className="text-[11px] uppercase font-bold text-rose-100">Losses</div>
                      <div className="font-display text-2xl font-black text-white tabular-nums">{stats.losses}</div>
                    </div>
                    <div className="bg-amber-800 py-2.5 px-2 rounded-xl border-b-4 border-amber-950">
                      <div className="text-[11px] uppercase font-bold text-amber-100">🔥 Streak</div>
                      <div className="font-display text-2xl font-black text-white tabular-nums">{stats.currentWinStreak}</div>
                    </div>
                  </div>

                  {/* Labeled Customization & Shop Buttons (WCAG AA+ contrast) */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => { playClickSound(); setShowThemePicker(true); }}
                      className="bg-pink-700 hover:bg-pink-600 text-white py-2.5 px-2 rounded-xl font-bold text-xs border-b-4 border-pink-900 transition-all flex flex-col items-center gap-0.5"
                    >
                      <span className="text-lg" aria-hidden="true">🎨</span>
                      <span>Themes</span>
                    </button>
                    <button
                      onClick={() => { playClickSound(); setShowPowerUpShop(true); }}
                      className="bg-emerald-700 hover:bg-emerald-600 text-white py-2.5 px-2 rounded-xl font-bold text-xs border-b-4 border-emerald-900 transition-all flex flex-col items-center gap-0.5"
                    >
                      <span className="text-lg" aria-hidden="true">🛒</span>
                      <span>Shop</span>
                    </button>
                    <button
                      onClick={() => { playClickSound(); setShowPersonalityPicker(true); }}
                      className="bg-indigo-700 hover:bg-indigo-600 text-white py-2.5 px-2 rounded-xl font-bold text-xs border-b-4 border-indigo-900 transition-all flex flex-col items-center gap-0.5"
                    >
                      <span className="text-lg" aria-hidden="true">🎙️</span>
                      <span>Voices</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Daily Seed & Daily Challenge Card */}
              <div className="bg-white/10 backdrop-blur-md p-5 rounded-[2rem] shadow-2xl border-2 border-yellow-400/40 flex-1 flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-left">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-yellow-300">Same Deck Worldwide</div>
                    <h2 className="font-display font-black text-xl text-white">⚡ Daily Seed Challenge</h2>
                  </div>
                  <button
                    onClick={() => { playClickSound(); setShowDailyBoard(true); }}
                    className="bg-yellow-400 hover:bg-yellow-300 text-black font-display font-black text-xs px-3.5 py-2 rounded-xl border-b-4 border-yellow-600 transition-all shrink-0"
                  >
                    Play &amp; Rank ▶
                  </button>
                </div>

                {stats && (
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
                )}
              </div>
            </div>
          </div>
        </main>

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
              setInventory(loadInventory());
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
    const isLocalMP = gameState.gameMode === GameMode.LocalMultiplayer;
    const humanPlayer = gameState.players[0];
    const isHumanWinner = isLocalMP ? true : gameState.winnerId === humanPlayer.id;
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
          <div className="text-7xl sm:text-8xl mb-4 filter drop-shadow-lg animate-bounce">
            {isHumanWinner ? '🏆' : humanPlayer.hand.length <= 2 ? '🤝' : '🙌'}
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-black mb-3 drop-shadow-lg text-yellow-400">
            {isLocalMP
              ? `${winner?.name?.toUpperCase() || 'PLAYER'} WON!`
              : isHumanWinner
                ? 'YOU WON!'
                : humanPlayer.hand.length <= 2
                  ? 'SO CLOSE!'
                  : 'GOOD GAME!'}
          </h1>
          <p className="text-lg sm:text-xl font-bold mb-5 text-pink-100">
            {isHumanWinner
              ? "You're the King of the Street!"
              : humanPlayer.hand.length <= 2
                ? `${winner?.avatar} ${winner?.name} barely edged it — you were right there!`
                : `Great battle against ${winner?.avatar} ${winner?.name}! Every round makes you sharper.`}
          </p>

          {isHumanWinner && isDailySeedRun && dailyRankResult && (
            <div className="mb-5 bg-yellow-400/20 border-2 border-yellow-400 rounded-2xl px-4 py-2.5 text-yellow-200 font-black text-sm">
              🏆 Daily Seed Rank: #{dailyRankResult.rank} of {dailyRankResult.total} {dailyRankResult.improved ? '(New Best!)' : ''}
            </div>
          )}

          {/* Match Summary */}
          <div className="flex justify-center gap-2.5 mb-5 text-sm flex-wrap">
            <div className="bg-black/25 px-3.5 py-2 rounded-xl border border-white/15">
              <div className="text-purple-200 text-[11px] uppercase font-bold">Time</div>
              <div className="font-display font-black text-base tabular-nums">{formatDuration(lastMatchDurationMs)}</div>
            </div>
            <div className="bg-black/25 px-3.5 py-2 rounded-xl border border-white/15">
              <div className="text-purple-200 text-[11px] uppercase font-bold">Cards</div>
              <div className="font-display font-black text-base tabular-nums">{cardsPlayedRef.current}</div>
            </div>
            {lastCoinsEarned > 0 && (
              <div className="bg-yellow-400/20 px-3.5 py-2 rounded-xl border border-yellow-400/50">
                <div className="text-yellow-200 text-[11px] uppercase font-bold">
                  {isHumanWinner ? 'Earned' : 'GG Bonus'}
                </div>
                <div className="font-display font-black text-base text-yellow-300 tabular-nums">+{lastCoinsEarned} 🪙</div>
              </div>
            )}
            {stats && isHumanWinner && (
              <div className="bg-black/25 px-3.5 py-2 rounded-xl border border-white/15">
                <div className="text-purple-200 text-[11px] uppercase font-bold">Streak</div>
                <div className="font-display font-black text-base tabular-nums">🔥 {stats.currentWinStreak}</div>
              </div>
            )}
          </div>

          {/* Rank Progress & Next Unlock Teaser */}
          {stats && (() => {
            const rank = getRank(stats);
            const pct = rank.nextAt > 0 ? Math.min(100, Math.round((stats.wins / rank.nextAt) * 100)) : 100;
            const winsToNext = Math.max(0, rank.nextAt - stats.wins);
            const nextThemeTeaser = stats.wins < 10
              ? `🌈 Neon Nights theme unlocks in ${10 - stats.wins} more win${10 - stats.wins === 1 ? '' : 's'}!`
              : stats.wins < 25
                ? `🎰 Vintage Casino theme unlocks in ${25 - stats.wins} more win${25 - stats.wins === 1 ? '' : 's'}!`
                : null;
            return (
              <div className="bg-black/25 rounded-2xl p-3.5 mb-5 border border-white/15 text-left">
                <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                  <span className="text-yellow-300">{rank.emoji} {rank.name}</span>
                  <span className="text-purple-200">
                    {winsToNext > 0 ? `${winsToNext} win${winsToNext === 1 ? '' : 's'} to next rank` : 'Max Rank!'}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-white/15 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {nextThemeTeaser && (
                  <p className="text-[11px] text-purple-200 font-semibold mt-2 text-center">{nextThemeTeaser}</p>
                )}
              </div>
            );
          })()}

          <div className="flex flex-wrap gap-3 justify-center">
            <button onClick={() => setView('menu')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-full border-b-4 border-gray-800 transition-transform active:border-b-0 active:translate-y-1">Menu</button>
            <button onClick={handleShareResult} className="bg-purple-500 hover:bg-purple-400 text-white font-bold py-3 px-6 rounded-full border-b-4 border-purple-700 transition-transform active:border-b-0 active:translate-y-1">
              {shareCopied ? '✓ Copied!' : '📤 Share'}
            </button>
            <button onClick={() => startNewGame(gameState.players.length, gameState.difficulty, gameState.gameMode)} className="bg-yellow-400 hover:bg-yellow-300 text-black font-display font-black py-3 px-7 rounded-full border-b-4 border-yellow-600 shadow-xl transition-transform hover:scale-105 active:border-b-0 active:translate-y-1">
              {isHumanWinner ? 'Play Again ↺' : '⚡ Rematch!'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!gameState) return null;

  const isLocalMP = gameState.gameMode === GameMode.LocalMultiplayer;
  const activeViewerIdx = isLocalMP ? gameState.currentPlayerIndex : 0;
  const humanPlayer = gameState.players[activeViewerIdx];
  const topCard = gameState.discardPile[gameState.discardPile.length - 1];
  const prevDiscardCards = gameState.discardPile.slice(-3, -1);
  const isPlayerTurn = isLocalMP ? !gameState.showPassScreen : gameState.currentPlayerIndex === 0;
  const mustPickup = isPlayerTurn && gameState.pendingPickup > 0;
  const activeRules = isDailySeedRun ? undefined : gameRules;
  const themeCardBack = getThemeCardBackStyle(currentTheme);
  const anyLastCard = gameState.players.some((p) => p.hand.length === 1);
  const ownedPowerUps = !isDailySeedRun && gameState.gameMode === GameMode.VsBot
    ? powerUpCatalog.filter((p) => (inventory[p.id] || 0) > 0)
    : [];

  // 3. GAMEPLAY
  return (
    <div className={`min-h-screen bg-gradient-to-br ${currentTheme.tableBackground} text-white overflow-hidden relative font-sans select-none touch-none ${isShaking ? 'animate-shake' : ''} ${anyLastCard ? 'ring-inset ring-4 ring-red-500/60' : ''}`}
      style={isShaking ? { animation: 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both' } : {}}
    >
      {/* Center Table Spotlight */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.12) 0%, transparent 55%)' }}
      />

      {/* Arcade Impact Callout */}
      <ImpactBanner event={impact} onDone={() => setImpact(null)} />

      {/* X-Ray Vision Power-Up Overlay */}
      {xrayView && (
        <div
          className="fixed inset-0 bg-black/75 flex items-center justify-center z-[95] p-4 cursor-pointer"
          onClick={() => setXrayView(null)}
        >
          <div className="bg-indigo-950/95 border-4 border-cyan-400 rounded-3xl p-6 max-w-xl w-full text-center shadow-2xl">
            <div className="text-3xl mb-1">👁️ X-RAY VISION</div>
            <p className="text-sm font-bold text-cyan-200 mb-4">
              {xrayView.avatar} {xrayView.name}&apos;s Hand ({xrayView.cards.length} cards)
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {xrayView.cards.map((c) => (
                <PlayingCard key={c.id} card={c} theme={currentTheme} />
              ))}
            </div>
            <p className="text-xs text-purple-200 mt-4 animate-pulse">Tap anywhere to dismiss</p>
          </div>
        </div>
      )}
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

      {/* ERROR MESSAGE / TOAST - Accessible live alert */}
      {errorMsg && (
        <div role="alert" aria-live="assertive" className="fixed top-4 left-4 z-[60] max-w-xs bg-red-700 text-white px-4 py-2.5 rounded-xl shadow-lg toast-enter border-2 border-red-300 font-bold text-sm">
          {errorMsg}
        </div>
      )}

      {/* CENTER TABLE */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Game Status Banner */}
        <div aria-live="polite" className="absolute top-[19%] md:top-[25%] z-0 w-full text-center pointer-events-none">
          <span className="inline-block bg-slate-950/80 text-white px-6 py-2 rounded-full text-sm md:text-lg font-bold backdrop-blur-md border border-white/25 shadow-lg max-w-[90%] truncate">
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
              aria-label={mustPickup ? `Pick up ${gameState.pendingPickup} penalty cards` : `Draw a card from deck (${gameState.deck.length} remaining)`}
              style={themeCardBack}
              className={`w-28 h-40 sm:w-36 sm:h-52 lg:w-40 lg:h-56 rounded-2xl border-4 border-white/40 shadow-2xl flex items-center justify-center transition-all transform ${mustPickup ? 'ring-8 ring-red-400 animate-pulse scale-105' : 'hover:-translate-y-2 hover:shadow-indigo-500/50'} ${!isPlayerTurn ? 'opacity-80' : 'cursor-pointer'}`}
            >
              <div className="bg-slate-950/75 px-3.5 py-2 rounded-full backdrop-blur-sm border border-white/30">
                <span className="font-display font-black text-xl sm:text-2xl text-white drop-shadow-md">{mustPickup ? `+${gameState.pendingPickup}` : 'DRAW'}</span>
              </div>
            </button>
            {/* Deck thickness illusion */}
            <div className="absolute top-1 left-1 w-full h-full rounded-2xl bg-black/35 -z-10"></div>
            <div className="absolute top-2 left-2 w-full h-full rounded-2xl bg-black/45 -z-20"></div>

            <p className="mt-4 text-sm font-bold text-indigo-100 bg-black/35 px-3 py-1 rounded-full tabular-nums">{gameState.deck.length} Cards</p>
          </div>

          {/* Discard Pile (Stacked Physical Depth) */}
          <div ref={discardRef} className="flex flex-col items-center relative">
            {gameState.pendingPickup > 0 && <div className="absolute -top-16 bg-red-600 text-white font-display font-black text-xl px-6 py-2 rounded-full shadow-lg animate-bounce z-20 border-4 border-white rotate-6 whitespace-nowrap">+{gameState.pendingPickup} ATTACK!</div>}
            {gameState.chosenSuit && gameState.pendingPickup === 0 && (
              <div className="absolute -top-12 bg-yellow-400 text-black font-display font-black text-sm md:text-base px-4 py-1.5 rounded-full shadow-lg z-20 border-2 border-white whitespace-nowrap flex items-center gap-1.5">
                <span>👑 Wild Suit:</span>
                <span className={`text-xl leading-none ${['♥', '♦'].includes(gameState.chosenSuit) ? 'text-red-600' : 'text-gray-900'}`}>{gameState.chosenSuit}</span>
              </div>
            )}

            <div className="relative">
              {prevDiscardCards.map((prev, idx) => (
                <div
                  key={prev.id}
                  className="absolute inset-0 pointer-events-none opacity-65"
                  style={{ transform: `rotate(${idx === 0 ? -9 : -4}deg) translate(${idx === 0 ? -6 : -3}px, ${idx === 0 ? 4 : 2}px)` }}
                >
                  <PlayingCard card={prev} theme={currentTheme} size="discard" />
                </div>
              ))}
              <PlayingCard card={topCard} theme={currentTheme} size="discard" style={{ transform: 'rotate(3deg)' }} />
            </div>
            <p className="mt-4 text-sm font-bold text-indigo-100 bg-black/35 px-3 py-1 rounded-full">
              {gameState.chosenSuit ? `Suit: ${gameState.chosenSuit}` : 'Top Card'}
            </p>
          </div>
        </div>
      </div>

      {/* OPPONENTS (Bots in vs Bot, Other Human Players in Pass & Play) */}
      {gameState.players.map((p, idx) => {
        if (idx === activeViewerIdx) return null;
        const relIdx = (idx - activeViewerIdx + gameState.players.length) % gameState.players.length;
        const position = getPlayerPosition(relIdx, gameState.players.length);
        const isCurrentTurn = gameState.players[gameState.currentPlayerIndex].id === p.id;

        let containerClass = "absolute flex flex-col items-center p-2 transition-all duration-300 z-20 ";
        if (position === 'top') containerClass += "top-4 left-1/2 -translate-x-1/2";
        if (position === 'left') containerClass += "left-2 top-[40%] md:top-1/2 -translate-y-1/2 origin-left scale-90";
        if (position === 'right') containerClass += "right-2 top-[40%] md:top-1/2 -translate-y-1/2 origin-right scale-90";

        return (
          <div key={p.id} ref={el => { botRefs.current[idx] = el }} className={containerClass}>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full border-b-4 mb-2 text-sm font-bold shadow-lg transition-all ${isCurrentTurn ? 'bg-yellow-400 text-black border-yellow-600 scale-110' : 'bg-gray-900/90 border-black text-gray-200'}`}>
              <span className="text-2xl">{p.avatar}</span>
              <span>{p.name}</span>
              {p.hand.length === 1 && (
                <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-black animate-pulse">
                  ⚠️ LAST CARD!
                </span>
              )}
              {isCurrentTurn && <span className="animate-spin">⏳</span>}
            </div>

            <div className="flex -space-x-8">
              {p.hand.map((card, cIdx) => (
                cIdx < 6 && (
                  <div key={card.id} className="w-10 h-14 md:w-12 md:h-16 rounded-lg border-2 border-white/80 shadow-md relative overflow-hidden transform hover:-translate-y-2 transition-transform" style={{ zIndex: cIdx, ...themeCardBack }}></div>
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
        {/* In-Game Power-Up Belt (Solo non-Daily Seed) */}
        {ownedPowerUps.length > 0 && isPlayerTurn && (
          <div className="flex gap-1.5 items-center mb-2 z-50 flex-wrap justify-center px-2">
            {ownedPowerUps.map((pu) => (
              <button
                key={pu.id}
                onClick={() => handleUsePowerUp(pu.id)}
                title={`${pu.name}: ${pu.description}`}
                className="bg-black/45 hover:bg-purple-600/80 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full border border-yellow-400/50 shadow-md transition-all hover:scale-105 flex items-center gap-1"
              >
                <span>{pu.emoji}</span>
                <span>{pu.name}</span>
                <span className="bg-yellow-400 text-black text-[10px] font-black px-1.5 rounded-full tabular-nums">
                  {inventory[pu.id]}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Control Bar */}
        <div className="flex gap-3 items-center mb-3 z-50">
          <div className={`px-6 py-2.5 rounded-full text-base md:text-lg font-display font-black shadow-xl transition-all border-b-4 ${isPlayerTurn ? mustPickup ? 'bg-red-500 text-white border-red-700 scale-105 animate-bounce' : 'bg-yellow-400 text-black border-yellow-600' : 'bg-gray-800 text-gray-400 border-gray-950'}`}>
            {isPlayerTurn
              ? (mustPickup ? 'DEFEND OR DRAW!' : isLocalMP ? `${humanPlayer.name.toUpperCase()}'S TURN!` : 'YOUR TURN!')
              : 'WAITING...'}
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

        {/* Cards Container (Curved Fan Arc + Iconic Power Cards) */}
        <div className={`flex flex-wrap justify-center ${humanPlayer.hand.length > 9 ? '-space-x-7 md:-space-x-9' : '-space-x-4 md:-space-x-6'} px-4 w-full max-w-5xl pb-4 min-h-[145px] items-end`}>
          {humanPlayer.hand.map((card, i) => {
            const canStack = mustPickup && isValidMove(card, topCard, gameState.pendingPickup, gameState.chosenSuit, activeRules);
            const normalPlay = !mustPickup && isPlayerTurn && isValidMove(card, topCard, 0, gameState.chosenSuit, activeRules);
            const playable = canStack || normalPlay;
            const isHidden = card.id === hiddenCardId;
            const center = (humanPlayer.hand.length - 1) / 2;
            const offset = i - center;
            const arcLift = Math.max(0, 12 - Math.abs(offset) * 2.5);

            return (
              <PlayingCard
                key={card.id}
                card={card}
                theme={currentTheme}
                playable={playable}
                canStack={canStack}
                dimmed={mustPickup && !playable}
                sorting={isSorting}
                hidden={isHidden}
                onClick={(e) => handleCardClick(e, card)}
                style={{
                  marginBottom: `${(playable ? 22 : 0) + arcLift}px`,
                  zIndex: i,
                  transform: `rotate(${offset * (humanPlayer.hand.length > 9 ? 1.2 : 2)}deg)`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- FLYING CARD (Smooth Snappy Flick Animation) ---
const FlyingCardComponent: React.FC<FlyingCardState> = ({ card, start, end, faceDown, onComplete }) => {
  const [style, setStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    top: start.top,
    left: start.left,
    width: start.width,
    height: start.height,
    zIndex: 9999,
    transition: 'all 0.36s cubic-bezier(0.22, 1, 0.36, 1)',
    transform: 'scale(1.06) rotate(-6deg)',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.55)',
  });

  useEffect(() => {
    requestAnimationFrame(() => {
      setStyle(prev => ({
        ...prev,
        top: end.top,
        left: end.left,
        width: end.width,
        height: end.height,
        transform: 'scale(1) rotate(5deg)',
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
