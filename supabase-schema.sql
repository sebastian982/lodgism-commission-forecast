-- ============================================================
-- Lodgism Commission Forecast — Supabase Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Properties
CREATE TABLE IF NOT EXISTS properties (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  address    TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'Active',
  comm_rate  REAL NOT NULL DEFAULT 0.20,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Monthly GRI projections
CREATE TABLE IF NOT EXISTS property_gri (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  year        INTEGER NOT NULL,
  month       INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount      REAL NOT NULL DEFAULT 0,
  UNIQUE (property_id, year, month)
);

-- Actual commission payments received
CREATE TABLE IF NOT EXISTS actuals (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year       INTEGER NOT NULL,
  month      INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount     REAL NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Row Level Security ──────────────────────────────────────
ALTER TABLE properties   ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_gri ENABLE ROW LEVEL SECURITY;
ALTER TABLE actuals       ENABLE ROW LEVEL SECURITY;

-- Each user only sees and modifies their own data
CREATE POLICY "own_properties"
  ON properties FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own_actuals"
  ON actuals FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own_gri"
  ON property_gri FOR ALL
  USING      (property_id IN (SELECT id FROM properties WHERE user_id = auth.uid()))
  WITH CHECK (property_id IN (SELECT id FROM properties WHERE user_id = auth.uid()));

-- ── Auto-update updated_at ──────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_properties_updated
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
