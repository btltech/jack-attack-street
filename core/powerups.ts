// core/powerups.ts - Power-Up Shop System

export interface PowerUp {
    id: string;
    name: string;
    emoji: string;
    description: string;
    cost: number;
    effect: PowerUpEffect;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export type PowerUpEffect =
    | 'peek_all'       // See all opponent cards for a few seconds
    | 'block_attack'   // Block the next attack directed at you
    | 'draw_best'      // Draw the best playable card from deck
    | 'extra_turn'     // Get an extra turn after this one
    | 'shuffle_enemy'  // Shuffle an opponent's hand
    | 'discard_wild';  // Discard any card, play any card

// Available power-ups in the shop
export const powerUpCatalog: PowerUp[] = [
    {
        id: 'peek_all',
        name: 'X-Ray Vision',
        emoji: '👁️',
        description: 'See ALL opponent cards for 5 seconds',
        cost: 50,
        effect: 'peek_all',
        rarity: 'rare',
    },
    {
        id: 'block_attack',
        name: 'Shield',
        emoji: '🛡️',
        description: 'Block the next +2 or Black Jack attack',
        cost: 30,
        effect: 'block_attack',
        rarity: 'common',
    },
    {
        id: 'draw_best',
        name: 'Lucky Draw',
        emoji: '🍀',
        description: 'Draw a playable card from the deck',
        cost: 40,
        effect: 'draw_best',
        rarity: 'rare',
    },
    {
        id: 'extra_turn',
        name: 'Double Time',
        emoji: '⏩',
        description: 'Take another turn after this one',
        cost: 75,
        effect: 'extra_turn',
        rarity: 'epic',
    },
    {
        id: 'shuffle_enemy',
        name: 'Confusion',
        emoji: '🌀',
        description: 'Shuffle an opponent\'s hand randomly',
        cost: 35,
        effect: 'shuffle_enemy',
        rarity: 'common',
    },
    {
        id: 'discard_wild',
        name: 'Wild Card',
        emoji: '🃏',
        description: 'Discard any card, then play anything',
        cost: 100,
        effect: 'discard_wild',
        rarity: 'legendary',
    },
];

const INVENTORY_KEY = 'jack-attack-powerup-inventory';

export interface PowerUpInventory {
    [powerUpId: string]: number; // Quantity owned
}

// Load player's power-up inventory
export const loadInventory = (): PowerUpInventory => {
    try {
        const saved = localStorage.getItem(INVENTORY_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.error('Failed to load inventory:', e);
    }
    return {};
};

// Save player's power-up inventory
export const saveInventory = (inventory: PowerUpInventory): void => {
    try {
        localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventory));
    } catch (e) {
        console.error('Failed to save inventory:', e);
    }
};

// Purchase a power-up (returns new coin balance, or null if insufficient)
export const purchasePowerUp = (
    powerUpId: string,
    currentCoins: number
): { newCoins: number; inventory: PowerUpInventory } | null => {
    const powerUp = powerUpCatalog.find(p => p.id === powerUpId);
    if (!powerUp || currentCoins < powerUp.cost) {
        return null;
    }

    const inventory = loadInventory();
    inventory[powerUpId] = (inventory[powerUpId] || 0) + 1;
    saveInventory(inventory);

    return {
        newCoins: currentCoins - powerUp.cost,
        inventory,
    };
};

// Use a power-up (decrements inventory)
export const usePowerUp = (powerUpId: string): boolean => {
    const inventory = loadInventory();
    if (!inventory[powerUpId] || inventory[powerUpId] <= 0) {
        return false;
    }

    inventory[powerUpId]--;
    if (inventory[powerUpId] <= 0) {
        delete inventory[powerUpId];
    }
    saveInventory(inventory);
    return true;
};

// Get power-up by ID
export const getPowerUp = (id: string): PowerUp | undefined => {
    return powerUpCatalog.find(p => p.id === id);
};

// Get rarity color
export const getRarityColor = (rarity: PowerUp['rarity']): string => {
    switch (rarity) {
        case 'common': return 'text-gray-300';
        case 'rare': return 'text-blue-400';
        case 'epic': return 'text-purple-400';
        case 'legendary': return 'text-yellow-400';
    }
};

export const getRarityBg = (rarity: PowerUp['rarity']): string => {
    switch (rarity) {
        case 'common': return 'from-gray-700 to-gray-800';
        case 'rare': return 'from-blue-700 to-blue-900';
        case 'epic': return 'from-purple-700 to-purple-900';
        case 'legendary': return 'from-yellow-600 to-orange-700';
    }
};
