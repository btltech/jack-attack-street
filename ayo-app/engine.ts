// ayo-app/engine.ts - Ayò Ọlọ́pọ́n (Yorùbá Mancala) game engine: traditional Ayò, Street Ayò and Oware rule sets + Alpha-Beta AI + Endgame Challenges

export type AyoPlayer = 0 | 1; // 0 = South (Ìsàlẹ̀ / Bottom, pits 0..5), 1 = North (Òkè / Top, pits 6..11)
export type AyoDifficulty = 'easy' | 'medium' | 'hard';
// 'yoruba_ayo'  Traditional Ayò (Ayoayo): relay sowing, and a final seed that lands in an empty pit on
//               your own side captures the seeds in the pit opposite it.
// 'street_ayo'  House variant: relay sowing plus an instant capture whenever any pit reaches 4 seeds.
// 'oware'       Oware: single-lap sowing, capture runs of 2s and 3s on the opponent's row.
export type AyoRuleSet = 'yoruba_ayo' | 'street_ayo' | 'oware';

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
  seedsInHand: number;
  kind: 'drop' | 'scoop' | 'capture';
  capturedPits?: number[];
  capturedCount?: number;
  capturedBy?: AyoPlayer;
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
  /** Rule set to play this position under. Defaults to Oware for the hand-made puzzles. */
  ruleSet?: AyoRuleSet;
  /** True for the generated "daily Ayò" position, which everyone gets on the same UTC day. */
  daily?: boolean;
  day?: string;
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

// Hard cap on Oware / traditional Ayò game length (moves by both players) to end endless cycles.
const OWARE_MAX_MOVES = 400;

export const createAyoGame = (
  ruleSet: AyoRuleSet = 'yoruba_ayo',
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

  // Initial scoop step so the player sees the seeds lifted from the chosen pit
  steps.push({
    pits: [...pits],
    scores: [scores[0], scores[1]],
    activePit: pit,
    seedsInHand: seeds,
    kind: 'scoop',
  });

  if (state.ruleSet === 'street_ayo') {
    // STREET AYÒ (house variant): counter-clockwise relay sowing + instant 4-seed captures.
    let safety = 0;
    const MAX_STEPS = 160;
    while (seeds > 0 && safety < MAX_STEPS) {
      safety++;
      idx = (idx + 1) % 12;
      pits[idx]++;
      seeds--;

      // Rule: When a pit reaches 4 seeds during sowing:
      // - Mid-sow (seeds > 0): the owner of that pit captures the 4 seeds.
      // - Final seed (seeds === 0): the active player captures the 4 seeds and the turn ends!
      if (pits[idx] === 4) {
        const pitOwner: AyoPlayer = isOwnPit(idx, player) ? player : opp;
        const recipient: AyoPlayer = seeds === 0 ? player : pitOwner;
        scores[recipient] += 4;
        if (recipient === player) capturedTotal += 4;
        pits[idx] = 0;
        steps.push({
          pits: [...pits],
          scores: [scores[0], scores[1]],
          activePit: idx,
          seedsInHand: seeds,
          kind: 'capture',
          capturedPits: [idx],
          capturedCount: 4,
          capturedBy: recipient,
        });
        if (seeds === 0) break; // Final seed made 4 -> captured & turn ends
      } else {
        steps.push({
          pits: [...pits],
          scores: [scores[0], scores[1]],
          activePit: idx,
          seedsInHand: seeds,
          kind: 'drop',
        });

        // Relay sowing: if last seed lands in a non-empty pit (now > 1), scoop and keep going!
        if (seeds === 0) {
          if (pits[idx] > 1) {
            seeds = pits[idx];
            pits[idx] = 0;
            steps.push({
              pits: [...pits],
              scores: [scores[0], scores[1]],
              activePit: idx,
              seedsInHand: seeds,
              kind: 'scoop',
            });
          } else {
            // Landed in an empty pit (now 1) -> turn ends!
            break;
          }
        }
      }
    }

    // A relay that never settles (it hit MAX_STEPS) used to drop the seeds still in hand,
    // so the board no longer held 48 seeds. Award them to the sowing player instead.
    if (seeds > 0) {
      scores[player] += seeds;
      capturedTotal += seeds;
      seeds = 0;
      steps.push({
        pits: [...pits],
        scores: [scores[0], scores[1]],
        activePit: idx,
        seedsInHand: 0,
        kind: 'drop',
      });
    }
  } else if (state.ruleSet === 'yoruba_ayo') {
    // TRADITIONAL AYÒ (Ayoayo, as documented on Wikipedia and in John Pratt's mancala notes):
    //  - sow counter-clockwise, one seed per pit; the pit being sown from is skipped on every lap
    //  - relay: if the last seed lands in a pit that already had seeds, lift them all and keep sowing
    //  - the turn ends when the last seed lands in an empty pit; if that pit is on your own side and
    //    the pit opposite it holds seeds, you capture those seeds (the last seed itself stays put)
    let safety = 0;
    const MAX_STEPS = 400;
    let origin = pit;
    while (seeds > 0 && safety < MAX_STEPS) {
      safety++;
      idx = (idx + 1) % 12;
      if (idx === origin) idx = (idx + 1) % 12;
      pits[idx]++;
      seeds--;
      steps.push({
        pits: [...pits],
        scores: [scores[0], scores[1]],
        activePit: idx,
        seedsInHand: seeds,
        kind: 'drop',
      });

      if (seeds > 0) continue;

      if (pits[idx] > 1) {
        // Relay: lift everything from the pit we ended in and carry on
        seeds = pits[idx];
        pits[idx] = 0;
        origin = idx;
        steps.push({
          pits: [...pits],
          scores: [scores[0], scores[1]],
          activePit: idx,
          seedsInHand: seeds,
          kind: 'scoop',
        });
        continue;
      }

      // Landed in an empty pit: the turn ends, with a capture if it is on our own side
      if (isOwnPit(idx, player)) {
        const opposite = 11 - idx;
        if (pits[opposite] > 0) {
          const taken = pits[opposite];
          pits[opposite] = 0;
          scores[player] += taken;
          capturedTotal += taken;
          steps.push({
            pits: [...pits],
            scores: [scores[0], scores[1]],
            activePit: opposite,
            seedsInHand: 0,
            kind: 'capture',
            capturedPits: [opposite],
            capturedCount: taken,
            capturedBy: player,
          });
        }
      }
      break;
    }

    // A relay that never settles (hit MAX_STEPS): award the seeds still in hand to the sower
    // rather than letting them vanish from the board.
    if (seeds > 0) {
      scores[player] += seeds;
      capturedTotal += seeds;
      seeds = 0;
      steps.push({
        pits: [...pits],
        scores: [scores[0], scores[1]],
        activePit: idx,
        seedsInHand: 0,
        kind: 'drop',
      });
    }
  } else {
    // OWARE / CLASSIC 2-OR-3 CAPTURE VARIANT:
    // Single-lap sowing (skip origin pit if >= 12 seeds), capture 2s & 3s backward on opponent's row
    while (seeds > 0) {
      idx = (idx + 1) % 12;
      if (idx === pit) idx = (idx + 1) % 12;
      pits[idx]++;
      seeds--;
      steps.push({
        pits: [...pits],
        scores: [scores[0], scores[1]],
        activePit: idx,
        seedsInHand: seeds,
        kind: 'drop',
      });
    }

    if (isOwnPit(idx, opp)) {
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

      const oppRemainingAfterCap = sideSum(testPits, opp);
      if (capSum > 0 && (oppRemainingAfterCap > 0 || sideSum(testPits, player) === 0)) {
        for (const cp of capPits) pits[cp] = 0;
        scores[player] += capSum;
        capturedTotal += capSum;
        steps.push({
          pits: [...pits],
          scores: [scores[0], scores[1]],
          activePit: idx,
          seedsInHand: 0,
          kind: 'capture',
          capturedPits: capPits,
          capturedCount: capSum,
          capturedBy: player,
        });
      }
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

    // Oware and traditional Ayò can cycle forever; by convention a repeating endgame ends with each player
    // keeping the seeds on their own side, so cap the game length.
    const stalemate = state.ruleSet !== 'street_ayo' && state.moveCount + 1 >= OWARE_MAX_MOVES;

    if (nextLegal.length === 0 || totalOnBoard === 0 || stalemate || (state.ruleSet === 'street_ayo' && totalOnBoard <= 4) || (state.ruleSet === 'yoruba_ayo' && totalOnBoard <= 2)) {
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

// --- DAILY AYÒ ---
// Everyone gets the same position on the same UTC day: a few seeded random opening moves from the
// standard start, kept only if neither side is already clearly ahead. The player moves first.

const hashString = (str: string): number => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const seededRandom = (seed: string): (() => number) => {
  let a = hashString(seed) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const DAILY_OPENING_PLIES = 8; // even, so it is the player's turn again

export const createAyoDailyPuzzle = (day: string, dayNumber: number): AyoChallenge => {
  const ruleSet: AyoRuleSet = 'yoruba_ayo';
  let best: AyoState | null = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const rng = seededRandom(`ayo-daily-${day}-${attempt}`);
    let state = createAyoGame(ruleSet);
    for (let ply = 0; ply < DAILY_OPENING_PLIES && state.winner === null; ply++) {
      const legal = getLegalMoves(state);
      if (legal.length === 0) break;
      state = applyAyoMove(state, legal[Math.floor(rng() * legal.length)]).nextState;
    }
    if (state.winner !== null || state.turn !== 0 || getLegalMoves(state).length === 0) continue;
    const balanced = Math.abs(state.scores[0] - state.scores[1]) <= 4;
    if (balanced) { best = state; break; }
    if (!best) best = state;
  }
  const start = best ?? createAyoGame(ruleSet);
  return {
    id: `daily-${day}`,
    title: `Daily Ayò #${dayNumber}`,
    subtitle: 'The same opening position for every player today.',
    pits: [...start.pits],
    scores: [start.scores[0], start.scores[1]],
    goal: 'Beat Fadeyi from this position to keep your streak alive.',
    difficulty: 'medium',
    ruleSet,
    daily: true,
    day,
  };
};
