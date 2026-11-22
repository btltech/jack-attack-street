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
        name: 'Classic Street',
        emoji: '💙',
        description: 'High-contrast deep royal table',
        cardBackStyle: 'linear-gradient(45deg, #2563eb 25%, transparent 25%, transparent 75%, #2563eb 75%)',
        cardBackColor: '#1d4ed8',
        cardFaceStyle: 'bg-white',
        tableBackground: 'from-slate-950 via-indigo-950 to-purple-950',
        isDefault: true,
    },
    {
        id: 'dark',
        name: 'Midnight Dark',
        emoji: '🌙',
        description: 'Ultra-high contrast obsidian',
        cardBackStyle: 'linear-gradient(45deg, #1f2937 25%, transparent 25%, transparent 75%, #1f2937 75%)',
        cardBackColor: '#090d16',
        cardFaceStyle: 'bg-slate-900 text-white',
        tableBackground: 'from-zinc-950 via-neutral-900 to-black',
    },
    {
        id: 'neon',
        name: 'Neon Nights',
        emoji: '🌈',
        description: 'Deep cyberpunk contrast',
        cardBackStyle: 'linear-gradient(135deg, #a21caf, #0284c7, #7e22ce)',
        cardBackColor: '#0f172a',
        cardFaceStyle: 'bg-slate-950 text-white border-2 border-cyan-400',
        tableBackground: 'from-slate-950 via-fuchsia-950 to-indigo-950',
        unlockCondition: 'Win 10 games',
    },
    {
        id: 'vintage',
        name: 'Vintage Casino',
        emoji: '🎰',
        description: 'Classic deep casino felt',
        cardBackStyle: 'repeating-linear-gradient(45deg, #7c2d12 0px, #7c2d12 10px, #9a3412 10px, #9a3412 20px)',
        cardBackColor: '#7c2d12',
        cardFaceStyle: 'bg-amber-50 border-amber-800',
        tableBackground: 'from-emerald-950 via-green-950 to-slate-950',
        unlockCondition: 'Win 25 games',
    },
    {
        id: 'zen',
        name: 'Zen Garden',
        emoji: '🎋',
        description: 'Deep calm emerald felt',
        cardBackStyle: 'linear-gradient(180deg, #065f46, #047857)',
        cardBackColor: '#065f46',
        cardFaceStyle: 'bg-emerald-50 border-emerald-700',
        tableBackground: 'from-teal-950 via-emerald-950 to-slate-950',
        unlockCondition: 'Complete Pacifist challenge',
    },
    {
        id: 'gold',
        name: 'Royal Gold',
        emoji: '👑',
        description: 'Regal deep gold & espresso',
        cardBackStyle: 'linear-gradient(135deg, #b45309, #d97706, #92400e)',
        cardBackColor: '#92400e',
        cardFaceStyle: 'bg-amber-50 border-2 border-amber-600',
        tableBackground: 'from-stone-950 via-amber-950 to-slate-950',
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
