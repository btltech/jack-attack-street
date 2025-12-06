// core/commentaryPersonalities.ts - Different commentary styles

import { Commentary, CommentaryType } from './commentary';

export type PersonalityType = 'hype' | 'british' | 'trash_talk' | 'zen' | 'robot';

export interface CommentaryPersonality {
    id: PersonalityType;
    name: string;
    emoji: string;
    description: string;
    unlockCondition?: string;
}

export const personalities: CommentaryPersonality[] = [
    {
        id: 'hype',
        name: 'Hype Man',
        emoji: '🎤',
        description: 'Gets SUPER excited about everything!',
    },
    {
        id: 'british',
        name: 'British Gentleman',
        emoji: '🎩',
        description: 'Posh and proper commentary',
    },
    {
        id: 'trash_talk',
        name: 'Trash Talker',
        emoji: '😈',
        description: 'Savage roasts and burns',
        unlockCondition: 'Win 20 games',
    },
    {
        id: 'zen',
        name: 'Zen Master',
        emoji: '🧘',
        description: 'Calm and philosophical',
        unlockCondition: 'Complete Pacifist challenge',
    },
    {
        id: 'robot',
        name: 'Robot AI',
        emoji: '🤖',
        description: 'Cold, calculated observations',
        unlockCondition: 'Win on Hard difficulty',
    },
];

// Personality-specific commentary templates
const commentaryTemplates: Record<PersonalityType, Record<string, string[]>> = {
    hype: {
        player_attack: [
            "OH MY GOOOOOOOD! THAT'S A +2! 🔥🔥🔥",
            "ABSOLUTELY DEVASTATING! THE CROWD GOES WILD!",
            "BAM! BOOM! KAPOW! WHAT A PLAY!",
            "DID YOU SEE THAT?! INCREDIBLE!",
        ],
        player_win: [
            "YOOOOOO! YOU DID IT! CHAMPION OF THE WORLD!",
            "UNBELIEVABLE! LEGENDARY! ICONIC!",
            "THE GREATEST OF ALL TIME! GOAT STATUS!",
        ],
        player_lose: [
            "NOOOOO! SO CLOSE! WE'LL GET 'EM NEXT TIME!",
            "HEARTBREAKING! BUT YOU FOUGHT HARD!",
        ],
        bot_attack: [
            "OH SNAP! THE BOT IS FIGHTING BACK!",
            "WOAH WOAH WOAH! ATTACK INCOMING!",
        ],
        draw: [
            "GOTTA DRAW! NO SHAME IN THE GAME!",
            "DECK DIVE! LET'S GO!",
        ],
    },
    british: {
        player_attack: [
            "I say, rather splendid attack there, old chap!",
            "Quite the aggressive maneuver, if I do say so myself.",
            "Good heavens, what a delightfully ruthless play!",
        ],
        player_win: [
            "Jolly good show! Victory is yours, dear player!",
            "Magnificent! A triumph worthy of celebration!",
            "Pip pip cheerio! You've done it splendidly!",
        ],
        player_lose: [
            "Oh dear, most unfortunate. Perhaps some tea?",
            "Chin up, old sport. Better luck next time.",
        ],
        bot_attack: [
            "Goodness gracious, the opponent retaliates!",
            "Well, that's rather impolite of them.",
        ],
        draw: [
            "One must occasionally replenish one's hand.",
            "A strategic withdrawal to the deck, quite wise.",
        ],
    },
    trash_talk: {
        player_attack: [
            "Get absolutely DESTROYED! 💀",
            "Sit down, son! You just got WRECKED!",
            "Is that all you got? Oh wait, YOU'RE attacking! Nice!",
        ],
        player_win: [
            "Too easy! Were they even trying? 😂",
            "Another one bites the dust! Pathetic!",
            "GG EZ! Uninstall, bot!",
        ],
        player_lose: [
            "LMAOOO imagine losing to a bot 🤡",
            "Skill issue detected. Try again, noob.",
        ],
        bot_attack: [
            "Aww, the bot thinks it can win! Cute.",
            "That tickled. Is that your best shot?",
        ],
        draw: [
            "Out of moves? Typical...",
            "Digging through the deck like a noob.",
        ],
    },
    zen: {
        player_attack: [
            "Like water flowing downhill, the attack finds its path.",
            "In conflict, there is opportunity.",
            "The card falls as the leaf from the tree.",
        ],
        player_win: [
            "Victory is not the destination, but the journey.",
            "In winning, remember: emptiness is form.",
            "The game ends. Peace remains.",
        ],
        player_lose: [
            "Defeat teaches what victory cannot.",
            "The river bends, but continues to flow.",
        ],
        bot_attack: [
            "The opponent acts as nature intended.",
            "Accept what comes. Adapt and overcome.",
        ],
        draw: [
            "Sometimes we must seek before we find.",
            "The deck offers what we need, not what we want.",
        ],
    },
    robot: {
        player_attack: [
            "ATTACK_EXECUTED. OPPONENT_DAMAGE: +2. PROBABILITY_WIN: INCREASED.",
            "OFFENSIVE_CARD_DEPLOYED. CALCULATING_RESPONSE...",
        ],
        player_win: [
            "GAME_STATE: VICTORY. HUMAN_PERFORMANCE: ACCEPTABLE.",
            "WIN_CONDITION_MET. DOPAMINE_RELEASE_AUTHORIZED.",
        ],
        player_lose: [
            "DEFEAT_DETECTED. SKILL_UPGRADE_RECOMMENDED.",
            "LOSS_RECORDED. RETRY_PROTOCOL_INITIATED.",
        ],
        bot_attack: [
            "WARNING: INCOMING_ATTACK. DEFENSE_REQUIRED.",
            "THREAT_LEVEL: ELEVATED. COUNTER_MEASURES: NULL.",
        ],
        draw: [
            "HAND_INSUFFICIENT. DECK_ACCESS_INITIATED.",
            "NO_VALID_MOVES. DRAWING_CARD...",
        ],
    },
};

const PERSONALITY_KEY = 'jack-attack-commentary-personality';

// Get current personality
export const getCurrentPersonality = (): PersonalityType => {
    try {
        const saved = localStorage.getItem(PERSONALITY_KEY) as PersonalityType;
        if (saved && personalities.some(p => p.id === saved)) {
            return saved;
        }
    } catch (e) {
        console.error('Failed to load personality:', e);
    }
    return 'hype'; // Default
};

// Set current personality
export const setCurrentPersonality = (personality: PersonalityType): void => {
    try {
        localStorage.setItem(PERSONALITY_KEY, personality);
    } catch (e) {
        console.error('Failed to save personality:', e);
    }
};

// Get personality-styled commentary
export const getStyledCommentary = (
    type: string,
    personality: PersonalityType
): string => {
    const templates = commentaryTemplates[personality];
    const options = templates[type] || templates['player_attack'];
    return options[Math.floor(Math.random() * options.length)];
};

// Check if personality is unlocked
export const isPersonalityUnlocked = (id: PersonalityType): boolean => {
    const personality = personalities.find(p => p.id === id);
    if (!personality?.unlockCondition) return true;

    // Check unlock conditions based on stats
    // For now, return true for base personalities
    const unlockedIds = ['hype', 'british'];
    const savedUnlocks = localStorage.getItem('jack-attack-personality-unlocks');
    if (savedUnlocks) {
        const unlocks: string[] = JSON.parse(savedUnlocks);
        return unlocks.includes(id);
    }
    return unlockedIds.includes(id);
};

// Unlock a personality
export const unlockPersonality = (id: PersonalityType): void => {
    const savedUnlocks = localStorage.getItem('jack-attack-personality-unlocks');
    const unlocks: string[] = savedUnlocks ? JSON.parse(savedUnlocks) : ['hype', 'british'];
    if (!unlocks.includes(id)) {
        unlocks.push(id);
        localStorage.setItem('jack-attack-personality-unlocks', JSON.stringify(unlocks));
    }
};
