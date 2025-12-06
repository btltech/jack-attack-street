// core/themes.ts - Card Skins and Table Themes

export interface CardTheme {
    id: string;
    name: string;
    emoji: string;
    description: string;
    cardBackStyle: string; // CSS background property
    cardBackColor: string; // CSS backgroundColor
    cardFaceStyle: string; // Additional Tailwind classes
    tableBackground: string; // Tailwind gradient classes
    unlockCondition?: string; // How to unlock (if locked by default)
    isDefault?: boolean;
}

// Define available themes
export const themes: CardTheme[] = [
    {
        id: 'classic',
        name: 'Classic Blue',
        emoji: '💙',
        description: 'The original street style',
        cardBackStyle: 'linear-gradient(45deg, #3b82f6 25%, transparent 25%, transparent 75%, #3b82f6 75%)',
        cardBackColor: '#2563eb',
        cardFaceStyle: 'bg-white',
        tableBackground: 'from-violet-600 via-indigo-700 to-purple-800',
        isDefault: true,
    },
    {
        id: 'dark',
        name: 'Midnight Dark',
        emoji: '🌙',
        description: 'Sleek and mysterious',
        cardBackStyle: 'linear-gradient(45deg, #1f2937 25%, transparent 25%, transparent 75%, #1f2937 75%)',
        cardBackColor: '#111827',
        cardFaceStyle: 'bg-gray-900 text-white',
        tableBackground: 'from-gray-900 via-gray-800 to-black',
    },
    {
        id: 'neon',
        name: 'Neon Nights',
        emoji: '🌈',
        description: 'Flashy cyberpunk vibes',
        cardBackStyle: 'linear-gradient(135deg, #ff00ff, #00ffff, #ff00ff)',
        cardBackColor: '#000000',
        cardFaceStyle: 'bg-black text-white border-2 border-cyan-400',
        tableBackground: 'from-purple-900 via-pink-900 to-indigo-900',
        unlockCondition: 'Win 10 games',
    },
    {
        id: 'vintage',
        name: 'Vintage Casino',
        emoji: '🎰',
        description: 'Old-school Vegas style',
        cardBackStyle: 'repeating-linear-gradient(45deg, #7c2d12 0px, #7c2d12 10px, #92400e 10px, #92400e 20px)',
        cardBackColor: '#78350f',
        cardFaceStyle: 'bg-amber-50 border-amber-800',
        tableBackground: 'from-green-900 via-green-800 to-emerald-900',
        unlockCondition: 'Win 25 games',
    },
    {
        id: 'zen',
        name: 'Zen Garden',
        emoji: '🎋',
        description: 'Peaceful and calm',
        cardBackStyle: 'linear-gradient(180deg, #065f46, #047857)',
        cardBackColor: '#047857',
        cardFaceStyle: 'bg-emerald-50 border-emerald-600',
        tableBackground: 'from-emerald-800 via-teal-800 to-green-900',
        unlockCondition: 'Complete Pacifist challenge',
    },
    {
        id: 'gold',
        name: 'Royal Gold',
        emoji: '👑',
        description: 'Fit for royalty',
        cardBackStyle: 'linear-gradient(135deg, #fbbf24, #f59e0b, #d97706)',
        cardBackColor: '#fbbf24',
        cardFaceStyle: 'bg-amber-50 border-2 border-yellow-500',
        tableBackground: 'from-amber-900 via-yellow-900 to-orange-900',
        unlockCondition: 'Complete Perfect Game challenge',
    },
];

const THEME_STORAGE_KEY = 'jack-attack-theme';
const UNLOCKS_STORAGE_KEY = 'jack-attack-unlocks';

// Get the current theme
export const getCurrentTheme = (): CardTheme => {
    try {
        const savedId = localStorage.getItem(THEME_STORAGE_KEY);
        if (savedId) {
            const theme = themes.find(t => t.id === savedId);
            if (theme && isThemeUnlocked(theme.id)) {
                return theme;
            }
        }
    } catch (e) {
        console.error('Failed to load theme:', e);
    }
    return themes.find(t => t.isDefault) || themes[0];
};

// Set the current theme
export const setCurrentTheme = (themeId: string): boolean => {
    if (!isThemeUnlocked(themeId)) {
        return false;
    }
    try {
        localStorage.setItem(THEME_STORAGE_KEY, themeId);
        return true;
    } catch (e) {
        console.error('Failed to save theme:', e);
        return false;
    }
};

// Get unlocked theme IDs
export const getUnlockedThemes = (): string[] => {
    try {
        const saved = localStorage.getItem(UNLOCKS_STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.error('Failed to load unlocks:', e);
    }
    // Default unlocked themes
    return ['classic', 'dark'];
};

// Check if a theme is unlocked
export const isThemeUnlocked = (themeId: string): boolean => {
    const unlocked = getUnlockedThemes();
    return unlocked.includes(themeId);
};

// Unlock a theme
export const unlockTheme = (themeId: string): void => {
    const unlocked = getUnlockedThemes();
    if (!unlocked.includes(themeId)) {
        unlocked.push(themeId);
        try {
            localStorage.setItem(UNLOCKS_STORAGE_KEY, JSON.stringify(unlocked));
        } catch (e) {
            console.error('Failed to save unlocks:', e);
        }
    }
};

// Get all themes with unlock status
export const getThemesWithStatus = (): Array<CardTheme & { unlocked: boolean }> => {
    const unlocked = getUnlockedThemes();
    return themes.map(theme => ({
        ...theme,
        unlocked: unlocked.includes(theme.id),
    }));
};
