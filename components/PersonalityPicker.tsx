// components/PersonalityPicker.tsx - Commentary Personality Selection

import React from 'react';
import { personalities, PersonalityType, getCurrentPersonality, setCurrentPersonality, isPersonalityUnlocked } from '../core/commentaryPersonalities';
import { playClickSound } from '../core/sounds';

interface PersonalityPickerProps {
    onClose: () => void;
    onPersonalityChange: (personality: PersonalityType) => void;
}

const PersonalityPicker: React.FC<PersonalityPickerProps> = ({ onClose, onPersonalityChange }) => {
    const currentPersonality = getCurrentPersonality();

    const handleSelect = (id: PersonalityType) => {
        if (isPersonalityUnlocked(id)) {
            playClickSound();
            setCurrentPersonality(id);
            onPersonalityChange(id);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
            <div className="bg-gradient-to-br from-indigo-900 to-purple-900 text-white p-6 rounded-[2rem] max-w-md w-full relative shadow-2xl border-4 border-yellow-400 max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-3xl hover:rotate-90 transition-transform"
                >
                    ❌
                </button>

                <h3 className="text-2xl font-black mb-2 text-center text-yellow-400">🎙️ Commentary Style</h3>
                <p className="text-sm text-purple-300 text-center mb-4">Choose your announcer's personality</p>

                <div className="space-y-3">
                    {personalities.map((personality) => {
                        const unlocked = isPersonalityUnlocked(personality.id);
                        const isCurrent = currentPersonality === personality.id;

                        return (
                            <button
                                key={personality.id}
                                onClick={() => handleSelect(personality.id)}
                                disabled={!unlocked}
                                className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${isCurrent
                                        ? 'border-yellow-400 bg-yellow-400/20'
                                        : unlocked
                                            ? 'border-white/30 hover:border-white/60 hover:bg-white/10'
                                            : 'border-gray-600 opacity-50 cursor-not-allowed'
                                    }`}
                            >
                                <span className="text-3xl">{personality.emoji}</span>
                                <div className="text-left flex-1">
                                    <div className="font-bold">{personality.name}</div>
                                    <div className="text-sm text-purple-300">
                                        {unlocked ? personality.description : `🔒 ${personality.unlockCondition}`}
                                    </div>
                                </div>
                                {isCurrent && (
                                    <span className="text-yellow-400 font-bold text-sm">✓ Active</span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <button
                    onClick={onClose}
                    className="w-full mt-4 bg-yellow-400 text-black font-bold py-3 rounded-xl border-b-4 border-yellow-600 hover:bg-yellow-300"
                >
                    Done
                </button>
            </div>
        </div>
    );
};

export default PersonalityPicker;
