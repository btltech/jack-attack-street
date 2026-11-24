# Jack Attack Street

Two browser games in one Vite + React + TypeScript project, live at https://jackattackstreets.com/

- **Jack Attack Street**: a street card game with power-ups, daily challenges, a daily leaderboard, themes, and 1v1 online rooms.
- **Ayò Ọlọ́pọ́n**: the Yoruba mancala-style board game, with relay sowing, 4-seed captures, a 3D carved board, wooden-seed audio, and 1v1 online rooms.

## Project layout

```text
index.html, index.tsx, App.tsx   Home page and Jack Attack Street app
jackattack/                      Jack Attack entry page
core/                            Jack Attack game logic, sounds, themes, online client (no React)
components/                      Jack Attack UI components
ayo/, ayo-app/                   Ayò Ọlọ́pọ́n entry page, UI, engine, sounds, online client
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

## Usage analytics

Both games send a few anonymous events (opened, game started/finished, daily won, shared, tutorial progress) to the Worker's `/api/event`, which stores them in the `events` table of the D1 database (created automatically on first use; `worker/schema.sql` is the reference copy). Each browser gets a random id that is separate from the guest id used for scores and rooms. No IP address, name or account is stored. Do Not Track is honoured, and `localStorage.setItem('ja-analytics-off', '1')` opts a browser out. Local development hosts are skipped unless `ja-analytics-debug` is `1`.

Read the numbers (daily players, day-1/day-7 return, funnel, tutorial drop-off) with:

```bash
npm run stats
```

The Worker must be redeployed (`cd worker && npx wrangler deploy`) before the site's events are accepted.
