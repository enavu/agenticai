import { pool } from './client.js'

const schema = `
CREATE TABLE IF NOT EXISTS trips (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  subtitle         TEXT,
  date             DATE NOT NULL,
  budget_usd       NUMERIC(10,2) NOT NULL,
  saved_usd        NUMERIC(10,2) NOT NULL DEFAULT 0,
  emoji            TEXT DEFAULT '✈️',
  flight_price_usd NUMERIC(10,2),
  flight_notes     TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Safe to re-run: add columns if upgrading an existing DB
ALTER TABLE trips ADD COLUMN IF NOT EXISTS flight_price_usd NUMERIC(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS flight_notes TEXT;

CREATE TABLE IF NOT EXISTS transactions (
  id          SERIAL PRIMARY KEY,
  plaid_id    TEXT UNIQUE,
  date        DATE NOT NULL,
  merchant    TEXT NOT NULL,
  amount      NUMERIC(10,2) NOT NULL,
  category    TEXT,
  account     TEXT,
  flagged     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS food_log (
  id          SERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  meal_name   TEXT NOT NULL,
  source      TEXT DEFAULT 'manual',
  calories    INTEGER,
  flags       JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS savings_events (
  id          SERIAL PRIMARY KEY,
  trip_id     INTEGER REFERENCES trips(id) ON DELETE CASCADE,
  amount      NUMERIC(10,2) NOT NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plaid_tokens (
  id            SERIAL PRIMARY KEY,
  access_token  TEXT NOT NULL,
  item_id       TEXT NOT NULL,
  institution   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
`

const seedTrips = `
INSERT INTO trips (name, subtitle, date, budget_usd, emoji, flight_price_usd, flight_notes) VALUES
  ('Paris + Céline Dion',  'Sep 2026 · CDG',                    '2026-09-15', 4500, '🇫🇷', NULL,  NULL),
  ('BTS — Baltimore',      'Aug 10, 2026 · Camden Yards',        '2026-08-10',  800, '💜',  350,   'Non-stop'),
  ('BTS — Arlington',      'Aug 15, 2026 · Globe Life Field',    '2026-08-15',  950, '💜',  NULL,  NULL)
ON CONFLICT DO NOTHING;
`

async function migrate() {
  const client = await pool.connect()
  try {
    console.log('Running migrations...')
    await client.query(schema)
    console.log('Schema ready.')

    console.log('Seeding trips...')
    await client.query(seedTrips)
    console.log('Trips seeded.')

    console.log('Migration complete.')
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
