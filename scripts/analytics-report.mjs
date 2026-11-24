// scripts/analytics-report.mjs - Print retention and funnel numbers from the `events` table in D1.
//   npm run stats            (production database)
//   npm run stats -- --local (local wrangler dev database)
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const workerDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'worker');
const where = process.argv.includes('--local') ? '--local' : '--remote';
// For a local database kept somewhere other than worker/.wrangler: STATS_PERSIST_TO=/path npm run stats -- --local
const persist = process.env.STATS_PERSIST_TO ? ['--persist-to', process.env.STATS_PERSIST_TO] : [];

const query = (sql) => {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'jack-attack-daily', where, ...persist, '--json', '--command', sql],
    { cwd: workerDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 20 * 1024 * 1024 },
  );
  const start = out.indexOf('[');
  return JSON.parse(out.slice(start))[0]?.results ?? [];
};

const section = (title, sql) => {
  console.log(`\n== ${title}`);
  try {
    const rows = query(sql);
    if (rows.length === 0) console.log('(no data yet)');
    else console.table(rows);
  } catch (e) {
    // wrangler prints failures as JSON on stdout ({"error":{"text":...}}); stderr just echoes the SQL.
    const msg = String(e.stdout || e.stderr || e.message || e);
    console.log(/no such table/i.test(msg)
      ? '(no events table yet: it is created when the first event arrives)'
      : msg.trim().split('\n').slice(0, 4).join('\n'));
  }
};

section('Daily active people, last 14 days (distinct browsers that opened a game)', `
  SELECT day, game, COUNT(DISTINCT anon) AS people
  FROM events WHERE event = 'app_open' AND day >= date('now', '-14 day')
  GROUP BY day, game ORDER BY day DESC, game`);

section('Retention by first-seen day (people who came back on day +1 / +7)', `
  SELECT cohort, COUNT(DISTINCT anon) AS people,
    COUNT(DISTINCT CASE WHEN day = date(cohort, '+1 day') THEN anon END) AS back_d1,
    COUNT(DISTINCT CASE WHEN day = date(cohort, '+7 day') THEN anon END) AS back_d7
  FROM events WHERE cohort >= date('now', '-30 day')
  GROUP BY cohort ORDER BY cohort DESC`);

section('Funnel, last 14 days (distinct people per step)', `
  SELECT game, event, COUNT(DISTINCT anon) AS people, COUNT(*) AS times
  FROM events WHERE day >= date('now', '-14 day')
    AND event IN ('app_open','game_start','daily_start','daily_win','share','tutorial_start','tutorial_done','tutorial_skip')
  GROUP BY game, event ORDER BY game, people DESC`);

section('Tutorial: how far people get, last 30 days', `
  SELECT event, detail, COUNT(DISTINCT anon) AS people
  FROM events WHERE game = 'ayo' AND event LIKE 'tutorial_%' AND day >= date('now', '-30 day')
  GROUP BY event, detail ORDER BY event, detail`);

section('Daily players who came back the next day (2+ daily days)', `
  SELECT game, COUNT(*) AS people FROM (
    SELECT game, anon FROM events WHERE event = 'daily_start' GROUP BY game, anon HAVING COUNT(DISTINCT day) >= 2
  ) GROUP BY game`);

section('Install and reminders, last 30 days (distinct people)', `
  SELECT event, COUNT(DISTINCT anon) AS people
  FROM events WHERE day >= date('now', '-30 day')
    AND event IN ('install_accept', 'install_dismiss', 'reminder_on', 'reminder_off', 'reminder_denied')
  GROUP BY event ORDER BY event`);

section('How people arrive, last 14 days (push = tapped a streak reminder, pwa = installed app, blank = browser tab)', `
  SELECT day, game, CASE WHEN detail = '' THEN 'browser' ELSE detail END AS via, COUNT(DISTINCT anon) AS people
  FROM events WHERE event = 'app_open' AND day >= date('now', '-14 day')
  GROUP BY day, game, via ORDER BY day DESC, game, via`);
