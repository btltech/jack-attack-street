// ayo-app/tutorialLessons.ts - Scripted positions for the first-run Ayò tutorial (traditional rules).

export interface Lesson {
  title: string;
  intro: string;
  pits: number[]; // 0..5 you (bottom row), 6..11 opponent (top row)
  /** The one pit the player is asked to play. */
  target: number;
  result: string;
}

// Each position was checked against the engine (see the comment above each lesson).
export const LESSONS: Lesson[] = [
  {
    // Pit 1 has 3 seeds: drops in 2, 3, 4. Pit 4 was empty, so the turn ends. Pit 7 is empty: no capture.
    title: 'Sow the seeds',
    intro: 'Tap the glowing pit. Its seeds are lifted and dropped one at a time, travelling counter-clockwise: along your row to the right, then back along theirs.',
    pits: [0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0],
    target: 1,
    result: 'Three seeds, three pits. The last one landed in an empty pit, so the turn ends.',
  },
  {
    // Pit 0 has 1 seed and lands in pit 1 (which had 1, now 2): relay. Lift 2, drop in 2 and 3. Pit 3 was empty.
    title: 'Keep it moving: the relay',
    intro: 'If your last seed lands in a pit that already has seeds, you pick them all up and keep sowing. Tap the glowing pit and watch the relay.',
    pits: [1, 1, 0, 0, 0, 0, 0, 0, 0, 2, 0, 1],
    target: 0,
    result: 'The last seed landed on a pit that had one, so everything was lifted and sown on. The turn only ends when a seed lands in an empty pit.',
  },
  {
    // Pit 1 has 2 seeds: drops in 2 and 3. Pit 3 was empty and is on your side, so you take what faces it: pit 8 (3 seeds).
    title: 'Capture!',
    intro: 'End your turn in an empty pit on your own side and you capture every seed in the pit directly opposite. Tap the glowing pit: its last seed will land in an empty pit facing three seeds.',
    pits: [0, 2, 0, 0, 2, 1, 1, 0, 3, 0, 2, 0],
    target: 1,
    result: 'Your last seed landed in an empty pit on your side, so you took the 3 seeds facing it. Captures are how you win: reach 25.',
  },
];
