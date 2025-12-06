// core/stats.ts - Enhanced statistics tracking system

export interface GameRecord {
    id: string;
    date: string;
    won: boolean;
    difficulty: string;
    gameMode: string;
    opponentCount: number;
    turnsPlayed: number;
    cardsPlayed: number;
    attackCardsUsed: number;
    durationMs: number;
}

export interface PlayerStats {
    // Core stats
    totalGames: number;
    wins: number;
    losses: number;

    // Streaks
    currentWinStreak: number;
    bestWinStreak: number;
    currentLoseStreak: number;

    // Performance
    totalCardsPlayed: number;
    totalAttackCardsUsed: number;
    fastestWinMs: number | null;
    averageGameDurationMs: number;

    // Per-difficulty breakdown
    easyWins: number;
    easyLosses: number;
    mediumWins: number;
    mediumLosses: number;
    hardWins: number;
    hardLosses: number;

    // Achievements
    perfectWins: number;  // Win without drawing any cards
    comebackWins: number; // Win after being 10+ cards behind

    // Recent games (last 10)
    recentGames: GameRecord[];

    // Coins for shop
    coins: number;

    // Timestamps
    firstGameDate: string | null;
    lastGameDate: string | null;
}

const STORAGE_KEY = 'jack-attack-stats-v2';

const defaultStats: PlayerStats = {
    totalGames: 0,
    wins: 0,
    losses: 0,
    currentWinStreak: 0,
    bestWinStreak: 0,
    currentLoseStreak: 0,
    totalCardsPlayed: 0,
    totalAttackCardsUsed: 0,
    fastestWinMs: null,
    averageGameDurationMs: 0,
    easyWins: 0,
    easyLosses: 0,
    mediumWins: 0,
    mediumLosses: 0,
    hardWins: 0,
    hardLosses: 0,
    perfectWins: 0,
    comebackWins: 0,
    recentGames: [],
    coins: 0,
    firstGameDate: null,
    lastGameDate: null,
};

// Load stats from localStorage
export const loadStats = (): PlayerStats => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // Merge with defaults to handle new fields
            return { ...defaultStats, ...parsed };
        }
    } catch (e) {
        console.error('Failed to load stats:', e);
    }
    return { ...defaultStats };
};

// Save stats to localStorage
export const saveStats = (stats: PlayerStats): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (e) {
        console.error('Failed to save stats:', e);
    }
};

// Migrate from old stats format
export const migrateOldStats = (): void => {
    try {
        const oldStats = localStorage.getItem('jack-attack-stats');
        if (oldStats && !localStorage.getItem(STORAGE_KEY)) {
            const old = JSON.parse(oldStats);
            const migrated: PlayerStats = {
                ...defaultStats,
                wins: old.wins || 0,
                losses: old.losses || 0,
                totalGames: (old.wins || 0) + (old.losses || 0),
            };
            saveStats(migrated);
            console.log('Migrated old stats to new format');
        }
    } catch (e) {
        console.error('Failed to migrate stats:', e);
    }
};

// Record a completed game
export const recordGame = (
    stats: PlayerStats,
    record: Omit<GameRecord, 'id' | 'date'>
): PlayerStats => {
    const now = new Date().toISOString();
    const gameRecord: GameRecord = {
        ...record,
        id: `game-${Date.now()}`,
        date: now,
    };

    const newStats = { ...stats };

    // Update core counts
    newStats.totalGames++;
    newStats.lastGameDate = now;
    if (!newStats.firstGameDate) {
        newStats.firstGameDate = now;
    }

    // Update cards stats
    newStats.totalCardsPlayed += record.cardsPlayed;
    newStats.totalAttackCardsUsed += record.attackCardsUsed;

    if (record.won) {
        newStats.wins++;
        newStats.currentWinStreak++;
        newStats.currentLoseStreak = 0;

        // Best streak
        if (newStats.currentWinStreak > newStats.bestWinStreak) {
            newStats.bestWinStreak = newStats.currentWinStreak;
        }

        // Fastest win
        if (newStats.fastestWinMs === null || record.durationMs < newStats.fastestWinMs) {
            newStats.fastestWinMs = record.durationMs;
        }

        // Earn coins (more for harder difficulty)
        const coinMultiplier = record.difficulty === 'hard' ? 3 : record.difficulty === 'medium' ? 2 : 1;
        newStats.coins += 10 * coinMultiplier;

        // Per-difficulty wins
        if (record.difficulty === 'easy') newStats.easyWins++;
        else if (record.difficulty === 'medium') newStats.mediumWins++;
        else if (record.difficulty === 'hard') newStats.hardWins++;

    } else {
        newStats.losses++;
        newStats.currentLoseStreak++;
        newStats.currentWinStreak = 0;

        // Per-difficulty losses
        if (record.difficulty === 'easy') newStats.easyLosses++;
        else if (record.difficulty === 'medium') newStats.mediumLosses++;
        else if (record.difficulty === 'hard') newStats.hardLosses++;
    }

    // Update average duration
    const totalDuration = newStats.averageGameDurationMs * (newStats.totalGames - 1) + record.durationMs;
    newStats.averageGameDurationMs = Math.round(totalDuration / newStats.totalGames);

    // Add to recent games (keep last 10)
    newStats.recentGames = [gameRecord, ...newStats.recentGames].slice(0, 10);

    // Save and return
    saveStats(newStats);
    return newStats;
};

// Get win rate as percentage
export const getWinRate = (stats: PlayerStats): number => {
    if (stats.totalGames === 0) return 0;
    return Math.round((stats.wins / stats.totalGames) * 100);
};

// Format duration for display
export const formatDuration = (ms: number | null): string => {
    if (ms === null) return '--:--';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Get rank based on wins
export const getRank = (stats: PlayerStats): { name: string; emoji: string; nextAt: number } => {
    const wins = stats.wins;

    if (wins >= 100) return { name: 'Legend', emoji: '👑', nextAt: 100 };
    if (wins >= 50) return { name: 'Diamond', emoji: '💎', nextAt: 100 };
    if (wins >= 25) return { name: 'Platinum', emoji: '🏆', nextAt: 50 };
    if (wins >= 10) return { name: 'Gold', emoji: '🥇', nextAt: 25 };
    if (wins >= 5) return { name: 'Silver', emoji: '🥈', nextAt: 10 };
    if (wins >= 1) return { name: 'Bronze', emoji: '🥉', nextAt: 5 };
    return { name: 'Rookie', emoji: '🎮', nextAt: 1 };
};

// Reset all stats (with confirmation)
export const resetStats = (): PlayerStats => {
    const fresh = { ...defaultStats };
    saveStats(fresh);
    return fresh;
};
