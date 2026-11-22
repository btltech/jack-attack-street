// ayo-app/engine.ts - Authentic Ayò Ọlọ́pọ́n (Yorùbá Mancala) game engine + Alpha-Beta AI + Endgame Challenges

export type AyoPlayer = 0 | 1; // 0 = South (Ìsàlẹ̀ / Bottom, pits 0..5), 1 = North (Òkè / Top, pits 6..11)
export type AyoDifficulty = 'easy' | 'medium' | 'hard';
export type AyoRuleSet = 'oware' | 'four_seed';

export interface AyoState {
  pits: number[];          // length 12: 0..5 belong to Player 0 (South), 6..11 belong to Player 1 (North)
  scores: [number, number];
  turn: AyoPlayer;
  winner: AyoPlayer | 'draw' | null;
  lastAction: string;
  lastMovePit: number | null;
  ruleSet: AyoRuleSet;
  moveCount: number;
}

export interface SowStep {
  pits: number[];
  scores: [number, number];
  activePit: number;
  capturedPits?: number[];
  capturedCount?: number;
}

export interface AIOpponent {
  id: string;
  name: string;
  title: string;
  avatar: string;
  difficulty: AyoDifficulty;
  depth: number;
  proverb: string;
}

export const AI_OPPONENTS: AIOpponent[] = [
  {
    id: 'abija',
    name: 'Abija',
    title: 'Village Challenger',
    avatar: '🥁',
    difficulty: 'easy',
    depth: 2,
    proverb: '“Pẹ̀lẹ́-pẹ̀lẹ́ ni a fi ń gba ayò.” — Patience wins the Ayò board.',
  },
  {
    id: 'fadeyi',
    name: 'Fadeyi',
    title: 'Market Tactician',
    avatar: '🦁',
    difficulty: 'medium',
    depth: 4,
    proverb: '“Ọgbọ́n ju agbára lọ.” — Wisdom is greater than brute strength.',
  },
  {
    id: 'orishabunmi',
    name: 'Orishabunmi',
    title: 'Grandmaster of the Ọpọ́n',
    avatar: '👑',
    difficulty: 'hard',
    depth: 6,
    proverb: '“Ẹni tí ó bá rí ọ̀la ni yóò jẹ ayò.” — Who sees tomorrow wins the board.',
  },
];

export interface SeedSkin {
  id: string;
  name: string;
  emoji: string;
  gradient: string;
  border: string;
  unlockLevel: number;
}

export const SEED_SKINS: SeedSkin[] = [
  { id: 'classic', name: 'Classic Ayò', emoji: '🪨', gradient: 'radial-gradient(circle at 32% 30%, #e5e7eb, #9ca3af 55%, #4b5563)', border: '#374151', unlockLevel: 1 },
  { id: 'cowrie', name: 'Golden Cowrie', emoji: '🐚', gradient: 'radial-gradient(circle at 32% 30%, #fef3c7, #f59e0b 60%, #92400e)', border: '#78350f', unlockLevel: 1 },
  { id: 'jade', name: 'Emerald Jade', emoji: '💚', gradient: 'radial-gradient(circle at 32% 30%, #a7f3d0, #10b981 58%, #065f46)', border: '#064e3b', unlockLevel: 2 },
  { id: 'coral', name: 'Royal Coral', emoji: '🔴', gradient: 'radial-gradient(circle at 32% 30%, #fecdd3, #e11d48 58%, #881337)', border: '#4c0519', unlockLevel: 3 },
  { id: 'obsidian', name: 'Obsidian Pearl', emoji: '🔮', gradient: 'radial-gradient(circle at 32% 30%, #c4b5fd, #6d28d9 55%, #1e1b4b)', border: '#0f172a', unlockLevel: 5 },
];

export interface AyoChallenge {
  id: string;
  title: string;
  subtitle: string;
  pits: number[];
  scores: [number, number];
  goal: string;
  difficulty: AyoDifficulty;
}

export const AYO_CHALLENGES: AyoChallenge[] = [
  {
    id: 'chain-sweep',
    title: 'The Triple Sweep',
    subtitle: 'Spot the pit that triggers a 3-pit chain capture!',
    pits: [1, 2, 0, 5, 2, 1, 2, 2, 1, 0, 3, 1],
    scores: [14, 14],
    goal: 'Capture the chain and reach 25+ seeds first.',
    difficulty: 'easy',
  },
  {
    id: 'kroo-awakening',
    title: 'Kroo Awakening',
    subtitle: 'You built a 12-seed Kroo pit. Unleash it wisely!',
    pits: [0, 1, 12, 1, 2, 0, 2, 1, 2, 1, 2, 2],
    scores: [11, 11],
    goal: 'Sweep around the board and outscore Fadeyi.',
    difficulty: 'medium',
  },
  {
    id: 'endgame-duel',
    title: 'Final Seeds Duel',
    subtitle: 'Every single seed counts in this tense endgame.',
    pits: [0, 2, 0, 1, 2, 1, 1, 2, 1, 0, 2, 0],
    scores: [18, 18],
    goal: 'Outcalculate Orishabunmi to claim 25 seeds.',
    difficulty: 'hard',
  },
];

export const createAyoGame = (
  ruleSet: AyoRuleSet = 'oware',
  customPits?: number[],
  customScores?: [number, number]
): AyoState => ({
  pits: customPits ? [...customPits] : Array(12).fill(4),
  scores: customScores ? [customScores[0], customScores[1]] : [0, 0],
  turn: 0,
  winner: null,
  lastAction: 'Your turn! Tap any pit on your row to sow counter-clockwise.',
  lastMovePit: null,
  ruleSet,
  moveCount: 0,
});

export const isOwnPit = (pit: number, player: AyoPlayer): boolean =>
  player === 0 ? pit >= 0 && pit <= 5 : pit >= 6 && pit <= 11;

export const sideSum = (pits: number[], player: AyoPlayer): number => {
  const start = player === 0 ? 0 : 6;
  let sum = 0;
  for (let i = start; i < start + 6; i++) sum += pits[i];
  return sum;
};

const wouldFeedOpponent = (pits: number[], pit: number, player: AyoPlayer): boolean => {
  const seeds = pits[pit];
  if (seeds === 0) return false;
  const opp: AyoPlayer = player === 0 ? 1 : 0;
  let idx = pit;
  for (let s = 0; s < seeds; s++) {
    idx = (idx + 1) % 12;
    if (idx === pit) idx = (idx + 1) % 12;
    if (isOwnPit(idx, opp)) return true;
  }
  return false;
};

export const getLegalMoves = (state: AyoState): number[] => {
  if (state.winner !== null) return [];
  const start = state.turn === 0 ? 0 : 6;
  const opp: AyoPlayer = state.turn === 0 ? 1 : 0;
  const oppHasSeeds = sideSum(state.pits, opp) > 0;

  const nonEmpty: number[] = [];
  for (let i = start; i < start + 6; i++) {
    if (state.pits[i] > 0) nonEmpty.push(i);
  }
  if (oppHasSeeds) return nonEmpty;

  // Golden Rule: if opponent has 0 seeds, must feed them if possible
  const feeding = nonEmpty.filter((p) => wouldFeedOpponent(state.pits, p, state.turn));
  return feeding.length > 0 ? feeding : nonEmpty;
};

export const applyAyoMove = (
  state: AyoState,
  pit: number,
  playerNames: [string, string] = ['You', 'Opponent']
): { nextState: AyoState; steps: SowStep[]; captured: number } => {
  const legal = getLegalMoves(state);
  if (!legal.includes(pit)) {
    return { nextState: state, steps: [], captured: 0 };
  }

  const pits = [...state.pits];
  const scores: [number, number] = [state.scores[0], state.scores[1]];
  const player = state.turn;
  const opp: AyoPlayer = player === 0 ? 1 : 0;
  const steps: SowStep[] = [];

  let seeds = pits[pit];
  pits[pit] = 0;
  let idx = pit;
  let capturedTotal = 0;

  // Sow counter-clockwise, skipping origin pit on full lap
  while (seeds > 0) {
    idx = (idx + 1) % 12;
    if (idx === pit) idx = (idx + 1) % 12;
    pits[idx]++;
    seeds--;

    // Traditional 4-seed Yorùbá Ayò rule: any pit reaching 4 during sowing is captured!
    if (state.ruleSet === 'four_seed' && pits[idx] === 4) {
      const owner: AyoPlayer = isOwnPit(idx, player) ? player : opp;
      const recipient: AyoPlayer = seeds === 0 ? player : owner;
      scores[recipient] += 4;
      if (recipient === player) capturedTotal += 4;
      pits[idx] = 0;
      steps.push({
        pits: [...pits],
        scores: [scores[0], scores[1]],
        activePit: idx,
        capturedPits: [idx],
        capturedCount: 4,
      });
    } else {
      steps.push({
        pits: [...pits],
        scores: [scores[0], scores[1]],
        activePit: idx,
      });
    }
  }

  // Oware / Classic 2-or-3 Capture on opponent's row (with Grand Slam protection)
  if (state.ruleSet === 'oware' && isOwnPit(idx, opp)) {
    const testPits = [...pits];
    const capPits: number[] = [];
    let capSum = 0;
    let cur = idx;

    while (isOwnPit(cur, opp) && (testPits[cur] === 2 || testPits[cur] === 3)) {
      capSum += testPits[cur];
      capPits.push(cur);
      testPits[cur] = 0;
      cur = (cur + 11) % 12;
    }

    // Grand Slam protection: only capture if opponent still has seeds OR no seeds left on board
    const oppRemainingAfterCap = sideSum(testPits, opp);
    if (capSum > 0 && (oppRemainingAfterCap > 0 || sideSum(testPits, player) === 0)) {
      for (const cp of capPits) pits[cp] = 0;
      scores[player] += capSum;
      capturedTotal += capSum;
      steps.push({
        pits: [...pits],
        scores: [scores[0], scores[1]],
        activePit: idx,
        capturedPits: capPits,
        capturedCount: capSum,
      });
    }
  }

  const nextTurn: AyoPlayer = opp;
  let winner: AyoPlayer | 'draw' | null = null;
  let lastAction = capturedTotal > 0
    ? `🔥 ${playerNames[player]} captured ${capturedTotal} seed${capturedTotal === 1 ? '' : 's'}!`
    : `${playerNames[player]} sowed from pit ${(pit % 6) + 1}`;

  // Check win by 25+ seeds
  if (scores[0] >= 25) {
    winner = 0;
  } else if (scores[1] >= 25) {
    winner = 1;
  } else {
    // Check if next player has no legal moves (collect remaining seeds)
    const probe: AyoState = {
      ...state,
      pits,
      scores,
      turn: nextTurn,
      winner: null,
    };
    const nextLegal = getLegalMoves(probe);
    const totalOnBoard = sideSum(pits, 0) + sideSum(pits, 1);

    if (nextLegal.length === 0 || totalOnBoard === 0 || (state.ruleSet === 'four_seed' && totalOnBoard <= 4)) {
      scores[0] += sideSum(pits, 0);
      scores[1] += sideSum(pits, 1);
      for (let i = 0; i < 12; i++) pits[i] = 0;
      if (scores[0] > scores[1]) winner = 0;
      else if (scores[1] > scores[0]) winner = 1;
      else winner = 'draw';
    }
  }

  if (winner === 0) lastAction = `🏆 ${playerNames[0]} wins ${scores[0]} – ${scores[1]}!`;
  else if (winner === 1) lastAction = `🏆 ${playerNames[1]} wins ${scores[1]} – ${scores[0]}!`;
  else if (winner === 'draw') lastAction = `🤝 A noble draw — 24 to 24!`;

  const nextState: AyoState = {
    pits,
    scores,
    turn: nextTurn,
    winner,
    lastAction,
    lastMovePit: pit,
    ruleSet: state.ruleSet,
    moveCount: state.moveCount + 1,
  };

  return { nextState, steps, captured: capturedTotal };
};

// --- ALPHA-BETA MINIMAX AI ---

const evaluateState = (state: AyoState, aiPlayer: AyoPlayer): number => {
  const human: AyoPlayer = aiPlayer === 0 ? 1 : 0;
  if (state.winner === aiPlayer) return 10000;
  if (state.winner === human) return -10000;
  if (state.winner === 'draw') return 0;

  const scoreDiff = (state.scores[aiPlayer] - state.scores[human]) * 18;
  const seedDiff = (sideSum(state.pits, aiPlayer) - sideSum(state.pits, human)) * 2;

  // Penalize vulnerable pits (1 or 2 seeds) on AI side in Oware
  let vulnerability = 0;
  const aiStart = aiPlayer === 0 ? 0 : 6;
  for (let i = aiStart; i < aiStart + 6; i++) {
    if (state.pits[i] === 1 || state.pits[i] === 2) vulnerability -= 2;
    if (state.pits[i] >= 12) vulnerability += 3; // Kroo bonus
  }

  return scoreDiff + seedDiff + vulnerability;
};

const minimax = (
  state: AyoState,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  aiPlayer: AyoPlayer
): number => {
  if (depth === 0 || state.winner !== null) {
    return evaluateState(state, aiPlayer);
  }
  const moves = getLegalMoves(state);
  if (moves.length === 0) return evaluateState(state, aiPlayer);

  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      const { nextState } = applyAyoMove(state, m);
      const val = minimax(nextState, depth - 1, alpha, beta, false, aiPlayer);
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      const { nextState } = applyAyoMove(state, m);
      const val = minimax(nextState, depth - 1, alpha, beta, true, aiPlayer);
      if (val < best) best = val;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
};

export const chooseAyoAIMove = (state: AyoState, difficulty: AyoDifficulty): number | null => {
  const moves = getLegalMoves(state);
  if (moves.length === 0) return null;

  // Easy AI makes occasional human-like relaxed choices
  if (difficulty === 'easy' && Math.random() < 0.25) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const depth = difficulty === 'hard' ? 5 : difficulty === 'medium' ? 3 : 2;
  const aiPlayer = state.turn;
  let bestMove = moves[0];
  let bestVal = -Infinity;

  for (const m of moves) {
    const { nextState } = applyAyoMove(state, m);
    const val = minimax(nextState, depth - 1, -Infinity, Infinity, false, aiPlayer);
    if (val > bestVal) {
      bestVal = val;
      bestMove = m;
    }
  }
  return bestMove;
};
