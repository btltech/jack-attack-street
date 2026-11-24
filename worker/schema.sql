-- D1 schema for jack-attack-daily. The Worker creates `events` itself on first use (CREATE IF NOT EXISTS);
-- this file is the reference copy, and the way to create both tables on a fresh database:
--   cd worker && npx wrangler d1 execute jack-attack-daily --remote --file schema.sql

CREATE TABLE IF NOT EXISTS daily_scores (
  day TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  name TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  cards_played INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (day, guest_id)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  ts INTEGER NOT NULL,
  anon TEXT NOT NULL,
  game TEXT NOT NULL,
  event TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  cohort TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_day ON events (day, event);
CREATE INDEX IF NOT EXISTS idx_events_anon ON events (anon, day);
