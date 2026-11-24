# Jack Attack Street

Two browser games in one Vite + React + TypeScript project, live at https://jackattackstreets.com/

- **Jack Attack Street**: a street card game with power-ups, daily challenges, a daily leaderboard, themes, and 1v1 online rooms.
- **Ayò Ọlọ́pọ́n**: the Yoruba mancala-style board game, with relay sowing, 4-seed captures, a 3D carved board, wooden-seed audio, and 1v1 online rooms.

## Project layout

```text
index.html, index.tsx, App.tsx   Home page and Jack Attack Street app
jackattack/                      Jack Attack entry page
core/                            Jack Attack game logic, sounds, themes, online client (no React);
                                 diceEngine.ts is shared by Street Dice and the Worker
components/                      Jack Attack UI components
ayo/, ayo-app/                   Ayò Ọlọ́pọ́n entry page, UI, engine, sounds, online client
dice/, dice-app/                 Street Dice: daily push-your-luck dice game (page, UI, sounds, leaderboard client)
rules/, ayo-rules/               Static rules pages for each game
public/                          Static assets
scripts/og/                      SVG sources for Open Graph share images
worker/                          Cloudflare Worker: online rooms (Durable Objects) + daily leaderboard (D1)
.github/workflows/deploy.yml     Build and deploy to GitHub Pages on push to main
```

## Running locally

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # outputs to dist/
npm run preview
```

The client talks to the rooms API at `https://jack-attack-rooms.btltech.workers.dev` by default.
Set `VITE_ROOMS_API_URL` to point it elsewhere (for example a local `wrangler dev`).

## Worker

```bash
cd worker
npx wrangler dev       # local
npx wrangler deploy    # production
```

The Worker only sends CORS headers to an allow-list of origins (the production site, GitHub Pages,
and `localhost` / `127.0.0.1` for development). To add another origin, edit `ALLOWED_ORIGINS` in
`worker/src/index.ts`.

## Street Dice

A 60-second daily game: five rounds, roll two dice, bank before a 1 busts the pot. Everyone gets the same
rolls each UTC day (`core/diceEngine.ts`, seeded from the date), and only a player's first game of the day is
scored. The browser sends its per-round choices (rolls taken, banked or busted) to `POST /api/dice/score`; the Worker
replays them against that day's rolls and rejects anything impossible, so scores can't be forged by editing a number.
(The rolls themselves are derivable from the source, as with any client-side daily.) `npm run test:dice` checks the
engine and prints how different banking thresholds score. Art: `python3 scripts/dice-art.py`.

## Usage analytics

Both games send a few anonymous events (opened, game started/finished, daily won, shared, tutorial progress) to the Worker's `/api/event`, which stores them in the `events` table of the D1 database (created automatically on first use; `worker/schema.sql` is the reference copy). Each browser gets a random id that is separate from the guest id used for scores and rooms. No IP address, name or account is stored. Do Not Track is honoured, and `localStorage.setItem('ja-analytics-off', '1')` opts a browser out. Local development hosts are skipped unless `ja-analytics-debug` is `1`.

Read the numbers (daily players, day-1/day-7 return, funnel, tutorial drop-off) with:

```bash
npm run stats
```

The Worker must be redeployed (`cd worker && npx wrangler deploy`) before the site's events are accepted.

## Install and streak reminders

Both games are installable (`public/jackattack-manifest.json`, `public/ayo/manifest.json`, one service worker at `/sw.js`). After a player wins a daily, or opens the menu having won one before, they are offered **Install app** and **Remind me**. Reminders are Web Push: the app tells the Worker the subscription, the player's local 7pm (as a UTC hour) and their streaks; the Worker's cron (every 10 minutes) sends an empty push once a day to subscribers whose streak is alive but not yet extended today, and the service worker asks `/api/push/message` what to show. Pushes carry no payload, so no subscriber keys are stored. Subscriptions live in the `push_subs` D1 table (created on first use). On iPhone/iPad it only works once the game is added to the Home Screen.

One-time setup (the private key never goes in git):

```bash
node scripts/vapid.mjs                 # creates .secrets/vapid-private.json and prints the public key
cd worker && npx wrangler secret put VAPID_PRIVATE_JWK < ../.secrets/vapid-private.json
npx wrangler deploy
```

The public key is committed in `core/pwa.ts` and `worker/wrangler.toml` (they must match). Do not regenerate the key after launch: that silently cancels every subscription. Keep a backup of `.secrets/vapid-private.json`.
