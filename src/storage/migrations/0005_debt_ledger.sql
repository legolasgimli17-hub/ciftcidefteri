CREATE TABLE IF NOT EXISTS debts (
  id TEXT PRIMARY KEY NOT NULL,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL CHECK(source_kind IN ('bank_cash','coop_cash','coop_in_kind','private','cheque_note','other')),
  creditor_name TEXT NOT NULL CHECK(length(creditor_name) BETWEEN 2 AND 100),
  total_kurus INTEGER NOT NULL CHECK(total_kurus > 0),
  opened_on TEXT NOT NULL CHECK(opened_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  in_kind_description TEXT CHECK(in_kind_description IS NULL OR length(in_kind_description) BETWEEN 2 AND 120),
  note TEXT CHECK(note IS NULL OR length(note) <= 240),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_state TEXT NOT NULL DEFAULT 'local' CHECK(sync_state IN ('local','pending','synced','conflict')),
  UNIQUE(farm_id, id),
  CHECK(
    (source_kind = 'coop_in_kind' AND in_kind_description IS NOT NULL) OR
    (source_kind <> 'coop_in_kind' AND in_kind_description IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS debt_installments (
  id TEXT PRIMARY KEY NOT NULL,
  farm_id TEXT NOT NULL,
  debt_id TEXT NOT NULL,
  due_on TEXT NOT NULL CHECK(due_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  amount_kurus INTEGER NOT NULL CHECK(amount_kurus > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_state TEXT NOT NULL DEFAULT 'local' CHECK(sync_state IN ('local','pending','synced','conflict')),
  FOREIGN KEY (farm_id, debt_id) REFERENCES debts(farm_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS debt_payments (
  id TEXT PRIMARY KEY NOT NULL,
  farm_id TEXT NOT NULL,
  debt_id TEXT NOT NULL,
  amount_kurus INTEGER NOT NULL CHECK(amount_kurus > 0),
  occurred_on TEXT NOT NULL CHECK(occurred_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  note TEXT CHECK(note IS NULL OR length(note) <= 180),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_state TEXT NOT NULL DEFAULT 'local' CHECK(sync_state IN ('local','pending','synced','conflict')),
  FOREIGN KEY (farm_id, debt_id) REFERENCES debts(farm_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_debts_farm_active
  ON debts(farm_id, opened_on DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_debt_installments_due
  ON debt_installments(farm_id, debt_id, due_on, id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_debt_payments_date
  ON debt_payments(farm_id, debt_id, occurred_on DESC, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;
