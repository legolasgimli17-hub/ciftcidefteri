CREATE TABLE IF NOT EXISTS bank_movements (
  id TEXT PRIMARY KEY NOT NULL,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('withdrawal','deposit')),
  amount_kurus INTEGER NOT NULL CHECK(amount_kurus > 0),
  occurred_on TEXT NOT NULL CHECK(occurred_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  bank_name TEXT CHECK(bank_name IS NULL OR length(bank_name) BETWEEN 2 AND 100),
  note TEXT CHECK(note IS NULL OR length(note) <= 180),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_state TEXT NOT NULL DEFAULT 'local' CHECK(sync_state IN ('local','pending','synced','conflict')),
  UNIQUE(farm_id, id)
);

CREATE INDEX IF NOT EXISTS idx_bank_movements_farm_date
  ON bank_movements(farm_id, occurred_on DESC, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;
