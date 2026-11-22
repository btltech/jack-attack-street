// components/PlayingCard.tsx - Large, WCAG-accessible street-arcade playing card with power-card styling
import React from 'react';
import { Card, Rank, Suit } from '../core/types';
import type { CardTheme } from '../core/themes';

const SUIT_NAMES: Record<Suit, string> = {
  [Suit.Hearts]: 'Hearts',
  [Suit.Diamonds]: 'Diamonds',
  [Suit.Clubs]: 'Clubs',
  [Suit.Spades]: 'Spades',
};

const RANK_NAMES: Record<Rank, string> = {
  [Rank.Two]: '2', [Rank.Three]: '3', [Rank.Four]: '4', [Rank.Five]: '5',
  [Rank.Six]: '6', [Rank.Seven]: '7', [Rank.Eight]: '8', [Rank.Nine]: '9',
  [Rank.Ten]: '10', [Rank.Jack]: 'Jack', [Rank.Queen]: 'Queen', [Rank.King]: 'King',
  [Rank.Ace]: 'Ace',
};

export const getThemeCardBackStyle = (theme?: CardTheme): React.CSSProperties => {
  if (!theme) {
    return {
      background:
        'linear-gradient(45deg, #2563eb 25%, transparent 25%, transparent 75%, #2563eb 75%, #2563eb), linear-gradient(45deg, #2563eb 25%, transparent 25%, transparent 75%, #2563eb 75%, #2563eb)',
      backgroundColor: '#1d4ed8',
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

const getPowerMeta = (card: Card): { label: string; aria: string; badgeClass: string; cardAccent: string; isBlackJack?: boolean } | null => {
  const isBJ = card.rank === Rank.Jack && (card.suit === Suit.Spades || card.suit === Suit.Clubs);
  if (isBJ) {
    return {
      label: '🔥 +5',
      aria: 'Black Jack plus 5 attack',
      badgeClass: 'bg-amber-400 text-slate-950 border border-yellow-200',
      cardAccent: 'bg-gradient-to-b from-slate-900 via-gray-950 to-black border-amber-400 text-white',
      isBlackJack: true,
    };
  }
  if (card.rank === Rank.Two) {
    return {
      label: '💥 +2',
      aria: 'plus 2 attack',
      badgeClass: 'bg-red-700 text-white',
      cardAccent: 'border-red-400',
    };
  }
  if (card.rank === Rank.Queen) {
    return {
      label: '👑 WILD',
      aria: 'Wild suit changer',
      badgeClass: 'bg-purple-700 text-white',
      cardAccent: 'border-purple-500',
    };
  }
  if (card.rank === Rank.King) {
    return {
      label: '🤴 SWAP',
      aria: 'Swap hands',
      badgeClass: 'bg-amber-400 text-slate-950',
      cardAccent: 'border-amber-500',
    };
  }
  if (card.rank === Rank.Eight) {
    return {
      label: '🚫 SKIP',
      aria: 'Skip turn',
      badgeClass: 'bg-sky-700 text-white',
      cardAccent: 'border-sky-400',
    };
  }
  if (card.rank === Rank.Ace) {
    return {
      label: '↩️ REV',
      aria: 'Reverse direction',
      badgeClass: 'bg-indigo-700 text-white',
      cardAccent: 'border-indigo-400',
    };
  }
  if (card.rank === Rank.Seven) {
    return {
      label: '👁️ PEEK',
      aria: 'Peek opponent card',
      badgeClass: 'bg-emerald-800 text-white',
      cardAccent: 'border-emerald-500',
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
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
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

  // WCAG AAA high-contrast suit colors
  const suitColor = power?.isBlackJack
    ? 'text-yellow-300'
    : isDarkThemeFace
      ? (isRed ? 'text-rose-300' : 'text-cyan-200')
      : (isRed ? 'text-red-700' : 'text-slate-950');

  const faceBg = power?.isBlackJack
    ? power.cardAccent
    : theme?.cardFaceStyle
      ? `${theme.cardFaceStyle} ${power?.cardAccent || 'border-slate-300'}`
      : `bg-white ${power?.cardAccent || 'border-slate-300'}`;

  const cardDescription = `${RANK_NAMES[card.rank]} of ${SUIT_NAMES[card.suit]}${power ? `, ${power.aria}` : ''}${playable ? ', playable' : ''}`;

  if (size === 'discard') {
    return (
      <div
        role="img"
        aria-label={`Top discard card: ${cardDescription}`}
        className={`w-28 h-40 sm:w-36 sm:h-52 lg:w-40 lg:h-56 ${faceBg} rounded-2xl shadow-2xl flex flex-col items-center justify-center border-2 border-b-[8px] relative overflow-hidden select-none`}
        style={style}
      >
        <span className={`font-display font-black text-6xl sm:text-7xl z-10 drop-shadow-sm ${suitColor}`}>
          {card.rank}
        </span>
        <span className={`absolute text-[9.5rem] opacity-10 pointer-events-none ${suitColor}`} aria-hidden="true">
          {card.suit}
        </span>

        {power && (
          <span className={`z-10 mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-black tracking-wide shadow ${power.badgeClass}`}>
            {power.label}
          </span>
        )}

        <div className="absolute top-2 left-2.5 flex flex-col items-center leading-none" aria-hidden="true">
          <span className={`font-display text-2xl sm:text-3xl font-black ${suitColor}`}>{card.rank}</span>
          <span className={`text-3xl sm:text-4xl leading-none ${suitColor}`}>{card.suit}</span>
        </div>
        <div className="absolute bottom-2 right-2.5 flex flex-col items-center leading-none transform rotate-180" aria-hidden="true">
          <span className={`font-display text-2xl sm:text-3xl font-black ${suitColor}`}>{card.rank}</span>
          <span className={`text-3xl sm:text-4xl leading-none ${suitColor}`}>{card.suit}</span>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      data-card-id={card.id}
      onClick={onClick}
      aria-label={cardDescription}
      aria-disabled={!playable}
      style={{ ...style, opacity: hidden ? 0 : undefined }}
      className={`relative w-24 h-36 sm:w-28 sm:h-40 lg:w-32 lg:h-48 rounded-2xl border-2 border-b-[6px] flex flex-col justify-between p-2.5 shadow-xl transition-all duration-200 select-none overflow-hidden text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:z-50 ${faceBg} ${
        playable
          ? 'cursor-pointer hover:scale-110 hover:-translate-y-4 hover:shadow-2xl z-40 ring-4 ring-yellow-300 ring-offset-2 ring-offset-slate-950 playable-card-glow'
          : 'cursor-default opacity-95'
      } ${dimmed ? 'grayscale opacity-50' : ''} ${canStack ? 'ring-red-400 animate-pulse' : ''} ${sorting ? 'sorting-card' : ''}`}
    >
      {/* Top-left rank & suit */}
      <div className="flex flex-col items-center leading-none self-start z-10" aria-hidden="true">
        <span className={`font-display font-black text-2xl sm:text-3xl lg:text-4xl ${suitColor}`}>{card.rank}</span>
        <span className={`text-2xl sm:text-3xl lg:text-4xl leading-none ${suitColor}`}>{card.suit}</span>
      </div>

      {/* Center watermark */}
      <div className={`absolute inset-0 flex items-center justify-center text-7xl sm:text-8xl ${isDarkCard ? 'opacity-15' : 'opacity-10'} pointer-events-none ${suitColor}`} aria-hidden="true">
        {card.suit}
      </div>

      {/* Power Card Micro-Badge */}
      {power && (
        <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none z-10" aria-hidden="true">
          <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black tracking-tight shadow-sm whitespace-nowrap ${power.badgeClass}`}>
            {power.label}
          </span>
        </div>
      )}

      {/* Bottom-right rank & suit */}
      <div className="flex flex-col items-center leading-none self-end transform rotate-180 z-10" aria-hidden="true">
        <span className={`font-display font-black text-2xl sm:text-3xl lg:text-4xl ${suitColor}`}>{card.rank}</span>
        <span className={`text-2xl sm:text-3xl lg:text-4xl leading-none ${suitColor}`}>{card.suit}</span>
      </div>
    </button>
  );
};

export default PlayingCard;
