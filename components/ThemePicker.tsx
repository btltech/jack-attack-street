// components/ThemePicker.tsx - Theme Selection Component

import React from 'react';
import { CardTheme, getThemesWithStatus, setCurrentTheme, getCurrentTheme } from '../core/themes';

interface ThemePickerProps {
    onClose: () => void;
    onThemeChange: (theme: CardTheme) => void;
}

const ThemePicker: React.FC<ThemePickerProps> = ({ onClose, onThemeChange }) => {
    const themes = getThemesWithStatus();
    const currentTheme = getCurrentTheme();

    const handleSelectTheme = (theme: CardTheme & { unlocked: boolean }) => {
        if (theme.unlocked) {
            setCurrentTheme(theme.id);
            onThemeChange(theme);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
            <div className="bg-gradient-to-br from-indigo-900 to-purple-900 text-white p-6 rounded-[2rem] max-w-lg w-full relative shadow-2xl border-4 border-yellow-400 max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-3xl hover:rotate-90 transition-transform"
                >
                    ❌
                </button>

                <h3 className="text-3xl font-black mb-6 text-center text-yellow-400">🎨 Card Themes</h3>

                <div className="grid grid-cols-2 gap-4">
                    {themes.map((theme) => (
                        <button
                            key={theme.id}
                            onClick={() => handleSelectTheme(theme)}
                            disabled={!theme.unlocked}
                            className={`p-4 rounded-xl border-2 transition-all ${currentTheme.id === theme.id
                                ? 'border-yellow-400 bg-yellow-400/20'
                                : theme.unlocked
                                    ? 'border-white/30 hover:border-white/60 hover:bg-white/10'
                                    : 'border-gray-600 opacity-50 cursor-not-allowed'
                                }`}
                        >
                            {/* Theme Preview Card */}
                            <div
                                className="w-12 h-16 mx-auto rounded-lg mb-2 border-2 border-white/30"
                                style={{
                                    background: theme.cardBackStyle,
                                    backgroundColor: theme.cardBackColor,
                                }}
                            />

                            <div className="text-center">
                                <span className="text-xl">{theme.emoji}</span>
                                <h4 className="font-bold text-sm">{theme.name}</h4>
                                <p className="text-xs text-purple-300 mt-1">
                                    {theme.unlocked ? theme.description : `🔒 ${theme.unlockCondition}`}
                                </p>
                            </div>

                            {currentTheme.id === theme.id && (
                                <div className="mt-2 text-xs text-yellow-400 font-bold">✓ Active</div>
                            )}
                        </button>
                    ))}
                </div>

                <button
                    onClick={onClose}
                    className="w-full mt-6 bg-yellow-400 text-black font-bold py-3 rounded-xl border-b-4 border-yellow-600 hover:bg-yellow-300"
                >
                    Done
                </button>
            </div>
        </div>
    );
};

export default ThemePicker;
