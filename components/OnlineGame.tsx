// components/OnlineGame.tsx - Live multiplayer table view powered by Cloudflare Durable Objects
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Suit, Rank, Difficulty } from '../core/types';
import { isValidMove, sortHand } from '../core/game';
import type { View } from '../core/roomEngine';
import { getRoomInviteUrl } from '../core/online';
import {
  playCardSound, playDrawSound, playAttackSound, playWinSound,
  playLoseSound, playClickSound, toggleBackgroundMusic,
} from '../core/sounds';
import SuitPicker from './SuitPicker';
import SwapPicker from './SwapPicker';
import PeekCard from './PeekCard';

interface OnlineGameProps {
  view: View;
  error: string | null;
  onClearError: () => void;
  peek: { card: Card; seat: number } | null;
  onClearPeek: () => void;
  clockOffsetMs: number;
  onPlay: (cardId: string) => void;
  onDraw: () => void;
  onChooseSuit: (suit: Suit) => void;
  onSwap: (seat: number) => void;
  onPlayAgain: (size: number, difficulty: Difficulty) => void;
  onLeave: () => void;
}

const cardBackPattern = {
  background: `
    linear-gradient(45deg, #3b82f6 25%, transparent 25%, transparent 75%, #3b82f6 75%, #3b82f6),
    linear-gradient(45deg, #3b82f6 25%, transparent 25%, transparent 75%, #3b82f6 75%, #3b82f6)
  `,
  backgroundColor: '#2563eb',
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0, 10px 10px',
};

const OnlineGame: React.FC<OnlineGameProps> = ({
  view,
  error,
  onClearError,
  peek,
  onClearPeek,
  clockOffsetMs,
  onPlay,
  onDraw,
  onChooseSuit,
  onSwap,
  onPlayAgain,
  onLeave,
}) => {
  const [sortedView, setSortedView] = useState<boolean>(true);
  const [musicEnabled, setMusicEnabled] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [shareCopied, setShareCopied] = useState<boolean>(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  const game = view.game;
  const mySeat = view.you;
  const isMyTurn = !!game && game.current === mySeat && view.phase === 'playing';
  const mustPickup = isMyTurn && (game?.pendingPickup ?? 0) > 0;

  // Countdown timer synced with server clock
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

  // Auto-clear server error toast
  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(onClearError, 2600);
    return () => clearTimeout(t);
  }, [error, onClearError]);

  // Win / lose audio cue
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

  // Relative seat ordering so YOU are always at bottom
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
        setLocalError(isBlackJackTop ? '🛡️ Defend with a Black Jack (J♠/J♣) or Pick Up!' : `🛡️ Defend with a ${topCard.rank} or Pick Up!`);
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

    const isAttack = card.rank === '2' || (card.rank === 'J' && (card.suit === '♠' || card.suit === '♣'));
    playCardSound();
    if (isAttack) playAttackSound();
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
        <div className="bg-white/10 p-8 sm:p-10 rounded-[2.5rem] border-4 border-white/20 backdrop-blur-md shadow-2xl max-w-md w-full">
          <div className="text-7xl sm:text-8xl mb-4 animate-bounce">{isMeWinner ? '🏆' : '😭'}</div>
          <h1 className="text-5xl sm:text-6xl font-black mb-3 text-yellow-400">
            {isMeWinner ? 'YOU WON!' : 'GAME OVER'}
          </h1>
          <p className="text-xl font-bold mb-6 text-pink-100">
            {isMeWinner ? "You're the King of the Street!" : `${winner?.avatar || '🃏'} ${winner?.name || 'Opponent'} won this round!`}
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-indigo-700 to-purple-800 text-white overflow-hidden relative font-sans select-none touch-none">
      <style>{`
        @keyframes card-glow {
          0%, 100% { box-shadow: 0 0 15px 5px rgba(250, 204, 21, 0.4); }
          50% { box-shadow: 0 0 25px 10px rgba(250, 204, 21, 0.7); }
        }
        .playable-card-glow {
          animation: card-glow 1.5s ease-in-out infinite;
        }
      `}</style>

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

      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 2px, transparent 2px)', backgroundSize: '30px 30px' }} />

      {/* TOP BAR */}
      <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 flex justify-between items-start z-50 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 flex-wrap">
          <div className="bg-black/30 backdrop-blur px-3.5 py-2 rounded-full text-white font-bold text-xs sm:text-sm border border-white/20 flex items-center gap-1.5">
            <span>{game.direction === 1 ? '➡️' : '⬅️'}</span>
            <span className="hidden sm:inline">{game.direction === 1 ? 'Clockwise' : 'Reverse'}</span>
          </div>
          <button
            onClick={handleCopyRoom}
            className="bg-black/35 hover:bg-black/55 backdrop-blur px-3.5 py-2 rounded-full text-yellow-300 font-black text-xs sm:text-sm border border-yellow-400/40 transition-all"
            title="Copy room invite link"
          >
            {copiedCode ? '✓ Link Copied' : `🌐 Room ${view.code}`}
          </button>
          <button
            onClick={() => { toggleBackgroundMusic(); setMusicEnabled(!musicEnabled); }}
            className={`backdrop-blur px-3 py-1.5 rounded-full font-bold border transition-all text-lg ${musicEnabled ? 'bg-green-500/50 border-green-400' : 'bg-black/30 border-white/20'}`}
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
        <div className="absolute top-[20%] md:top-[27%] z-0 w-full text-center pointer-events-none px-4">
          <span className="inline-block bg-indigo-900/65 text-indigo-100 px-5 py-1.5 rounded-full text-sm md:text-base font-bold backdrop-blur-md border border-indigo-400/50 shadow-lg max-w-[92%] truncate">
            {game.lastAction}
          </span>
        </div>

        <div className="flex items-center gap-8 md:gap-20 z-10 mt-[-40px]">
          {/* Draw Pile */}
          <div className="flex flex-col items-center relative">
            <button
              onClick={handleDrawClick}
              disabled={!isMyTurn}
              style={{ ...cardBackPattern }}
              className={`w-24 h-36 md:w-32 md:h-48 rounded-2xl border-4 border-white/30 shadow-2xl flex items-center justify-center transition-all transform ${
                mustPickup ? 'ring-8 ring-red-500 animate-pulse scale-105' : 'hover:-translate-y-2'
              } ${!isMyTurn ? 'opacity-80 cursor-default' : 'cursor-pointer'}`}
            >
              <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
                <span className="font-black text-2xl text-white drop-shadow-md">
                  {mustPickup ? `+${game.pendingPickup}` : 'DRAW'}
                </span>
              </div>
            </button>
            <div className="absolute top-1 left-1 w-full h-full rounded-2xl bg-blue-800 -z-10" />
            <div className="absolute top-2 left-2 w-full h-full rounded-2xl bg-blue-900 -z-20" />
            <p className="mt-4 text-sm font-bold text-indigo-200 bg-black/30 px-3 py-1 rounded-full">
              {game.deckCount} Cards
            </p>
          </div>

          {/* Discard Pile */}
          <div className="flex flex-col items-center relative">
            {game.pendingPickup > 0 && (
              <div className="absolute -top-16 bg-red-600 text-white font-black text-lg md:text-xl px-5 py-2 rounded-full shadow-lg animate-bounce z-20 border-4 border-white rotate-6 whitespace-nowrap">
                +{game.pendingPickup} ATTACK!
              </div>
            )}
            {game.chosenSuit && game.pendingPickup === 0 && (
              <div className="absolute -top-12 bg-yellow-400 text-black font-black text-sm md:text-base px-4 py-1.5 rounded-full shadow-lg z-20 border-2 border-white whitespace-nowrap flex items-center gap-1.5">
                <span>👑 Wild Suit:</span>
                <span className={`text-xl leading-none ${['♥', '♦'].includes(game.chosenSuit) ? 'text-red-600' : 'text-gray-900'}`}>{game.chosenSuit}</span>
              </div>
            )}

            <div className="w-24 h-36 md:w-32 md:h-48 bg-white text-black rounded-2xl shadow-2xl flex flex-col items-center justify-center border-b-8 border-r-8 border-gray-300 relative overflow-hidden transform rotate-3">
              <span className="font-black text-6xl md:text-7xl z-10 drop-shadow-sm">{topCard.rank}</span>
              <span className={`absolute text-[9rem] opacity-10 ${['♥', '♦'].includes(topCard.suit) ? 'text-red-600' : 'text-gray-900'}`}>{topCard.suit}</span>

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
              {game.chosenSuit ? `Suit: ${game.chosenSuit}` : 'Top Card'}
            </p>
          </div>
        </div>
      </div>

      {/* OPPONENTS */}
      {opponents.map(({ seat, idx, rel }) => {
        const position = getPosition(rel, totalSeats);
        const isTurn = game.current === idx;

        let containerClass = 'absolute flex flex-col items-center p-2 transition-all duration-300 z-20 ';
        if (position === 'top') containerClass += 'top-4 left-1/2 -translate-x-1/2';
        if (position === 'left') containerClass += 'left-2 top-[40%] md:top-1/2 -translate-y-1/2 origin-left scale-90';
        if (position === 'right') containerClass += 'right-2 top-[40%] md:top-1/2 -translate-y-1/2 origin-right scale-90';

        return (
          <div key={idx} className={containerClass}>
            <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border-b-4 mb-2 text-xs sm:text-sm font-bold shadow-lg transition-all ${
              isTurn ? 'bg-yellow-400 text-black border-yellow-600 scale-105' : 'bg-gray-800/90 border-gray-950 text-gray-200'
            }`}>
              <span className="text-xl">{seat.avatar || (seat.isBot ? '🤖' : '😎')}</span>
              <span>{seat.name}</span>
              {!seat.isBot && !seat.connected && (
                <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded-full">Away</span>
              )}
              {isTurn && <span>⏳</span>}
            </div>

            <div className="flex -space-x-8">
              {Array.from({ length: Math.min(seat.handCount, 6) }, (_, cIdx) => (
                <div
                  key={cIdx}
                  className="w-10 h-14 md:w-12 md:h-16 rounded-lg border-2 border-white shadow-md"
                  style={{ zIndex: cIdx, ...cardBackPattern }}
                />
              ))}
              {seat.handCount > 6 && (
                <div className="w-10 h-14 flex items-center justify-center font-bold text-white bg-indigo-900 rounded-lg border-2 border-white z-10 shadow-lg text-xs">
                  +{seat.handCount - 6}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* MY HAND */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-safe pt-2 z-30">
        <div className="flex gap-2.5 items-center mb-3 z-50 flex-wrap justify-center">
          <div className={`px-5 py-2 rounded-full text-sm md:text-base font-black shadow-xl transition-all border-b-4 flex items-center gap-2 ${
            isMyTurn
              ? mustPickup
                ? 'bg-red-500 text-white border-red-700 scale-105 animate-bounce'
                : 'bg-yellow-400 text-black border-yellow-600'
              : 'bg-gray-800/90 text-gray-300 border-gray-950'
          }`}>
            <span>
              {isMyTurn
                ? (mustPickup ? 'DEFEND OR DRAW!' : 'YOUR TURN!')
                : `⏳ ${activeSeat?.name || 'Opponent'}'s turn`}
            </span>
            {secondsLeft > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${isMyTurn && secondsLeft <= 8 ? 'bg-red-600 text-white' : 'bg-black/20'}`}>
                {secondsLeft}s
              </span>
            )}
          </div>
          <button
            onClick={() => { playClickSound(); setSortedView(s => !s); }}
            className="bg-blue-500 hover:bg-blue-400 text-white font-bold px-3.5 py-2 rounded-full border-b-4 border-blue-700 text-xs sm:text-sm"
          >
            {sortedView ? '✓ Sorted' : 'Sort Cards'}
          </button>
        </div>

        <div className={`flex flex-wrap justify-center ${hand.length > 9 ? '-space-x-7 md:-space-x-9' : '-space-x-4 md:-space-x-6'} px-4 w-full max-w-5xl pb-4 min-h-[145px] items-end`}>
          {hand.map((card, i) => {
            const canStack = mustPickup && isValidMove(card, topCard, game.pendingPickup, game.chosenSuit);
            const normalPlay = !mustPickup && isMyTurn && isValidMove(card, topCard, 0, game.chosenSuit);
            const playable = canStack || normalPlay;
            const isRed = ['♥', '♦'].includes(card.suit);
            const suitColor = isRed ? 'text-red-600' : 'text-gray-900';

            return (
              <div
                key={card.id}
                onClick={() => handleCardClick(card)}
                style={{
                  marginBottom: playable ? '22px' : '0px',
                  zIndex: i,
                  transform: `rotate(${(i - hand.length / 2) * (hand.length > 9 ? 1.2 : 2)}deg)`,
                }}
                className={`relative w-20 h-32 md:w-24 md:h-36 rounded-2xl border-b-4 border-gray-200 flex flex-col justify-between p-2 shadow-xl transition-all duration-200 select-none bg-white ${
                  playable
                    ? 'cursor-pointer hover:scale-110 hover:-translate-y-4 hover:shadow-2xl z-40 ring-4 ring-yellow-400 ring-offset-2 ring-offset-purple-800 playable-card-glow'
                    : 'cursor-default opacity-90'
                } ${mustPickup && !playable ? 'grayscale opacity-60' : ''} ${canStack ? 'ring-red-500 animate-pulse' : ''}`}
              >
                <div className="flex flex-col items-center leading-none self-start">
                  <span className={`font-black text-2xl md:text-3xl ${suitColor}`}>{card.rank}</span>
                  <span className={`text-3xl md:text-4xl font-black ${suitColor}`}>{card.suit}</span>
                </div>
                <div className={`absolute inset-0 flex items-center justify-center text-7xl opacity-10 pointer-events-none ${suitColor}`}>
                  {card.suit}
                </div>
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

export default OnlineGame;
