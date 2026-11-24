// Self-test for core/diceEngine.ts: `npm run test:dice`.
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const out = join(mkdtempSync(join(tmpdir(), 'dice-')), 'engine.mjs');
await build({ entryPoints: ['core/diceEngine.ts'], bundle: true, format: 'esm', outfile: out, logLevel: 'silent' });
const E = await import(pathToFileURL(out).href);

// 1. Deterministic, and different per day and per round.
const k1 = E.dailySeedKey('2026-11-24'), k2 = E.dailySeedKey('2026-11-25');
assert.deepEqual(E.rollsForRound(k1, 0), E.rollsForRound(k1, 0));
assert.notDeepEqual(E.rollsForRound(k1, 0), E.rollsForRound(k2, 0));
assert.notDeepEqual(E.rollsForRound(k1, 0), E.rollsForRound(k1, 1));
for (const r of E.rollsForRound(k1, 0)) assert.ok(r.a >= 1 && r.a <= 6 && r.b >= 1 && r.b <= 6);

// 2. Scoring rules.
assert.equal(E.isBust({ a: 1, b: 5 }), true);
assert.equal(E.isBust({ a: 1, b: 1 }), true);
assert.equal(E.isBust({ a: 2, b: 3 }), false);
assert.equal(E.rollValue({ a: 2, b: 3 }), 5);
assert.equal(E.rollValue({ a: 4, b: 4 }), 16); // doubles score double
assert.equal(E.bestForRound([{ a: 3, b: 4 }, { a: 2, b: 2 }, { a: 1, b: 6 }, { a: 6, b: 6 }]), 7 + 8);

// 3. Choice validation.
const rolls = [{ a: 3, b: 4 }, { a: 2, b: 2 }, { a: 1, b: 6 }, { a: 5, b: 5 }];
assert.equal(E.resolveRound(rolls, { n: 2, banked: true }).score, 15);
assert.equal(E.resolveRound(rolls, { n: 3, banked: false }).busted, true);
assert.equal(E.resolveRound(rolls, { n: 3, banked: false }).score, 0);
assert.equal(E.resolveRound(rolls, { n: 3, banked: true }), null);   // can't bank a bust
assert.equal(E.resolveRound(rolls, { n: 4, banked: false }), null);  // can't roll past a bust
assert.equal(E.resolveRound(rolls, { n: 2, banked: false }), null);  // must bank if no bust
assert.equal(E.resolveRound(rolls, { n: 0, banked: true }), null);
assert.equal(E.resolveRound(rolls, { n: 13, banked: true }), null);
assert.equal(E.resolveRound(rolls, { n: 1.5, banked: true }), null);
assert.equal(E.resolveRun(k1, []), null);

// 4. Strategy simulation: where is the sweet spot, and is the game fair for everyone?
const strat = (threshold) => (day) => {
  const key = E.dailySeedKey(day);
  const choices = [];
  for (let i = 0; i < E.ROUNDS; i++) {
    const rolls = E.rollsForRound(key, i);
    let pot = 0, n = 0, busted = false;
    while (n < E.MAX_ROLLS) {
      const r = rolls[n++];
      if (E.isBust(r)) { busted = true; break; }
      pot += E.rollValue(r);
      if (pot >= threshold) break;
    }
    choices.push({ n, banked: !busted });
  }
  return E.resolveRun(key, choices);
};
const days = Array.from({ length: 3000 }, (_, i) => new Date(Date.UTC(2026, 10, 24) + i * 86400000).toISOString().slice(0, 10));
const table = [];
for (const t of [8, 12, 16, 20, 24, 28, 34, 45]) {
  const runs = days.map((d) => strat(t)(d));
  assert.ok(runs.every(Boolean));
  const avg = runs.reduce((s, r) => s + r.score, 0) / runs.length;
  const avgBest = runs.reduce((s, r) => s + r.best, 0) / runs.length;
  const bustRate = runs.reduce((s, r) => s + r.rounds.filter((x) => x.busted).length, 0) / (runs.length * E.ROUNDS);
  table.push({ bankAt: t, avgScore: +avg.toFixed(1), avgPerfect: +avgBest.toFixed(1), bustRate: +bustRate.toFixed(2) });
}
console.table(table);
const top = Math.max(...table.map((t) => t.avgScore));
assert.ok(table.find((t) => t.avgScore === top).bankAt > 8, 'a timid strategy should not be best');
assert.ok(table.find((t) => t.avgScore === top).bankAt < 45, 'an always-greedy strategy should not be best');
console.log('dice engine OK');
