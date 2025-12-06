// core/challenges.ts - Daily Challenge System

export interface Challenge {
    id: string;
    name: string;
    description: string;
    emoji: string;
    condition: ChallengeCondition;
    reward: ChallengeReward;
    difficulty: 'easy' | 'medium' | 'hard';
}

export interface ChallengeCondition {
    type: 'win' | 'win_without_attacks' | 'win_fast' | 'win_with_cards_left' | 'use_power_cards' | 'perfect_game';
    value?: number; // e.g., win in under X seconds, use X power cards
}

export interface ChallengeReward {
    coins: number;
    unlockId?: string; // Unlock a card skin or theme
}

export interface DailyProgress {
    date: string; // ISO date string (YYYY-MM-DD)
    challengeId: string;
    completed: boolean;
    progress: number; // 0-100 percentage
}

// Pre-defined challenges pool
const challengePool: Challenge[] = [
    {
        id: 'win_once',
        name: 'First Blood',
        description: 'Win 1 game today',
        emoji: '🎯',
        condition: { type: 'win', value: 1 },
        reward: { coins: 20 },
        difficulty: 'easy',
    },
    {
        id: 'win_three',
        name: 'Hat Trick',
        description: 'Win 3 games today',
        emoji: '🎩',
        condition: { type: 'win', value: 3 },
        reward: { coins: 50 },
        difficulty: 'medium',
    },
    {
        id: 'pacifist',
        name: 'Pacifist',
        description: 'Win without playing any attack cards',
        emoji: '☮️',
        condition: { type: 'win_without_attacks' },
        reward: { coins: 75, unlockId: 'theme_zen' },
        difficulty: 'hard',
    },
    {
        id: 'speedster',
        name: 'Speedster',
        description: 'Win a game in under 2 minutes',
        emoji: '⚡',
        condition: { type: 'win_fast', value: 120000 },
        reward: { coins: 60 },
        difficulty: 'medium',
    },
    {
        id: 'clutch',
        name: 'Clutch Master',
        description: 'Win with 10+ cards in your deck remaining',
        emoji: '🎪',
        condition: { type: 'win_with_cards_left', value: 10 },
        reward: { coins: 40 },
        difficulty: 'easy',
    },
    {
        id: 'power_player',
        name: 'Power Player',
        description: 'Use 5 power cards (Q, K, 7) in one game and win',
        emoji: '💪',
        condition: { type: 'use_power_cards', value: 5 },
        reward: { coins: 55 },
        difficulty: 'medium',
    },
    {
        id: 'perfect',
        name: 'Perfect Game',
        description: 'Win without drawing any cards',
        emoji: '✨',
        condition: { type: 'perfect_game' },
        reward: { coins: 100, unlockId: 'cardback_gold' },
        difficulty: 'hard',
    },
];

const STORAGE_KEY = 'jack-attack-daily-challenge';

// Get today's date as YYYY-MM-DD
const getTodayDate = (): string => {
    return new Date().toISOString().split('T')[0];
};

// Get a deterministic challenge for today based on date
export const getTodaysChallenge = (): Challenge => {
    const today = getTodayDate();
    // Use date to pick a challenge deterministically
    const dayNumber = new Date(today).getTime();
    const index = dayNumber % challengePool.length;
    return challengePool[index];
};

// Load daily progress from localStorage
export const loadDailyProgress = (): DailyProgress | null => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const progress = JSON.parse(saved) as DailyProgress;
            // Check if it's still today
            if (progress.date === getTodayDate()) {
                return progress;
            }
        }
    } catch (e) {
        console.error('Failed to load daily progress:', e);
    }
    return null;
};

// Save daily progress
export const saveDailyProgress = (progress: DailyProgress): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) {
        console.error('Failed to save daily progress:', e);
    }
};

// Initialize or get current daily progress
export const getDailyProgress = (): DailyProgress => {
    const existing = loadDailyProgress();
    if (existing) return existing;

    const today = getTodayDate();
    const challenge = getTodaysChallenge();
    const newProgress: DailyProgress = {
        date: today,
        challengeId: challenge.id,
        completed: false,
        progress: 0,
    };
    saveDailyProgress(newProgress);
    return newProgress;
};

// Check if a game result completes the daily challenge
export const checkChallengeCompletion = (
    won: boolean,
    attackCardsUsed: number,
    durationMs: number,
    deckCardsRemaining: number,
    powerCardsUsed: number,
    cardsDrawn: number
): { completed: boolean; progress: number } => {
    const challenge = getTodaysChallenge();
    const progress = getDailyProgress();

    if (progress.completed) {
        return { completed: true, progress: 100 };
    }

    if (!won) {
        return { completed: false, progress: progress.progress };
    }

    let newProgress = progress.progress;
    let completed = false;

    switch (challenge.condition.type) {
        case 'win':
            newProgress = Math.min(100, newProgress + (100 / (challenge.condition.value || 1)));
            completed = newProgress >= 100;
            break;

        case 'win_without_attacks':
            if (attackCardsUsed === 0) {
                completed = true;
                newProgress = 100;
            }
            break;

        case 'win_fast':
            if (durationMs < (challenge.condition.value || 120000)) {
                completed = true;
                newProgress = 100;
            }
            break;

        case 'win_with_cards_left':
            if (deckCardsRemaining >= (challenge.condition.value || 10)) {
                completed = true;
                newProgress = 100;
            }
            break;

        case 'use_power_cards':
            if (powerCardsUsed >= (challenge.condition.value || 5)) {
                completed = true;
                newProgress = 100;
            }
            break;

        case 'perfect_game':
            if (cardsDrawn === 0) {
                completed = true;
                newProgress = 100;
            }
            break;
    }

    // Update and save progress
    const updatedProgress: DailyProgress = {
        ...progress,
        progress: newProgress,
        completed,
    };
    saveDailyProgress(updatedProgress);

    return { completed, progress: newProgress };
};

// Get all challenges (for viewing in a list)
export const getAllChallenges = (): Challenge[] => {
    return challengePool;
};
