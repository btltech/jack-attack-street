// core/game.ts
import { Card, Suit, Rank, Player, GameState, Difficulty, GameMode } from './types';

// --- HELPER FUNCTIONS ---

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  const suits = Object.values(Suit);
  const ranks = Object.values(Rank);

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        id: `${suit}-${rank}`,
        suit: suit,
        rank: rank,
      });
    }
  }
  return deck;
};

export const shuffleDeck = (deck: Card[]): Card[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

const getSuitValue = (suit: Suit): number => {
  switch (suit) {
    case Suit.Hearts: return 1;
    case Suit.Diamonds: return 2;
    case Suit.Clubs: return 3;
    case Suit.Spades: return 4;
  }
};

const getRankValue = (rank: Rank): number => {
  const values: Record<Rank, number> = {
    [Rank.Two]: 2, [Rank.Three]: 3, [Rank.Four]: 4, [Rank.Five]: 5,
    [Rank.Six]: 6, [Rank.Seven]: 7, [Rank.Eight]: 8, [Rank.Nine]: 9,
    [Rank.Ten]: 10, [Rank.Jack]: 11, [Rank.Queen]: 12, [Rank.King]: 13,
    [Rank.Ace]: 14
  };
  return values[rank];
};

export const sortHand = (hand: Card[]): Card[] => {
  return [...hand].sort((a, b) => {
    if (a.suit !== b.suit) {
      return getSuitValue(a.suit) - getSuitValue(b.suit);
    }
    return getRankValue(a.rank) - getRankValue(b.rank);
  });
};

const isBlackJack = (card: Card): boolean => {
  return card.rank === Rank.Jack && (card.suit === Suit.Spades || card.suit === Suit.Clubs);
};

const isTwo = (card: Card): boolean => {
  return card.rank === Rank.Two;
};

// --- TURN MANAGEMENT ---

const advanceTurn = (state: GameState, steps: number = 1) => {
  const numPlayers = state.players.length;
  let nextIndex = state.currentPlayerIndex + (state.direction * steps);
  nextIndex = ((nextIndex % numPlayers) + numPlayers) % numPlayers;
  state.currentPlayerIndex = nextIndex;
};

// --- GAME ACTIONS ---

const BOT_AVATARS = ['🐯', '🐼', '🦊', '🐨', '🦁', '🐸', '🦄', '🐙'];
const HUMAN_AVATAR = '😎';

export const createNewGame = (
  numPlayers: number = 4,
  difficulty: Difficulty = Difficulty.Medium,
  gameMode: GameMode = GameMode.VsBot,
  playerNames?: string[]
): GameState => {
  if (numPlayers < 2) numPlayers = 2;
  if (numPlayers > 4) numPlayers = 4;

  let deck = createDeck();
  deck = shuffleDeck(deck);

  const players: Player[] = [];
  const handSize = 7;

  // Shuffle avatars for this game
  const shuffledAvatars = [...BOT_AVATARS].sort(() => Math.random() - 0.5);

  for (let i = 0; i < numPlayers; i++) {
    // In local multiplayer, all players are human
    const isBot = gameMode === GameMode.VsBot ? i > 0 : false;
    let hand = deck.splice(0, handSize);

    // Sort hand for first player (or all players in local multiplayer)
    if (i === 0 || gameMode === GameMode.LocalMultiplayer) {
      hand = sortHand(hand);
    }

    const defaultName = isBot ? `Bot ${i}` : (i === 0 ? 'You' : `Player ${i + 1}`);

    players.push({
      id: isBot ? `bot-${i}` : `player-${i}`,
      name: playerNames?.[i] || defaultName,
      avatar: isBot ? shuffledAvatars[i] : (i === 0 ? HUMAN_AVATAR : shuffledAvatars[i]),
      isBot,
      hand,
    });
  }

  const startCard = deck.pop();
  if (!startCard) throw new Error("Deck error");

  const discardPile = [startCard];

  return {
    deck,
    discardPile,
    players,
    currentPlayerIndex: 0,
    direction: 1,
    winnerId: null,
    pendingPickup: 0,
    lastAction: "Game Started! Have fun!",
    difficulty,
    gameMode,

    // Power-up states
    pendingSuitChoice: false,
    chosenSuit: null,
    peekingCard: null,
    peekingPlayerId: null,
    pendingSwap: false,

    // Tournament
    tournamentConfig: null,

    // Local multiplayer
    showPassScreen: gameMode === GameMode.LocalMultiplayer,
    nextPlayerName: players[0]?.name || '',

    // Undo support
    previousState: null,
    canUndo: false,
  };
};

export const isValidMove = (card: Card, topDiscard: Card, pendingPickup: number): boolean => {
  if (pendingPickup > 0) {
    // If facing a penalty, must play rank match (defend/stack)
    return card.rank === topDiscard.rank;
  }
  return card.suit === topDiscard.suit || card.rank === topDiscard.rank;
};

const cloneState = (state: GameState): GameState => {
  return {
    ...state,
    deck: [...state.deck],
    discardPile: [...state.discardPile],
    players: state.players.map(p => ({ ...p, hand: [...p.hand] })),
  };
};

export const playCard = (currentState: GameState, cardId: string): GameState => {
  if (currentState.winnerId) return currentState;

  const state = cloneState(currentState);
  const player = state.players[state.currentPlayerIndex];

  const cardIndex = player.hand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) return currentState;

  const card = player.hand[cardIndex];

  player.hand.splice(cardIndex, 1);
  state.discardPile.push(card);

  let actionText = `${player.name} played ${card.rank}${card.suit}`;

  // WIN CONDITION
  if (player.hand.length === 0) {
    state.winnerId = player.id;
    state.lastAction = `${player.name} wins! 🎉`;
    return state;
  }

  // --- SPECIAL CARD EFFECTS ---
  let stepsToAdvance = 1;

  if (isTwo(card)) {
    state.pendingPickup += 2;
    actionText = "💥 +2 Cards Attack!";
  } else if (isBlackJack(card)) {
    state.pendingPickup += 5;
    actionText = "🔥 +5 Cards MEGA Attack!";
  } else if (card.rank === Rank.Eight) {
    actionText = "🚫 SKIP!";
    if (state.players.length === 2) {
      stepsToAdvance = 0;
    } else {
      stepsToAdvance = 2;
    }
  } else if (card.rank === Rank.Ace) {
    actionText = "↩️ Reverse!";
    if (state.players.length === 2) {
      stepsToAdvance = 0;
    } else {
      state.direction *= -1;
    }
  } else if (card.rank === Rank.Queen) {
    // QUEEN = WILD CARD - Choose next suit
    state.pendingSuitChoice = true;
    actionText = "👑 WILD! Choose a suit!";
    // Don't advance turn yet - wait for suit choice
    stepsToAdvance = 0;
  } else if (card.rank === Rank.King) {
    // KING = SWAP HANDS
    if (state.players.length > 2) {
      // In 3+ player games, player chooses who to swap with
      state.pendingSwap = true;
      actionText = "🤴 SWAP! Choose a player!";
      stepsToAdvance = 0;
    } else {
      // In 2-player games, auto-swap
      const otherPlayer = state.players.find(p => p.id !== player.id);
      if (otherPlayer) {
        const tempHand = [...player.hand];
        player.hand = [...otherPlayer.hand];
        otherPlayer.hand = tempHand;
        actionText = "🤴 SWAP! Hands exchanged!";
      }
    }
  } else if (card.rank === Rank.Seven) {
    // SEVEN = PEEK - See one of opponent's cards
    const opponents = state.players.filter(p => p.id !== player.id && p.hand.length > 0);
    if (opponents.length > 0) {
      const randomOpponent = opponents[Math.floor(Math.random() * opponents.length)];
      const randomCardIndex = Math.floor(Math.random() * randomOpponent.hand.length);
      state.peekingCard = randomOpponent.hand[randomCardIndex];
      state.peekingPlayerId = randomOpponent.id;
      actionText = `👁️ PEEK! Saw ${randomOpponent.name}'s card!`;
    }
  }

  state.lastAction = actionText;

  if (stepsToAdvance > 0) {
    advanceTurn(state, stepsToAdvance);
  }

  return state;
};

export const drawCard = (currentState: GameState): GameState => {
  if (currentState.winnerId) return currentState;

  const state = cloneState(currentState);
  const player = state.players[state.currentPlayerIndex];

  // If there's a penalty (pendingPickup > 0), they draw that many.
  // Otherwise, they draw 1 normal card.
  const countToDraw = state.pendingPickup > 0 ? state.pendingPickup : 1;
  let actuallyDrawn = 0;

  for (let i = 0; i < countToDraw; i++) {
    // 1. Refill deck from discard if empty
    if (state.deck.length === 0) {
      if (state.discardPile.length > 1) {
        // Keep topCard
        const topCard = state.discardPile.pop()!;
        // The rest becomes the new deck
        const newDeck = state.discardPile;
        // Reset discard pile
        state.discardPile = [topCard];
        // Shuffle new deck
        state.deck = shuffleDeck(newDeck);
      } else {
        // No cards left to draw anywhere
        break;
      }
    }

    // 2. Draw card
    const newCard = state.deck.pop();
    if (newCard) {
      player.hand.push(newCard);
      actuallyDrawn++;
    }
  }

  if (!player.isBot) {
    player.hand = sortHand(player.hand);
  }

  // 3. Update Status
  if (state.pendingPickup > 0) {
    state.lastAction = `${player.name} had to pick up ${actuallyDrawn}! 😅`;
  } else {
    state.lastAction = `${player.name} drew a card`;
  }

  // 4. Clear penalty and advance turn
  state.pendingPickup = 0;
  advanceTurn(state, 1);

  return state;
};

// --- BOT DECISION LOGIC ---

export const getBotDecision = (state: GameState): { action: 'play' | 'draw', cardId?: string } => {
  const bot = state.players[state.currentPlayerIndex];
  const topCard = state.discardPile[state.discardPile.length - 1];
  const pending = state.pendingPickup;
  const difficulty = state.difficulty;

  // 1. Get all legal moves
  const validMoves = bot.hand.filter(card => isValidMove(card, topCard, pending));

  // If we can't play, we must draw
  if (validMoves.length === 0) {
    return { action: 'draw' };
  }

  // --- EASY MODE: Random play with occasional "mistakes" ---
  if (difficulty === Difficulty.Easy) {
    // 30% chance to just draw even if they could play (simulates mistakes)
    if (pending === 0 && Math.random() < 0.3) {
      return { action: 'draw' };
    }
    // Pick a random valid card
    const randomIndex = Math.floor(Math.random() * validMoves.length);
    return { action: 'play', cardId: validMoves[randomIndex].id };
  }

  // --- HARD MODE: Strategic play ---
  if (difficulty === Difficulty.Hard) {
    // Count cards in human's hand
    const humanPlayer = state.players.find(p => !p.isBot);
    const humanHandSize = humanPlayer?.hand.length || 7;

    // If human is close to winning (3 or fewer cards), prioritize attack cards
    const shouldAttack = humanHandSize <= 3;

    // Analyze hand
    const suitCounts: Record<string, number> = {};
    for (const card of bot.hand) {
      suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    }

    validMoves.sort((a, b) => {
      const isAttackA = isTwo(a) || isBlackJack(a);
      const isAttackB = isTwo(b) || isBlackJack(b);

      if (shouldAttack) {
        // Prioritize attacks when human is winning
        if (isAttackA && !isAttackB) return -1;
        if (!isAttackA && isAttackB) return 1;
      } else {
        // SAVE attack cards for later - deprioritize them
        if (isAttackA && !isAttackB) return 1;
        if (!isAttackA && isAttackB) return -1;
      }

      // Play cards from suits we have fewer of (harder to match later)
      const countA = suitCounts[a.suit] || 0;
      const countB = suitCounts[b.suit] || 0;
      return countA - countB; // Play from smaller suits first
    });

    return { action: 'play', cardId: validMoves[0].id };
  }

  // --- MEDIUM MODE (default): Balanced play ---
  // Analyze Hand: Count how many of each suit we have.
  const suitCounts: Record<string, number> = {};
  for (const card of bot.hand) {
    suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
  }

  // Score the moves to find the best one
  validMoves.sort((a, b) => {
    // Prioritize attack cards
    const isAttackA = isTwo(a) || isBlackJack(a);
    const isAttackB = isTwo(b) || isBlackJack(b);
    if (isAttackA && !isAttackB) return -1;
    if (!isAttackA && isAttackB) return 1;

    // Shed suits we have many of
    const countA = suitCounts[a.suit] || 0;
    const countB = suitCounts[b.suit] || 0;
    return countB - countA;
  });

  return { action: 'play', cardId: validMoves[0].id };
};

export const performBotTurn = (currentState: GameState): GameState => {
  if (currentState.winnerId) return currentState;
  const decision = getBotDecision(currentState);

  if (decision.action === 'play' && decision.cardId) {
    return playCard(currentState, decision.cardId);
  } else {
    return drawCard(currentState);
  }
};

// --- POWER-UP CARD ACTIONS ---

// Queen: Choose the new suit
export const chooseSuit = (currentState: GameState, suit: Suit): GameState => {
  if (!currentState.pendingSuitChoice) return currentState;

  const state = cloneState(currentState);
  state.chosenSuit = suit;
  state.pendingSuitChoice = false;
  state.lastAction = `👑 Changed suit to ${suit}!`;

  // Now advance turn
  advanceTurn(state, 1);

  return state;
};

// King: Swap hands with chosen player
export const swapWith = (currentState: GameState, targetPlayerId: string): GameState => {
  if (!currentState.pendingSwap) return currentState;

  const state = cloneState(currentState);
  const currentPlayer = state.players[state.currentPlayerIndex];
  const targetPlayer = state.players.find(p => p.id === targetPlayerId);

  if (!targetPlayer) return currentState;

  // Swap hands
  const tempHand = [...currentPlayer.hand];
  currentPlayer.hand = [...targetPlayer.hand];
  targetPlayer.hand = tempHand;

  state.pendingSwap = false;
  state.lastAction = `🤴 ${currentPlayer.name} swapped with ${targetPlayer.name}!`;

  // Advance turn
  advanceTurn(state, 1);

  return state;
};

// Clear the peek state (after showing for a few seconds)
export const clearPeek = (currentState: GameState): GameState => {
  const state = cloneState(currentState);
  state.peekingCard = null;
  state.peekingPlayerId = null;
  return state;
};

// Clear pass screen for local multiplayer
export const confirmPassScreen = (currentState: GameState): GameState => {
  const state = cloneState(currentState);
  state.showPassScreen = false;
  return state;
};

// Show pass screen (after turn ends in local multiplayer)
export const triggerPassScreen = (currentState: GameState): GameState => {
  const state = cloneState(currentState);
  const nextPlayer = state.players[state.currentPlayerIndex];
  state.showPassScreen = true;
  state.nextPlayerName = nextPlayer.name;
  return state;
};

// Bot makes suit choice (for Queen)
export const botChooseSuit = (currentState: GameState): GameState => {
  const bot = currentState.players[currentState.currentPlayerIndex];

  // Bot chooses the suit they have the most of
  const suitCounts: Record<string, number> = {};
  for (const card of bot.hand) {
    suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
  }

  let bestSuit = Suit.Hearts;
  let maxCount = 0;
  for (const [suit, count] of Object.entries(suitCounts)) {
    if (count > maxCount) {
      maxCount = count;
      bestSuit = suit as Suit;
    }
  }

  return chooseSuit(currentState, bestSuit);
};

// Bot makes swap choice (for King)
export const botChooseSwap = (currentState: GameState): GameState => {
  const bot = currentState.players[currentState.currentPlayerIndex];

  // Bot swaps with the player who has the fewest cards
  const others = currentState.players.filter(p => p.id !== bot.id);
  const target = others.reduce((min, p) => p.hand.length < min.hand.length ? p : min, others[0]);

  return swapWith(currentState, target.id);
};

// --- UNDO FUNCTIONALITY ---

// Store state before a player action (call this before playCard or drawCard for human players)
export const saveStateForUndo = (currentState: GameState): GameState => {
  const state = cloneState(currentState);
  // Don't chain previous states - only keep one level of undo
  state.previousState = { ...cloneState(currentState), previousState: null, canUndo: false };
  state.canUndo = true;
  return state;
};

// Undo the last player action
export const undoLastMove = (currentState: GameState): GameState | null => {
  if (!currentState.canUndo || !currentState.previousState) {
    return null;
  }

  // Return the previous state with undo disabled
  const restoredState = cloneState(currentState.previousState);
  restoredState.canUndo = false;
  restoredState.previousState = null;
  restoredState.lastAction = "↩️ Move undone!";

  return restoredState;
};