// components/SuitPicker.tsx - Modal for Queen wild card suit selection
import React from 'react';
import { Suit } from '../core/types';

interface SuitPickerProps {
    onSelectSuit: (suit: Suit) => void;
}

const SuitPicker: React.FC<SuitPickerProps> = ({ onSelectSuit }) => {
    const suits = [
        { suit: Suit.Hearts, color: 'bg-red-500', hoverColor: 'hover:bg-red-400' },
        { suit: Suit.Diamonds, color: 'bg-red-500', hoverColor: 'hover:bg-red-400' },
        { suit: Suit.Clubs, color: 'bg-gray-800', hoverColor: 'hover:bg-gray-700' },
        { suit: Suit.Spades, color: 'bg-gray-800', hoverColor: 'hover:bg-gray-700' },
    ];

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] animate-in fade-in">
            <div className="bg-white rounded-3xl p-8 shadow-2xl border-4 border-yellow-400 max-w-sm w-full mx-4">
                <h2 className="text-3xl font-black text-center text-purple-600 mb-2">👑 WILD CARD!</h2>
                <p className="text-center text-gray-600 font-bold mb-6">Choose a suit:</p>

                <div className="grid grid-cols-2 gap-4">
                    {suits.map(({ suit, color, hoverColor }) => (
                        <button
                            key={suit}
                            onClick={() => onSelectSuit(suit)}
                            className={`${color} ${hoverColor} text-white text-6xl py-6 rounded-2xl border-b-4 border-black/30 transition-all transform hover:scale-105 active:scale-95 shadow-lg`}
                        >
                            {suit}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SuitPicker;
