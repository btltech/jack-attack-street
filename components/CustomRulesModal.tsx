// components/CustomRulesModal.tsx - Toggle specific card powers

import React, { useState, useEffect } from 'react';

export interface GameRules {
    enableAttack2: boolean;      // 2s make opponents pick up 2
    enableBlackJack: boolean;    // Black Jacks = pick up 5
    enableSkip: boolean;         // 8s skip next player
    enableReverse: boolean;      // Aces reverse direction
    enableWild: boolean;         // Queens are wild (choose suit)
    enableSwap: boolean;         // Kings swap hands
    enablePeek: boolean;         // 7s peek at opponent card
    enableStacking: boolean;     // Can stack attack cards
}

const defaultRules: GameRules = {
    enableAttack2: true,
    enableBlackJack: true,
    enableSkip: true,
    enableReverse: true,
    enableWild: true,
    enableSwap: true,
    enablePeek: true,
    enableStacking: true,
};

const RULES_STORAGE_KEY = 'jack-attack-custom-rules';

export const loadRules = (): GameRules => {
    try {
        const saved = localStorage.getItem(RULES_STORAGE_KEY);
        if (saved) {
            return { ...defaultRules, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.error('Failed to load rules:', e);
    }
    return defaultRules;
};

export const saveRules = (rules: GameRules): void => {
    try {
        localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
    } catch (e) {
        console.error('Failed to save rules:', e);
    }
};

interface RuleToggleProps {
    label: string;
    emoji: string;
    description: string;
    enabled: boolean;
    onChange: (enabled: boolean) => void;
}

const RuleToggle: React.FC<RuleToggleProps> = ({ label, emoji, description, enabled, onChange }) => (
    <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
            <span className="text-xl">{emoji}</span>
            <div>
                <div className="font-bold text-sm">{label}</div>
                <div className="text-xs text-purple-300">{description}</div>
            </div>
        </div>
        <button
            onClick={() => onChange(!enabled)}
            className={`w-12 h-7 rounded-full transition-all p-1 ${enabled ? 'bg-green-500' : 'bg-gray-600'
                }`}
        >
            <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transition-all ${enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
            />
        </button>
    </div>
);

interface CustomRulesModalProps {
    onClose: () => void;
    rules: GameRules;
    onRulesChange: (rules: GameRules) => void;
}

const CustomRulesModal: React.FC<CustomRulesModalProps> = ({ onClose, rules, onRulesChange }) => {
    const [localRules, setLocalRules] = useState<GameRules>(rules);

    // Handle Escape key to close modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleChange = (key: keyof GameRules, value: boolean) => {
        const newRules = { ...localRules, [key]: value };
        setLocalRules(newRules);
    };

    const handleSave = () => {
        onRulesChange(localRules);
        saveRules(localRules);
        onClose();
    };

    const handleReset = () => {
        setLocalRules(defaultRules);
    };

    const ruleItems: Array<{ key: keyof GameRules; label: string; emoji: string; description: string }> = [
        { key: 'enableAttack2', label: '+2 Attack', emoji: '💥', description: 'Play 2 to make opponent draw 2' },
        { key: 'enableBlackJack', label: 'Black Jack Attack', emoji: '🔥', description: 'Black Jacks force +5 pickup' },
        { key: 'enableSkip', label: 'Skip (8s)', emoji: '🚫', description: '8s skip the next player' },
        { key: 'enableReverse', label: 'Reverse (Aces)', emoji: '↩️', description: 'Aces reverse play direction' },
        { key: 'enableWild', label: 'Wild (Queens)', emoji: '👑', description: 'Queens can be played on any card' },
        { key: 'enableSwap', label: 'Swap (Kings)', emoji: '🤴', description: 'Kings swap hands with opponent' },
        { key: 'enablePeek', label: 'Peek (7s)', emoji: '👁️', description: '7s peek at opponent card' },
        { key: 'enableStacking', label: 'Attack Stacking', emoji: '📚', description: 'Stack +2/+5 cards to deflect' },
    ];

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
            <div className="bg-gradient-to-br from-indigo-900 to-purple-900 text-white rounded-[2rem] max-w-md w-full relative shadow-2xl border-4 border-yellow-400 max-h-[90vh] overflow-hidden flex flex-col">
                {/* Sticky Header */}
                <div className="sticky top-0 z-10 bg-gradient-to-br from-indigo-900 to-purple-900 p-6 pb-4 border-b border-white/10">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-3xl hover:rotate-90 transition-transform"
                        aria-label="Close modal"
                    >
                        ❌
                    </button>

                    <h3 className="text-2xl font-black text-center text-yellow-400">⚙️ Custom Rules</h3>
                    <p className="text-sm text-purple-300 text-center mt-2">Toggle special card abilities on/off</p>
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto flex-1 p-6 pt-4">
                    <div className="bg-white/10 rounded-xl p-4 mb-4">
                        {ruleItems.map((item) => (
                            <RuleToggle
                                key={item.key}
                                label={item.label}
                                emoji={item.emoji}
                                description={item.description}
                                enabled={localRules[item.key]}
                                onChange={(val) => handleChange(item.key, val)}
                            />
                        ))}
                    </div>
                </div>

                {/* Sticky Footer with Buttons */}
                <div className="sticky bottom-0 bg-gradient-to-br from-indigo-900 to-purple-900 p-6 pt-4 border-t border-white/10">
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-xl border-b-4 border-gray-800"
                        >
                            Close
                        </button>
                        <button
                            onClick={handleReset}
                            className="flex-1 bg-orange-500 hover:bg-orange-400 text-white font-bold py-3 rounded-xl border-b-4 border-orange-700"
                        >
                            Reset
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex-1 bg-green-500 hover:bg-green-400 text-white font-bold py-3 rounded-xl border-b-4 border-green-700"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomRulesModal;
export { defaultRules };
