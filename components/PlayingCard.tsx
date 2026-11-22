// components/PlayingCard.tsx - Iconic street-arcade card component with power-card styling & theme support
import React from 'react';
import { Card, Rank, Suit } from '../core/types';
import type { CardTheme } from '../core/themes';

export const getThemeCardBackStyle = (theme?: CardTheme): React.CSSProperties => {
  if (!theme) {
    return {
      background:
        'linear-gradient(45deg, #3b82f6 25%, transparent 25%, transparent 75%, #3b82f6 75%, #3b82f6), linear-gradient(45deg, #3b82f6 25%, transparent 25%, transparent 75%, #3b82f6 75%, #3b82f6)',
      backgroundColor: '#2563eb',
      backgroundSize: '20px 20px',
      backgroundPosition: '0 0, 10px 10px',
    };
  }
  return {
    background: theme.cardBackStyle,
    backgroundColor: theme.cardBackColor,
    backgroundSize: theme.id === 'classic' || theme.id === 'dark' ? '20px 20px' : undefined,
  };
};

const getPowerMeta = (card: Card): { label: string; badgeClass: string; cardAccent: string; isBlackJack?: boolean } | null => {
  const isBJ = card.rank === Rank.Jack && (card.suit === Suit.Spades || card.suit === Suit.Clubs);
  if (isBJ) {
    return {
      label: '🔥 +5',
      badgeClass: 'bg-gradient-to-r from-amber-400 to-orange-500 text-black border border-yellow-200',
      cardAccent: 'bg-gradient-to-b from-slate-900 via-gray-900 to-black border-amber-400 text-white',
      isBlackJack: true,
    };
  }
  if (card.rank === Rank.Two) {
    return {
      label: '💥 +2',
      badgeClass: 'bg-red-500 text-white',
      cardAccent: 'border-red-300',
    };
  }
  if (card.rank === Rank.Queen) {
    return {
      label: '👑 WILD',
      badgeClass: 'bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white',
      cardAccent: 'border-purple-400',
    };
  }
  if (card.rank === Rank.King) {
    return {
      label: '🤴 SWAP',
      badgeClass: 'bg-amber-500 text-black',
      cardAccent: 'border-amber-400',
    };
  }
  if (card.rank === Rank.Eight) {
    return {
      label: '🚫 SKIP',
      badgeClass: 'bg-sky-500 text-white',
      cardAccent: 'border-sky-300',
    };
  }
  if (card.rank === Rank.Ace) {
    return {
      label: '↩️ REV',
      badgeClass: 'bg-indigo-500 text-white',
      cardAccent: 'border-indigo-300',
    };
  }
  if (card.rank === Rank.Seven) {
    return {
      label: '👁️ PEEK',
      badgeClass: 'bg-emerald-500 text-white',
      cardAccent: 'border-emerald-300',
    };
  }
  return null;
};

interface PlayingCardProps {
  card: Card;
  theme?: CardTheme;
  size?: 'hand' | 'discard';
  playable?: boolean;
  canStack?: boolean;
  dimmed?: boolean;
  sorting?: boolean;
  hidden?: boolean;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  theme,
  size = 'hand',
  playable = false,
  canStack = false,
  dimmed = false,
  sorting = false,
  hidden = false,
  style,
  onClick,
}) => {
  const isRed = card.suit === Suit.Hearts || card.suit === Suit.Diamonds;
  const power = getPowerMeta(card);
  const isDarkThemeFace = Boolean(theme && (theme.id === 'dark' || theme.id === 'neon'));
  const isDarkCard = Boolean(power?.isBlackJack || isDarkThemeFace);

  const suitColor = power?.isBlackJack
    ? 'text-amber-300'
    : isDarkThemeFace
      ? (isRed ? 'text-rose-400' : 'text-cyan-200')
      : (isRed ? 'text-red-600' : 'text-slate-900');

  const faceBg = power?.isBlackJack
    ? power.cardAccent
    : theme?.cardFaceStyle
      ? `${theme.cardFaceStyle} ${power?.cardAccent || 'border-gray-200'}`
      : `bg-white ${power?.cardAccent || 'border-gray-200'}`;

  if (size === 'discard') {
    return (
      <div
        className={`w-24 h-36 md:w-32 md:h-48 ${faceBg} rounded-2xl shadow-2xl flex flex-col items-center justify-center border-2 border-b-[7px] relative overflow-hidden select-none`}
        style={style}
      >
        <span className={`font-display font-black text-5xl md:text-6xl z-10 drop-shadow-sm ${suitColor}`}>
          {card.rank}
        </span>
        <span className={`absolute text-[8.5rem] opacity-10 pointer-events-none ${suitColor}`}>
          {card.suit}
        </span>

        {power && (
          <span className={`z-10 mt-1 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-black tracking-wide shadow ${power.badgeClass}`}>
            {power.label}
          </span>
        )}

        <div className="absolute top-1.5 left-2 flex flex-col items-center leading-none">
          <span className={`font-display text-xl md:text-2xl font-black ${suitColor}`}>{card.rank}</span>
          <span className={`text-2xl md:text-3xl leading-none ${suitColor}`}>{card.suit}</span>
        </div>
        <div className="absolute bottom-1.5 right-2 flex flex-col items-center leading-none transform rotate-180">
          <span className={`font-display text-xl md:text-2xl font-black ${suitColor}`}>{card.rank}</span>
          <span className={`text-2xl md:text-3xl leading-none ${suitColor}`}>{card.suit}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      data-card-id={card.id}
      onClick={onClick}
      style={{ ...style, opacity: hidden ? 0 : undefined }}
      className={`relative w-20 h-32 md:w-24 md:h-36 rounded-2xl border-2 border-b-[5px] flex flex-col justify-between p-2 shadow-xl transition-all duration-200 select-none overflow-hidden ${faceBg} ${
        playable
          ? 'cursor-pointer hover:scale-110 hover:-translate-y-4 hover:shadow-2xl z-40 ring-4 ring-yellow-400 ring-offset-2 ring-offset-black/40 playable-card-glow'
          : 'cursor-default opacity-95'
      } ${dimmed ? 'grayscale opacity-55' : ''} ${canStack ? 'ring-red-500 animate-pulse' : ''} ${sorting ? 'sorting-card' : ''}`}
    >
      {/* Top-left rank & suit */}
      <div className="flex flex-col items-center leading-none self-start z-10">
        <span className={`font-display font-black text-xl md:text-2xl ${suitColor}`}>{card.rank}</span>
        <span className={`text-2xl md:text-3xl leading-none ${suitColor}`}>{card.suit}</span>
      </div>

      {/* Center watermark */}
      <div className={`absolute inset-0 flex items-center justify-center text-6xl md:text-7xl ${isDarkCard ? 'opacity-15' : 'opacity-10'} pointer-events-none ${suitColor}`}>
        {card.suit}
      </div>

      {/* Power Card Micro-Badge */}
      {power && (
        <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none z-10">
          <span className={`px-1.5 py-0.5 rounded-full text-[9px] md:text-[10px] font-black tracking-tight shadow-sm whitespace-nowrap ${power.badgeClass}`}>
            {power.label}
          </span>
        </div>
      )}

      {/* Bottom-right rank & suit */}
      <div className="flex flex-col items-center leading-none self-end transform rotate-180 z-10">
        <span className={`font-display font-black text-xl md:text-2xl ${suitColor}`}>{card.rank}</span>
        <span className={`text-2xl md:text-3xl leading-none ${suitColor}`}>{card.suit}</span>
      </div>
    </div>
  );
};

export default PlayingCard;
