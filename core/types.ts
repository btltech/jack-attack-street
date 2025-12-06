// core/types.ts

// 1. Define Difficulty Levels
export enum Difficulty {
  Easy = 'easy',
  Medium = 'medium',
  Hard = 'hard',
}

// 2. Define the Suits
export enum Suit {
  Hearts = '♥',
  Diamonds = '♦',
  Clubs = '♣',
  Spades = '♠',
}

// 2. Define the Ranks
export enum Rank {
  Two = '2',
  Three = '3',
  Four = '4',
  Five = '5',
  Six = '6',
  Seven = '7',
  Eight = '8',
  Nine = '9',
  Ten = '10',
  Jack = 'J',
  Queen = 'Q',
  King = 'K',
  Ace = 'A',
}

// 3. Define the Card model
export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

// 4. Define the Player
export interface Player {
  id: string;
  name: string;
  avatar: string; // New: Emoji avatar
  isBot: boolean;
  hand: Card[];
}

// 5. Define Game Modes
export enum GameMode {
  VsBot = 'vs_bot',
  LocalMultiplayer = 'local_multiplayer',
  Tournament = 'tournament',
}

// 6. Define Tournament Config
export interface TournamentConfig {
  totalRounds: number;  // Best of 3, 5, or 7
  currentRound: number;
  scores: Record<string, number>;  // playerId -> wins
}

// 7. Define the full Game State
export interface GameState {
  deck: Card[];
  discardPile: Card[];
  players: Player[];
  currentPlayerIndex: number;
  direction: 1 | -1; // 1 = Clockwise, -1 = Counter-Clockwise
  winnerId: string | null;
  pendingPickup: number;
  lastAction: string;
  difficulty: Difficulty;
  gameMode: GameMode;

  // Power-up card states
  pendingSuitChoice: boolean;      // Queen played - waiting for suit selection
  chosenSuit: Suit | null;         // The suit chosen after Queen
  peekingCard: Card | null;        // 7 played - showing one opponent card
  peekingPlayerId: string | null;  // The player whose card is being peeked
  pendingSwap: boolean;            // King played - waiting to choose player to swap with

  // Tournament mode
  tournamentConfig: TournamentConfig | null;

  // Local multiplayer - pass screen
  showPassScreen: boolean;
  nextPlayerName: string;

  // Undo support
  previousState: GameState | null;
  canUndo: boolean;
}