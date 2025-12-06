// components/Tutorial.tsx - Interactive onboarding tutorial

import React, { useState } from 'react';

interface TutorialStep {
    id: number;
    title: string;
    content: string;
    emoji: string;
    highlight?: string; // CSS selector for element to highlight
}

const tutorialSteps: TutorialStep[] = [
    {
        id: 1,
        title: "Welcome to Jack Attack Street! 🎉",
        content: "Get ready to become the King of the Street! Let's learn the basics.",
        emoji: "👋",
    },
    {
        id: 2,
        title: "The Goal",
        content: "Empty your hand first to WIN! Play cards that match the suit (♥♦♣♠) or rank (2, 3, K, etc.) of the top card.",
        emoji: "🎯",
    },
    {
        id: 3,
        title: "Attack Cards - 2s",
        content: "Play a 2 and the next player must pick up 2 cards! They can defend by playing their own 2 to stack it (+4, +6, etc.)",
        emoji: "💥",
    },
    {
        id: 4,
        title: "The Black Jack Attack!",
        content: "The Jack of Spades (♠) or Clubs (♣) is DEVASTATING! Next player picks up 5 cards!",
        emoji: "🔥",
    },
    {
        id: 5,
        title: "Skip Card - 8s",
        content: "Play an 8 to skip the next player's turn. Perfect for keeping in the lead!",
        emoji: "🚫",
    },
    {
        id: 6,
        title: "Reverse - Aces",
        content: "Play an Ace to reverse the direction of play. Great for strategic plays!",
        emoji: "↩️",
    },
    {
        id: 7,
        title: "Wild Card - Queens",
        content: "The Queen is WILD! Play it on anything, then choose the next suit. Use it wisely!",
        emoji: "👑",
    },
    {
        id: 8,
        title: "Swap Hands - Kings",
        content: "Play a King to swap your entire hand with another player. Great for a comeback!",
        emoji: "🤴",
    },
    {
        id: 9,
        title: "Peek - 7s",
        content: "Play a 7 to peek at one random card from an opponent's hand. Knowledge is power!",
        emoji: "👁️",
    },
    {
        id: 10,
        title: "Drawing Cards",
        content: "Can't play? Click the draw pile to pick up a card. If there's an attack, you'll pick up the penalty instead!",
        emoji: "📥",
    },
    {
        id: 11,
        title: "You're Ready!",
        content: "That's all the rules! Remember: match suit or rank, use attacks strategically, and empty your hand first to WIN!",
        emoji: "🏆",
    },
];

interface TutorialProps {
    onComplete: () => void;
    onSkip: () => void;
}

const Tutorial: React.FC<TutorialProps> = ({ onComplete, onSkip }) => {
    const [currentStep, setCurrentStep] = useState(0);

    const step = tutorialSteps[currentStep];
    const isLastStep = currentStep === tutorialSteps.length - 1;
    const isFirstStep = currentStep === 0;

    const handleNext = () => {
        if (isLastStep) {
            onComplete();
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (!isFirstStep) {
            setCurrentStep(prev => prev - 1);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4">
            <div className="bg-gradient-to-br from-indigo-800 to-purple-900 text-white p-6 md:p-8 rounded-[2rem] max-w-lg w-full relative shadow-2xl border-4 border-yellow-400">
                {/* Skip button */}
                <button
                    onClick={onSkip}
                    className="absolute top-4 right-4 text-purple-300 hover:text-white text-sm font-bold"
                >
                    Skip Tutorial →
                </button>

                {/* Progress dots */}
                <div className="flex justify-center gap-1 mb-6">
                    {tutorialSteps.map((_, idx) => (
                        <div
                            key={idx}
                            className={`w-2 h-2 rounded-full transition-all ${idx === currentStep
                                    ? 'bg-yellow-400 scale-125'
                                    : idx < currentStep
                                        ? 'bg-green-400'
                                        : 'bg-white/30'
                                }`}
                        />
                    ))}
                </div>

                {/* Step content */}
                <div className="text-center mb-8">
                    <div className="text-7xl mb-4 animate-bounce">{step.emoji}</div>
                    <h3 className="text-2xl md:text-3xl font-black mb-4 text-yellow-400">
                        {step.title}
                    </h3>
                    <p className="text-lg text-purple-100 leading-relaxed">
                        {step.content}
                    </p>
                </div>

                {/* Navigation buttons */}
                <div className="flex gap-4">
                    {!isFirstStep && (
                        <button
                            onClick={handlePrev}
                            className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl border-b-4 border-purple-800 transition-all"
                        >
                            ← Back
                        </button>
                    )}
                    <button
                        onClick={handleNext}
                        className={`flex-1 font-black py-3 rounded-xl border-b-4 transition-all ${isLastStep
                                ? 'bg-green-500 hover:bg-green-400 border-green-700 text-white'
                                : 'bg-yellow-400 hover:bg-yellow-300 border-yellow-600 text-black'
                            }`}
                    >
                        {isLastStep ? "Let's Play! 🎮" : 'Next →'}
                    </button>
                </div>

                {/* Step counter */}
                <div className="text-center mt-4 text-purple-300 text-sm">
                    Step {currentStep + 1} of {tutorialSteps.length}
                </div>
            </div>
        </div>
    );
};

export default Tutorial;
