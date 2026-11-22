// components/Tutorial.tsx - Pictorial Visual User Guide with real card diagrams
import React, { useState } from 'react';
import { Rank, Suit } from '../core/types';
import PlayingCard from './PlayingCard';

interface TutorialProps {
  onComplete: () => void;
  onSkip: () => void;
}

const MiniCard: React.FC<{ rank: Rank; suit: Suit; playable?: boolean; label?: string }> = ({
  rank,
  suit,
  playable = false,
  label,
}) => (
  <div className="flex flex-col items-center gap-1">
    <div className="scale-[0.72] sm:scale-[0.8] origin-center -my-4 -mx-2 pointer-events-none">
      <PlayingCard card={{ id: `${suit}-${rank}`, rank, suit }} playable={playable} />
    </div>
    {label && (
      <span className="text-[11px] font-extrabold text-yellow-200 bg-black/40 px-2 py-0.5 rounded-full">
        {label}
      </span>
    )}
  </div>
);

interface GuideSlide {
  title: string;
  content: string;
  visual: React.ReactNode;
}

const slides: GuideSlide[] = [
  {
    title: 'Welcome to Jack Attack Street!',
    content: 'Be the first player to empty your hand to WIN. Match the top card by Suit or Number — and use Power Cards to flip the table!',
    visual: (
      <div className="flex items-center justify-center gap-1 py-2">
        <div className="-rotate-12"><MiniCard rank={Rank.Two} suit={Suit.Hearts} /></div>
        <div className="-translate-y-2 z-10"><MiniCard rank={Rank.Jack} suit={Suit.Spades} playable /></div>
        <div className="rotate-12"><MiniCard rank={Rank.Queen} suit={Suit.Diamonds} /></div>
      </div>
    ),
  },
  {
    title: 'Match Suit or Number',
    content: 'Look at the Top Card in the center. Play any card with the SAME SUIT (♥) or the SAME NUMBER (7). Playable cards glow gold!',
    visual: (
      <div className="flex items-center justify-center gap-3 flex-wrap py-2">
        <MiniCard rank={Rank.Seven} suit={Suit.Hearts} label="Top Card" />
        <span className="text-2xl font-black text-yellow-300">→</span>
        <MiniCard rank={Rank.Nine} suit={Suit.Hearts} playable label="Same Suit ♥" />
        <span className="text-sm font-black text-purple-200">OR</span>
        <MiniCard rank={Rank.Seven} suit={Suit.Clubs} playable label="Same Rank 7" />
      </div>
    ),
  },
  {
    title: '💥 2s = Pick Up +2 (Stackable!)',
    content: 'Drop a 2 to make the next player draw 2 cards. They can defend by stacking another 2 on top to pass +4, +6, or +8!',
    visual: (
      <div className="flex items-center justify-center gap-3 py-2">
        <MiniCard rank={Rank.Two} suit={Suit.Hearts} label="+2" />
        <span className="text-2xl font-black text-yellow-300">+</span>
        <MiniCard rank={Rank.Two} suit={Suit.Spades} playable label="Stack!" />
        <span className="text-2xl font-black text-yellow-300">=</span>
        <div className="bg-red-600 text-white font-display font-black text-xl px-4 py-2 rounded-2xl border-2 border-white shadow-lg">
          +4!
        </div>
      </div>
    ),
  },
  {
    title: '🔥 Black Jack (+5) vs 🛡️ Red Jack',
    content: 'Black Jacks (J♠ / J♣) hit for +5! Counter with the other Black Jack for +10 — OR drop a Red Jack (J♥ / J♦) to CANCEL the attack back to 0!',
    visual: (
      <div className="flex items-center justify-center gap-2.5 flex-wrap py-2">
        <MiniCard rank={Rank.Jack} suit={Suit.Spades} label="🔥 +5 Attack" />
        <span className="text-xl font-black text-yellow-300">vs</span>
        <MiniCard rank={Rank.Jack} suit={Suit.Clubs} playable label="Stack +10!" />
        <span className="text-xs font-black text-purple-200">OR</span>
        <MiniCard rank={Rank.Jack} suit={Suit.Hearts} playable label="🛡️ Cancel = 0" />
      </div>
    ),
  },
  {
    title: '👑 Queen = Wild Suit Changer',
    content: 'Play a Queen on ANY card (when not under attack) and pick the next suit! The active Wild Suit badge stays on the discard pile.',
    visual: (
      <div className="flex items-center justify-center gap-4 py-2">
        <MiniCard rank={Rank.Queen} suit={Suit.Diamonds} playable label="Play Anywhere" />
        <span className="text-2xl font-black text-yellow-300">→</span>
        <div className="grid grid-cols-2 gap-2 bg-black/30 p-3 rounded-2xl border border-white/20 text-2xl">
          <span className="bg-white text-red-700 w-10 h-10 rounded-xl flex items-center justify-center font-black">♥</span>
          <span className="bg-white text-red-700 w-10 h-10 rounded-xl flex items-center justify-center font-black">♦</span>
          <span className="bg-white text-slate-950 w-10 h-10 rounded-xl flex items-center justify-center font-black">♣</span>
          <span className="bg-white text-slate-950 w-10 h-10 rounded-xl flex items-center justify-center font-black">♠</span>
        </div>
      </div>
    ),
  },
  {
    title: '🤴 King (Swap) & 👁️ 7 (Peek)',
    content: 'A King swaps your entire hand with an opponent (instant comeback!). A 7 lets you secretly peek at one of an opponent’s cards.',
    visual: (
      <div className="flex items-center justify-center gap-5 py-2">
        <MiniCard rank={Rank.King} suit={Suit.Spades} playable label="⇄ Swap Hands" />
        <MiniCard rank={Rank.Seven} suit={Suit.Diamonds} playable label="👁️ Secret Peek" />
      </div>
    ),
  },
  {
    title: '🚫 8 (Skip) & ↩️ Ace (Reverse)',
    content: 'Play an 8 to skip the next player, or an Ace to reverse direction. In a 2-player game, both let you go again immediately!',
    visual: (
      <div className="flex items-center justify-center gap-5 py-2">
        <MiniCard rank={Rank.Eight} suit={Suit.Clubs} playable label="🚫 Skip Turn" />
        <MiniCard rank={Rank.Ace} suit={Suit.Hearts} playable label="↩️ Reverse" />
      </div>
    ),
  },
  {
    title: '4 Ways to Play — Ready?',
    content: 'Earn coins every match (even a +5 GG bonus on close losses!), unlock themes & power-ups, or invite friends with a 1-tap room link!',
    visual: (
      <div className="grid grid-cols-2 gap-2.5 max-w-sm mx-auto py-2 text-left text-xs font-bold">
        <div className="bg-blue-500/25 border border-blue-400/50 rounded-xl p-3">🤖 <b>vs Bot</b><br /><span className="text-purple-200 font-normal">Easy, Med &amp; Hard</span></div>
        <div className="bg-emerald-500/25 border border-emerald-400/50 rounded-xl p-3">🌐 <b>Online Rooms</b><br /><span className="text-purple-200 font-normal">Shareable link + bots</span></div>
        <div className="bg-amber-500/25 border border-amber-400/50 rounded-xl p-3">🏆 <b>Daily Seed</b><br /><span className="text-purple-200 font-normal">Same deck, global rank</span></div>
        <div className="bg-pink-500/25 border border-pink-400/50 rounded-xl p-3">👫 <b>Pass &amp; Play</b><br /><span className="text-purple-200 font-normal">Same-device party mode</span></div>
      </div>
    ),
  },
];

const Tutorial: React.FC<TutorialProps> = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const step = slides[currentStep];
  const isLastStep = currentStep === slides.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[100] p-4">
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white p-5 sm:p-7 rounded-[2rem] max-w-xl w-full relative shadow-2xl border-4 border-yellow-400 max-h-[92vh] overflow-y-auto">
        <button
          onClick={onSkip}
          className="absolute top-4 right-4 text-purple-200 hover:text-white text-xs sm:text-sm font-bold bg-white/10 px-3 py-1 rounded-full"
        >
          Skip ✕
        </button>

        {/* Clickable progress dots */}
        <div className="flex justify-center gap-2 mb-4" role="tablist" aria-label="Guide steps">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentStep(idx)}
              aria-label={`Go to step ${idx + 1}`}
              className={`h-2.5 rounded-full transition-all ${
                idx === currentStep
                  ? 'w-7 bg-yellow-400'
                  : idx < currentStep
                    ? 'w-2.5 bg-emerald-400'
                    : 'w-2.5 bg-white/30 hover:bg-white/50'
              }`}
            />
          ))}
        </div>

        {/* Pictorial Card Visual */}
        <div className="bg-black/30 rounded-2xl border border-white/15 px-3 py-4 mb-5 min-h-[168px] flex items-center justify-center">
          {step.visual}
        </div>

        {/* Title & Explanation */}
        <div className="text-center mb-6">
          <h3 className="font-display text-2xl sm:text-3xl font-black mb-2 text-yellow-300">
            {step.title}
          </h3>
          <p className="text-sm sm:text-base text-purple-100 leading-relaxed max-w-md mx-auto">
            {step.content}
          </p>
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {!isFirstStep && (
            <button
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="flex-1 bg-indigo-700 hover:bg-indigo-600 text-white font-bold py-3 rounded-xl border-b-4 border-indigo-900 transition-all"
            >
              ← Back
            </button>
          )}
          <button
            onClick={() => (isLastStep ? onComplete() : setCurrentStep(prev => prev + 1))}
            className={`flex-1 font-display font-black py-3 rounded-xl border-b-4 transition-all text-base sm:text-lg ${
              isLastStep
                ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-800 text-white'
                : 'bg-yellow-400 hover:bg-yellow-300 border-yellow-600 text-slate-950'
            }`}
          >
            {isLastStep ? "Let's Play! 🎮" : 'Next →'}
          </button>
        </div>

        <div className="text-center mt-3 text-purple-300 text-xs font-bold tabular-nums">
          Visual Guide • Step {currentStep + 1} of {slides.length}
        </div>
      </div>
    </div>
  );
};

export default Tutorial;
