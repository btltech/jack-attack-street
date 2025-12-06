// core/commentary.ts - AI trash talk and reactions

export interface Commentary {
    text: string;
    emoji: string;
}

// Attack lines - when bot plays +2 or Black Jack
const ATTACK_LINES: Commentary[] = [
    { text: "Take that!", emoji: "💥" },
    { text: "How do you like THAT?!", emoji: "😈" },
    { text: "Pick up those cards!", emoji: "🔥" },
    { text: "Oops, my bad... NOT!", emoji: "😏" },
    { text: "Better luck next time!", emoji: "💀" },
    { text: "Feel the burn!", emoji: "🌶️" },
    { text: "Surprise attack!", emoji: "⚡" },
    { text: "BOOM!", emoji: "💣" },
];

// Defense lines - when bot blocks an attack
const DEFENSE_LINES: Commentary[] = [
    { text: "Nice try!", emoji: "🛡️" },
    { text: "Right back at you!", emoji: "🔄" },
    { text: "Not today!", emoji: "✋" },
    { text: "Think again!", emoji: "🤔" },
    { text: "Uno reverse!", emoji: "↩️" },
];

// Skip lines - when bot skips someone
const SKIP_LINES: Commentary[] = [
    { text: "Skip to my Lou!", emoji: "🚫" },
    { text: "Sit this one out!", emoji: "💺" },
    { text: "Your turn? Nope!", emoji: "👋" },
    { text: "See ya!", emoji: "👀" },
];

// Win lines - when bot wins
const WIN_LINES: Commentary[] = [
    { text: "Too easy!", emoji: "😎" },
    { text: "GG no re!", emoji: "🏆" },
    { text: "Better luck next time!", emoji: "🥇" },
    { text: "I'm the champion!", emoji: "👑" },
    { text: "Was there ever any doubt?", emoji: "💪" },
];

// Lose lines - when bot loses
const LOSE_LINES: Commentary[] = [
    { text: "Rematch! REMATCH!", emoji: "😤" },
    { text: "You got lucky...", emoji: "🍀" },
    { text: "I let you win.", emoji: "😏" },
    { text: "Well played...", emoji: "👏" },
    { text: "Next time...", emoji: "😈" },
];

// Queen (wild) lines
const WILD_LINES: Commentary[] = [
    { text: "I choose my destiny!", emoji: "👑" },
    { text: "How about THIS suit?", emoji: "🃏" },
    { text: "Wild card baby!", emoji: "🎰" },
];

// King (swap) lines
const SWAP_LINES: Commentary[] = [
    { text: "Gimme those cards!", emoji: "🤴" },
    { text: "Trade ya!", emoji: "🔄" },
    { text: "Your hand looks better!", emoji: "👀" },
];

// Seven (peek) lines
const PEEK_LINES: Commentary[] = [
    { text: "I see you...", emoji: "👁️" },
    { text: "Interesting cards!", emoji: "🔍" },
    { text: "Now I know your secrets!", emoji: "🕵️" },
];

// Draw lines - when bot has to draw
const DRAW_LINES: Commentary[] = [
    { text: "Just building my army...", emoji: "🎴" },
    { text: "This is fine.", emoji: "🙃" },
    { text: "Strategic draw!", emoji: "🧠" },
];

// Almost winning lines - bot has few cards
const ALMOST_WIN_LINES: Commentary[] = [
    { text: "Almost there...", emoji: "😏" },
    { text: "One more!", emoji: "☝️" },
    { text: "The end is near!", emoji: "⏳" },
];

const getRandomLine = (lines: Commentary[]): Commentary => {
    return lines[Math.floor(Math.random() * lines.length)];
};

export type CommentaryType =
    | 'attack'
    | 'defense'
    | 'skip'
    | 'win'
    | 'lose'
    | 'wild'
    | 'swap'
    | 'peek'
    | 'draw'
    | 'almost_win';

export const getCommentary = (type: CommentaryType): Commentary => {
    switch (type) {
        case 'attack': return getRandomLine(ATTACK_LINES);
        case 'defense': return getRandomLine(DEFENSE_LINES);
        case 'skip': return getRandomLine(SKIP_LINES);
        case 'win': return getRandomLine(WIN_LINES);
        case 'lose': return getRandomLine(LOSE_LINES);
        case 'wild': return getRandomLine(WILD_LINES);
        case 'swap': return getRandomLine(SWAP_LINES);
        case 'peek': return getRandomLine(PEEK_LINES);
        case 'draw': return getRandomLine(DRAW_LINES);
        case 'almost_win': return getRandomLine(ALMOST_WIN_LINES);
        default: return { text: "...", emoji: "🤔" };
    }
};

// Determine what type of commentary to show based on game action
export const getCommentaryForAction = (
    action: string,
    isWinning: boolean,
    cardCount: number
): CommentaryType | null => {
    if (action.includes('+2') || action.includes('+5') || action.includes('MEGA')) {
        return 'attack';
    }
    if (action.includes('SKIP')) {
        return 'skip';
    }
    if (action.includes('WILD') || action.includes('Changed suit')) {
        return 'wild';
    }
    if (action.includes('SWAP') || action.includes('swapped')) {
        return 'swap';
    }
    if (action.includes('PEEK') || action.includes('Saw')) {
        return 'peek';
    }
    if (action.includes('drew') || action.includes('pick up')) {
        return 'draw';
    }
    if (action.includes('wins')) {
        return isWinning ? 'win' : 'lose';
    }
    if (cardCount <= 2) {
        return 'almost_win';
    }
    return null; // No commentary for regular plays
};
