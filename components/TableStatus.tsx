import type { Suit } from '../core/types';

interface TableStatusProps {
  message: string;
  pendingPickup: number;
  chosenSuit: Suit | null;
}

export default function TableStatus({ message, pendingPickup, chosenSuit }: TableStatusProps) {
  return (
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 w-max max-w-[calc(100vw-1rem)] flex flex-wrap justify-center items-center gap-1.5 pointer-events-none text-center">
      <span role="status" className="bg-slate-950/90 text-white px-4 py-1.5 rounded-full text-sm md:text-base font-bold border border-white/25 shadow-lg">
        {message}
      </span>
      {pendingPickup > 0 ? (
        <span className="bg-red-600 text-white font-display font-black text-sm md:text-base px-3 py-1 rounded-full border-2 border-white whitespace-nowrap">
          +{pendingPickup} ATTACK!
        </span>
      ) : chosenSuit && (
        <span className="bg-yellow-400 text-slate-950 font-display font-black text-sm md:text-base px-3 py-1 rounded-full border-2 border-white whitespace-nowrap">
          Wild Suit: <span className={chosenSuit === '♥' || chosenSuit === '♦' ? 'text-red-700' : ''}>{chosenSuit}</span>
        </span>
      )}
    </div>
  );
}
