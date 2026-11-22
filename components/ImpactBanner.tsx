// components/ImpactBanner.tsx - Brief arcade impact callout for hype plays (+5, swaps, last card, blocks)
import React, { useEffect } from 'react';

export interface ImpactEvent {
  id: number;
  title: string;
  subtitle?: string;
  tone: 'attack' | 'swap' | 'danger' | 'shield';
}

interface ImpactBannerProps {
  event: ImpactEvent | null;
  onDone: () => void;
}

const TONE_STYLES: Record<ImpactEvent['tone'], string> = {
  attack: 'from-red-500 via-orange-500 to-yellow-400 border-yellow-200 text-white',
  swap: 'from-amber-400 via-yellow-300 to-orange-400 border-white text-black',
  danger: 'from-rose-600 via-red-600 to-pink-600 border-red-200 text-white',
  shield: 'from-emerald-400 via-teal-400 to-cyan-400 border-white text-black',
};

const ImpactBanner: React.FC<ImpactBannerProps> = ({ event, onDone }) => {
  useEffect(() => {
    if (!event) return;
    const t = window.setTimeout(onDone, 1050);
    return () => clearTimeout(t);
  }, [event, onDone]);

  if (!event) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[85] px-4">
      <div
        key={event.id}
        className={`bg-gradient-to-r ${TONE_STYLES[event.tone]} px-7 py-3.5 rounded-3xl border-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)] text-center transform -rotate-2 animate-bounce`}
      >
        <div className="font-display font-black text-2xl sm:text-4xl tracking-tight drop-shadow-sm">
          {event.title}
        </div>
        {event.subtitle && (
          <div className="text-xs sm:text-sm font-extrabold uppercase tracking-wider opacity-90 mt-0.5">
            {event.subtitle}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImpactBanner;
