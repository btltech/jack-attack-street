// core/diceEngine.ts - Street Dice rules and daily rolls. Pure and deterministic, so the browser plays
// it and the Worker replays a submitted game to check the score (see worker/src/index.ts).
//
// The game: 5 rounds. In a round you roll two dice and add the roll to your pot, as many times as you
// dare. Bank to keep the pot. Any die showing a 1 busts the round and the pot is lost. Doubles (2-6) score
// double. Everyone gets the same rolls on a given day: round r, roll k is fixed, so the whole game is
// "how long do you push your luck?".

export const ROUNDS = 5;
/** A round that survives this many rolls is banked automatically (a "hot streak"). */
export const MAX_ROLLS = 12;

export interface Roll {
  a: number;
  b: number;
}

export interface RoundChoice {
  /** How many rolls were taken this round (1..MAX_ROLLS). */
  n: number;
  /** True if the player banked (or hit the roll limit); false if the last roll busted. */
  banked: boolean;
}

export interface RoundResult extends RoundChoice {
  /** Points scored (0 when busted). */
  score: number;
  busted: boolean;
  /** The most that was possible this round with perfect hindsight. */
  best: number;
}

// ---- seeded randomness ----

const hashString = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** The seed for a UTC day's daily game ("2026-11-24"). */
export const dailySeedKey = (day: string): string => `street-dice-${day}`;

/** All the rolls round `round` (0-based) can show, in order, for a seed. */
export const rollsForRound = (seedKey: string, round: number): Roll[] => {
  const rnd = mulberry32(hashString(`${seedKey}:round:${round}`));
  const die = () => 1 + Math.floor(rnd() * 6);
  return Array.from({ length: MAX_ROLLS }, () => ({ a: die(), b: die() }));
};

// ---- scoring ----

export const isBust = (r: Roll): boolean => r.a === 1 || r.b === 1;

/** Points a surviving roll adds to the pot: the sum, doubled on doubles. */
export const rollValue = (r: Roll): number => (r.a + r.b) * (r.a === r.b ? 2 : 1);

/** The most a round can score: the biggest pot you could have banked before the first bust. */
export const bestForRound = (rolls: Roll[]): number => {
  let pot = 0;
  let best = 0;
  for (const r of rolls.slice(0, MAX_ROLLS)) {
    if (isBust(r)) break;
    pot += rollValue(r);
    best = Math.max(best, pot);
  }
  return best;
};

/** Replay one round's choice. Returns null if the choice is impossible for these rolls. */
export const resolveRound = (rolls: Roll[], choice: RoundChoice): RoundResult | null => {
  const { n, banked } = choice;
  if (!Number.isInteger(n) || n < 1 || n > MAX_ROLLS || typeof banked !== 'boolean') return null;
  let pot = 0;
  for (let k = 0; k < n; k++) {
    const r = rolls[k];
    if (!r) return null;
    if (isBust(r)) {
      // A bust ends the round immediately, so it can only be the last roll taken.
      if (k !== n - 1 || banked) return null;
      return { n, banked: false, score: 0, busted: true, best: bestForRound(rolls) };
    }
    pot += rollValue(r);
  }
  // Survived every roll: the round only ends by banking (or by reaching the roll limit).
  if (!banked) return null;
  return { n, banked: true, score: pot, busted: false, best: bestForRound(rolls) };
};

export interface RunResult {
  rounds: RoundResult[];
  score: number;
  best: number;
  totalRolls: number;
}

/** Replay a whole game. Returns null if any round is invalid. */
export const resolveRun = (seedKey: string, choices: RoundChoice[]): RunResult | null => {
  if (!Array.isArray(choices) || choices.length !== ROUNDS) return null;
  const rounds: RoundResult[] = [];
  for (let i = 0; i < ROUNDS; i++) {
    const res = resolveRound(rollsForRound(seedKey, i), choices[i]);
    if (!res) return null;
    rounds.push(res);
  }
  return {
    rounds,
    score: rounds.reduce((s, r) => s + r.score, 0),
    best: rounds.reduce((s, r) => s + r.best, 0),
    totalRolls: rounds.reduce((s, r) => s + r.n, 0),
  };
};

/** Wordle-style, spoiler-free summary of a run: one row per round. */
export const shareRows = (rounds: RoundResult[]): string =>
  rounds.map((r) => (r.busted ? '🎲'.repeat(r.n - 1) + '💥' : '🎲'.repeat(r.n) + '🏦')).join('\n');
