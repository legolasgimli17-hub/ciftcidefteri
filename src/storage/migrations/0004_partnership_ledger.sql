CREATE TABLE IF NOT EXISTS farm_partners (
  id TEXT PRIMARY KEY NOT NULL,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 2 AND 80),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_state TEXT NOT NULL DEFAULT 'local' CHECK(sync_state IN ('local','pending','synced','conflict')),
  UNIQUE(farm_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_farm_id_id
  ON transactions(farm_id, id);

CREATE TABLE IF NOT EXISTS transaction_partnerships (
  transaction_id TEXT PRIMARY KEY NOT NULL,
  farm_id TEXT NOT NULL,
  partner_id TEXT NOT NULL,
  owner_share_basis_points INTEGER NOT NULL CHECK(owner_share_basis_points BETWEEN 1 AND 9999),
  cash_actor TEXT NOT NULL CHECK(cash_actor IN ('owner','partner')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_state TEXT NOT NULL DEFAULT 'local' CHECK(sync_state IN ('local','pending','synced','conflict')),
  FOREIGN KEY (farm_id, transaction_id) REFERENCES transactions(farm_id, id) ON DELETE CASCADE,
  FOREIGN KEY (farm_id, partner_id) REFERENCES farm_partners(farm_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS partner_settlements (
  id TEXT PRIMARY KEY NOT NULL,
  farm_id TEXT NOT NULL,
  partner_id TEXT NOT NULL,
  amount_kurus INTEGER NOT NULL CHECK(amount_kurus > 0),
  occurred_on TEXT NOT NULL CHECK(occurred_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  direction TEXT NOT NULL CHECK(direction IN ('partner_to_owner','owner_to_partner')),
  note TEXT CHECK(note IS NULL OR length(note) <= 180),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_state TEXT NOT NULL DEFAULT 'local' CHECK(sync_state IN ('local','pending','synced','conflict')),
  FOREIGN KEY (farm_id, partner_id) REFERENCES farm_partners(farm_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_farm_partners_active_name
  ON farm_partners(farm_id, display_name, id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transaction_partnerships_partner
  ON transaction_partnerships(farm_id, partner_id, transaction_id);

CREATE INDEX IF NOT EXISTS idx_partner_settlements_partner_date
  ON partner_settlements(farm_id, partner_id, occurred_on DESC, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;
