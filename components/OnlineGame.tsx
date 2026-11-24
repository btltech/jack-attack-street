// components/OnlineGame.tsx - Live multiplayer table with iconic cards, themes, reactions, scoreboard & last-card alarm
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Suit, Rank, Difficulty } from '../core/types';
import { isValidMove, sortHand } from '../core/game';
import type { CardTheme } from '../core/themes';
import type { View } from '../core/roomEngine';
import type { OnlineReaction } from '../core/online';
import { getRoomInviteUrl } from '../core/online';
import {
  playCardSound, playDrawSound, playAttackSound, playWinSound,
  playLoseSound, playClickSound, toggleBackgroundMusic,
} from '../core/sounds';
import SuitPicker from './SuitPicker';
import SwapPicker from './SwapPicker';
import PeekCard from './PeekCard';
import PlayingCard, { getThemeCardBackStyle } from './PlayingCard';
import TableStatus from './TableStatus';
import ImpactBanner, { ImpactEvent } from './ImpactBanner';

interface OnlineGameProps {
  view: View;
  theme: CardTheme;
  error: string | null;
  onClearError: () => void;
  peek: { card: Card; seat: number } | null;
  onClearPeek: () => void;
  reactions: OnlineReaction[];
  clockOffsetMs: number;
  onPlay: (cardId: string) => void;
  onDraw: () => void;
  onChooseSuit: (suit: Suit) => void;
  onSwap: (seat: number) => void;
  onReact: (emoji: string) => void;
  onPlayAgain: (size: number, difficulty: Difficulty) => void;
  onLeave: () => void;
}

const REACTION_OPTIONS = ['😂', '😱', '🔥', '💀', '👑', 'NOOO!'];

const OnlineGame: React.FC<OnlineGameProps> = ({
  view,
  theme,
  error,
  onClearError,
  peek,
  onClearPeek,
  reactions,
  clockOffsetMs,
  onPlay,
  onDraw,
  onChooseSuit,
  onSwap,
  onReact,
  onPlayAgain,
  onLeave,
}) => {
  const [sortedView, setSortedView] = useState<boolean>(true);
  const [musicEnabled, setMusicEnabled] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [shareCopied, setShareCopied] = useState<boolean>(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [impact, setImpact] = useState<ImpactEvent | null>(null);

  const prevActionRef = useRef<string>('');
  const game = view.game;
  const mySeat = view.you;
  const isMyTurn = !!game && game.current === mySeat && view.phase === 'playing';
  const mustPickup = isMyTurn && (game?.pendingPickup ?? 0) > 0;
  const cardBackStyle = getThemeCardBackStyle(theme);

  // Synced turn countdown
  useEffect(() => {
    if (!game || view.phase !== 'playing' || !game.deadline) {
      setSecondsLeft(0);
      return;
    }
    const update = () => {
      const serverNow = Date.now() + clockOffsetMs;
      setSecondsLeft(Math.max(0, Math.ceil((game.deadline - serverNow) / 1000)));
    };
    update();
    const id = window.setInterval(update, 500);
    return () => clearInterval(id);
  }, [game?.deadline, view.phase, clockOffsetMs]);

  // Trigger arcade impact banner on hype moves
  useEffect(() => {
    if (!game || game.lastAction === prevActionRef.current) return;
    prevActionRef.current = game.lastAction;
    if (game.pendingPickup >= 5) {
      setImpact({ id: Date.now(), title: `🔥 MEGA +${game.pendingPickup} ATTACK!`, subtitle: 'Defend or draw!', tone: 'attack' });
      playAttackSound();
    } else if (game.pendingPickup >= 4) {
      setImpact({ id: Date.now(), title: `💥 +${game.pendingPickup} STACK!!`, subtitle: 'Attack stacked!', tone: 'attack' });
      playAttackSound();
    } else if (game.lastAction.includes('RED JACK')) {
      setImpact({ id: Date.now(), title: '🛡️ RED JACK CANCEL!', subtitle: 'Black Jack attack neutralized!', tone: 'shield' });
    } else if (game.lastAction.includes('SWAP') || game.lastAction.includes('swapped')) {
      setImpact({ id: Date.now(), title: '🤴 HANDS SWAPPED!', tone: 'swap' });
    }
  }, [game?.lastAction, game?.pendingPickup]);

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(onClearError, 2600);
    return () => clearTimeout(t);
  }, [error, onClearError]);

  useEffect(() => {
    if (view.phase === 'over' && game && game.winner !== null) {
      if (game.winner === mySeat) playWinSound();
      else playLoseSound();
    }
  }, [view.phase, game?.winner, mySeat]);

  const hand = useMemo(() => {
    if (!game) return [];
    return sortedView ? sortHand(game.hand) : game.hand;
  }, [game?.hand, sortedView]);

  if (!game) return null;

  const topCard = game.top;
  const activeSeat = view.seats[game.current];
  const anyLastCard = view.seats.some((s) => s.handCount === 1);

  const totalSeats = view.seats.length;
  const opponents = view.seats
    .map((seat, idx) => ({ seat, idx, rel: (idx - mySeat + totalSeats) % totalSeats }))
    .filter(item => item.idx !== mySeat);

  const getPosition = (rel: number, total: number): 'top' | 'left' | 'right' => {
    if (total === 2) return 'top';
    if (total === 3) return rel === 1 ? 'left' : 'right';
    if (rel === 1) return 'left';
    if (rel === 2) return 'top';
    return 'right';
  };

  const handleCardClick = (card: Card) => {
    if (!isMyTurn || game.pendingSuitChoice || game.pendingSwap) return;
    const valid = isValidMove(card, topCard, game.pendingPickup, game.chosenSuit);
    if (!valid) {
      if (mustPickup) {
        const isBlackJackTop = topCard.rank === Rank.Jack && (topCard.suit === Suit.Spades || topCard.suit === Suit.Clubs);
        setLocalError(isBlackJackTop ? '🛡️ Stack a Black Jack (J♠/J♣), cancel with a Red Jack (J♥/J♦), or Pick Up!' : `🛡️ Defend with a ${topCard.rank} or Pick Up!`);
      } else {
        const activeSuit = game.chosenSuit ?? topCard.suit;
        setLocalError(
          game.chosenSuit
            ? `🚫 Match the Wild suit (${activeSuit}) or play a Queen!`
            : `🚫 Match ${activeSuit} or ${topCard.rank} (or play a Queen)!`
        );
      }
      window.setTimeout(() => setLocalError(null), 2200);
      return;
    }

    playCardSound();
    onPlay(card.id);
  };

  const handleDrawClick = () => {
    if (!isMyTurn || game.pendingSuitChoice || game.pendingSwap) return;
    playDrawSound();
    onDraw();
  };

  const handleCopyRoom = async () => {
    playClickSound();
    try {
      await navigator.clipboard.writeText(getRoomInviteUrl(view.code));
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // ignore
    }
  };

  // --- GAME OVER OVERLAY ---
  if (view.phase === 'over') {
    const winnerIdx = game.winner ?? 0;
    const winner = view.seats[winnerIdx];
    const isMeWinner = winnerIdx === mySeat;
    const inviteUrl = getRoomInviteUrl(view.code);
    const shareText = isMeWinner
      ? `🃏 I just won an online match of Jack Attack Street in Room ${view.code}! 🏆 Join our table:\n${inviteUrl}`
      : `🃏 Just played a wild online match of Jack Attack Street! Jump into Room ${view.code}:\n${inviteUrl}`;

    const handleShare = async () => {
      playClickSound();
      try {
        if (navigator.share) {
          await navigator.share({ title: 'Jack Attack Street', text: shareText, url: inviteUrl });
          return;
        }
      } catch {
        // fallback to clipboard
      }
      try {
        await navigator.clipboard.writeText(shareText);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      } catch {
        // ignore
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-pink-900 flex flex-col items-center justify-center text-white font-sans p-4 text-center">
        <div className="bg-white/10 p-8 sm:p-10 lg:px-14 lg:py-12 rounded-[2.5rem] border-4 border-white/20 backdrop-blur-md shadow-2xl max-w-md lg:max-w-5xl w-full lg:grid lg:grid-cols-2 lg:gap-x-14 lg:gap-y-6 lg:items-center">
          <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
          <div className="text-7xl sm:text-8xl lg:text-9xl mb-3 animate-bounce">
            {isMeWinner ? '🏆' : (view.seats[mySeat]?.handCount ?? 9) <= 2 ? '🤝' : '🙌'}
          </div>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-black mb-2 text-yellow-400">
            {isMeWinner ? 'YOU WON!' : (view.seats[mySeat]?.handCount ?? 9) <= 2 ? 'SO CLOSE!' : 'GOOD GAME!'}
          </h1>
          <p className="text-lg sm:text-xl font-bold mb-5 text-pink-100">
            {isMeWinner
              ? "You're the King of the Street!"
              : `${winner?.avatar || '🃏'} ${winner?.name || 'Opponent'} took this one — run it back!`}
          </p>
          </div>

          {/* Session Scoreboard */}
          <div className="bg-black/25 rounded-2xl p-3.5 mb-6 lg:mb-0 lg:p-6 border border-white/15 lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <div className="text-xs font-extrabold uppercase tracking-wider text-purple-200 mb-2">
              Room {view.code} Scoreboard
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {view.seats.map((s, idx) => (
                <div
                  key={idx}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                    idx === winnerIdx ? 'bg-yellow-400/25 border-yellow-400 text-yellow-200' : 'bg-white/5 border-white/10 text-purple-100'
                  }`}
                >
                  {s.name}: <span className="font-black text-sm tabular-nums">{s.wins}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 justify-center lg:col-start-1 lg:row-start-2 lg:self-start">
            <button
              onClick={() => { playClickSound(); onLeave(); }}
              className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-full border-b-4 border-gray-800"
            >
              Leave
            </button>
            <button
              onClick={handleShare}
              className="bg-purple-500 hover:bg-purple-400 text-white font-bold py-3 px-6 rounded-full border-b-4 border-purple-700"
            >
              {shareCopied ? '✓ Copied!' : '📤 Share'}
            </button>
            {mySeat === 0 ? (
              <button
                onClick={() => { playClickSound(); onPlayAgain(view.seats.length, Difficulty.Medium); }}
                className="bg-yellow-400 hover:bg-yellow-300 text-black font-black py-3 px-7 rounded-full border-b-4 border-yellow-600 shadow-xl"
              >
                Play Again ↺
              </button>
            ) : (
              <div className="w-full mt-2 text-sm text-purple-200 font-semibold animate-pulse">
                Waiting for {view.seats[0]?.name || 'host'} to start the next round...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const toastMsg = localError || error;
  const swapPlayers = view.seats.map((s, idx) => ({
    id: String(idx),
    name: s.name,
    avatar: s.avatar || (s.isBot ? '🤖' : '😎'),
    isBot: s.isBot,
    hand: Array.from({ length: s.handCount }, (_, i) => ({ id: `${idx}-${i}`, suit: Suit.Spades, rank: Rank.Two })),
  }));

  const myReactions = reactions.filter((r) => r.seat === mySeat);

  return (
    <div className={`min-h-screen bg-gradient-to-br ${theme.tableBackground} text-white overflow-hidden relative font-sans select-none touch-none ${anyLastCard ? 'ring-inset ring-4 ring-red-500/60' : ''}`}>
      <style>{`
        @keyframes card-glow {
          0%, 100% { box-shadow: 0 0 15px 5px rgba(250, 204, 21, 0.4); }
          50% { box-shadow: 0 0 25px 10px rgba(250, 204, 21, 0.7); }
        }
        .playable-card-glow { animation: card-glow 1.5s ease-in-out infinite; }
      `}</style>

      {/* Center Table Spotlight */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.12) 0%, transparent 55%)' }}
      />

      {/* Impact Banner */}
      <ImpactBanner event={impact} onDone={() => setImpact(null)} />

      {/* Power-up Modals */}
      {isMyTurn && game.pendingSuitChoice && (
        <SuitPicker onSelectSuit={(suit) => { playClickSound(); onChooseSuit(suit); }} />
      )}
      {isMyTurn && game.pendingSwap && (
        <SwapPicker
          players={swapPlayers}
          currentPlayerId={String(mySeat)}
          onSelectPlayer={(targetId) => { playClickSound(); onSwap(Number(targetId)); }}
        />
      )}
      {peek && (
        <PeekCard
          card={peek.card}
          player={swapPlayers[peek.seat]}
          onDismiss={onClearPeek}
        />
      )}

      {/* TOP BAR */}
      <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 flex justify-between items-start z-50 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 flex-wrap">
          <div className="bg-black/35 backdrop-blur px-3.5 py-2 rounded-full text-white font-bold text-xs sm:text-sm border border-white/20 flex items-center gap-1.5">
            <span>{game.direction === 1 ? '➡️' : '⬅️'}</span>
            <span className="hidden sm:inline">{game.direction === 1 ? 'Clockwise' : 'Reverse'}</span>
          </div>
          <button
            onClick={handleCopyRoom}
            className="bg-black/40 hover:bg-black/60 backdrop-blur px-3.5 py-2 rounded-full text-yellow-300 font-display font-black text-xs sm:text-sm border border-yellow-400/40 transition-all tabular-nums"
            title="Copy room invite link"
          >
            {copiedCode ? '✓ Link Copied' : `🌐 ${view.code}`}
          </button>
          <button
            onClick={() => { toggleBackgroundMusic(); setMusicEnabled(!musicEnabled); }}
            className={`backdrop-blur px-3 py-1.5 rounded-full font-bold border transition-all text-lg ${musicEnabled ? 'bg-green-500/50 border-green-400' : 'bg-black/35 border-white/20'}`}
            aria-label="Toggle sound"
          >
            {musicEnabled ? '🔊' : '🔇'}
          </button>
        </div>
        <button
          onClick={() => { playClickSound(); onLeave(); }}
          className="pointer-events-auto bg-red-500 hover:bg-red-600 text-white font-bold px-4 py-2 rounded-full border-b-4 border-red-700 text-xs sm:text-sm"
        >
          LEAVE
        </button>
      </div>

      {/* TOAST */}
      {toastMsg && (
        <div className="fixed top-16 left-4 z-[60] max-w-xs bg-red-500/95 text-white px-4 py-2 rounded-xl shadow-lg border-2 border-red-300 font-bold text-sm backdrop-blur-sm">
          {toastMsg}
        </div>
      )}

      {/* CENTER TABLE */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative flex items-center gap-8 md:gap-20 mt-[-40px]">
          <TableStatus message={game.lastAction} pendingPickup={game.pendingPickup} chosenSuit={game.chosenSuit} />
          {/* Draw Pile */}
          <div className="flex flex-col items-center relative z-10">
            <button
              onClick={handleDrawClick}
              disabled={!isMyTurn}
              aria-label={mustPickup ? `Pick up ${game.pendingPickup} penalty cards` : `Draw a card (${game.deckCount} left)`}
              style={cardBackStyle}
              className={`w-28 h-40 sm:w-36 sm:h-52 lg:w-40 lg:h-56 rounded-2xl border-4 border-white/40 shadow-2xl flex items-center justify-center transition-all transform ${
                mustPickup ? 'ring-8 ring-red-400 animate-pulse scale-105' : 'hover:-translate-y-2'
              } ${!isMyTurn ? 'opacity-80 cursor-default' : 'cursor-pointer'}`}
            >
              <div className="bg-slate-950/75 px-3.5 py-2 rounded-full backdrop-blur-sm border border-white/30">
                <span className="font-display font-black text-xl sm:text-2xl text-white drop-shadow-md">
                  {mustPickup ? `+${game.pendingPickup}` : 'DRAW'}
                </span>
              </div>
            </button>
            <div className="absolute top-1 left-1 w-full h-full rounded-2xl bg-black/35 -z-10" />
            <div className="absolute top-2 left-2 w-full h-full rounded-2xl bg-black/45 -z-20" />
            <p className="mt-4 text-xs sm:text-sm font-bold text-indigo-100 bg-black/35 px-3 py-1 rounded-full tabular-nums">
              {game.deckCount} Cards
            </p>
          </div>

          {/* Discard Pile */}
          <div className="flex flex-col items-center relative z-10">
            <PlayingCard card={topCard} theme={theme} size="discard" style={{ transform: 'rotate(3deg)' }} />
            <p className="mt-4 text-xs sm:text-sm font-bold text-indigo-100 bg-black/35 px-3 py-1 rounded-full">
              {game.chosenSuit ? `Suit: ${game.chosenSuit}` : 'Top Card'}
            </p>
          </div>
        </div>
      </div>

      {/* OPPONENTS */}
      {opponents.map(({ seat, idx, rel }) => {
        const position = getPosition(rel, totalSeats);
        const isTurn = game.current === idx;
        const isLastCard = seat.handCount === 1;
        const seatReacts = reactions.filter((r) => r.seat === idx);

        let containerClass = 'absolute flex flex-col items-center p-2 transition-all duration-300 z-20 ';
        if (position === 'top') containerClass += 'top-4 left-1/2 -translate-x-1/2';
        if (position === 'left') containerClass += 'left-2 top-[40%] md:top-1/2 -translate-y-1/2 origin-left scale-90';
        if (position === 'right') containerClass += 'right-2 top-[40%] md:top-1/2 -translate-y-1/2 origin-right scale-90';

        return (
          <div key={idx} className={containerClass}>
            {/* Floating Reaction Bubbles */}
            {seatReacts.length > 0 && (
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 z-50 bg-white text-black font-display font-black text-base px-3 py-1 rounded-full shadow-xl border-2 border-yellow-400 animate-bounce whitespace-nowrap">
                {seatReacts[seatReacts.length - 1].emoji}
              </div>
            )}

            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border-b-4 mb-2 text-xs sm:text-sm font-bold shadow-lg transition-all ${
              isTurn ? 'bg-yellow-400 text-black border-yellow-600 scale-105' : 'bg-gray-900/90 border-black text-gray-200'
            }`}>
              <span className="text-xl">{seat.avatar || (seat.isBot ? '🤖' : '😎')}</span>
              <span>{seat.name}</span>
              {seat.wins > 0 && (
                <span className="text-[10px] bg-yellow-500/30 text-yellow-200 px-1.5 py-0.5 rounded-full font-black tabular-nums">
                  🏆{seat.wins}
                </span>
              )}
              {isLastCard && (
                <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-black animate-pulse">
                  ⚠️ LAST CARD!
                </span>
              )}
              {!seat.isBot && !seat.connected && (
                <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded-full">Away</span>
              )}
              {isTurn && <span>⏳</span>}
            </div>

            <div className="flex -space-x-8">
              {Array.from({ length: Math.min(seat.handCount, 6) }, (_, cIdx) => (
                <div
                  key={cIdx}
                  className="w-10 h-14 md:w-12 md:h-16 rounded-lg border-2 border-white/80 shadow-md"
                  style={{ zIndex: cIdx, ...cardBackStyle }}
                />
              ))}
              {seat.handCount > 6 && (
                <div className="w-10 h-14 flex items-center justify-center font-bold text-white bg-indigo-950 rounded-lg border-2 border-white z-10 shadow-lg text-xs tabular-nums">
                  +{seat.handCount - 6}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* MY HAND + QUICK REACTIONS */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-safe pt-2 z-30">
        {myReactions.length > 0 && (
          <div className="mb-1 bg-white text-black font-display font-black text-base px-3.5 py-1 rounded-full shadow-xl border-2 border-yellow-400 animate-bounce">
            {myReactions[myReactions.length - 1].emoji}
          </div>
        )}

        <div className="flex gap-2 items-center mb-2.5 z-50 flex-wrap justify-center px-2">
          <div className={`px-5 py-2 rounded-full text-sm md:text-base font-display font-black shadow-xl transition-all border-b-4 flex items-center gap-2 ${
            isMyTurn
              ? mustPickup
                ? 'bg-red-500 text-white border-red-700 scale-105 animate-bounce'
                : 'bg-yellow-400 text-black border-yellow-600'
              : 'bg-gray-900/90 text-gray-300 border-black'
          }`}>
            <span>
              {isMyTurn
                ? (mustPickup ? 'DEFEND OR DRAW!' : 'YOUR TURN!')
                : `⏳ ${activeSeat?.name || 'Opponent'}'s turn`}
            </span>
            {secondsLeft > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full tabular-nums ${isMyTurn && secondsLeft <= 8 ? 'bg-red-600 text-white' : 'bg-black/25'}`}>
                {secondsLeft}s
              </span>
            )}
          </div>

          <button
            onClick={() => { playClickSound(); setSortedView(s => !s); }}
            className="bg-blue-500 hover:bg-blue-400 text-white font-bold px-3.5 py-2 rounded-full border-b-4 border-blue-700 text-xs sm:text-sm"
          >
            {sortedView ? '✓ Sorted' : 'Sort'}
          </button>

          {/* 1-Tap Reactions */}
          <div className="flex items-center gap-1 bg-black/35 backdrop-blur-md px-2 py-1 rounded-full border border-white/15">
            {REACTION_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => { playClickSound(); onReact(emoji); }}
                className="hover:scale-125 active:scale-95 transition-transform px-1.5 py-0.5 text-sm sm:text-base font-black"
                title={`React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div className={`flex flex-wrap justify-center ${hand.length > 9 ? '-space-x-7 md:-space-x-9' : '-space-x-4 md:-space-x-6'} px-4 w-full max-w-5xl pb-4 min-h-[145px] items-end`}>
          {hand.map((card, i) => {
            const canStack = mustPickup && isValidMove(card, topCard, game.pendingPickup, game.chosenSuit);
            const normalPlay = !mustPickup && isMyTurn && isValidMove(card, topCard, 0, game.chosenSuit);
            const playable = canStack || normalPlay;
            const center = (hand.length - 1) / 2;
            const offset = i - center;
            const arcLift = Math.max(0, 12 - Math.abs(offset) * 2.5);

            return (
              <PlayingCard
                key={card.id}
                card={card}
                theme={theme}
                playable={playable}
                canStack={canStack}
                dimmed={mustPickup && !playable}
                onClick={() => handleCardClick(card)}
                style={{
                  marginBottom: `${(playable ? 22 : 0) + arcLift}px`,
                  zIndex: i,
                  transform: `rotate(${offset * (hand.length > 9 ? 1.2 : 2)}deg)`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OnlineGame;
