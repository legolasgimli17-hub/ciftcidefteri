export const SCHEMA_VERSION = 7;

export const INITIAL_SCHEMA_SQL = String.raw`
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS farmer_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 80),
  phone TEXT NOT NULL CHECK(length(phone) BETWEEN 10 AND 16),
  province TEXT NOT NULL CHECK(length(province) BETWEEN 2 AND 80),
  district TEXT NOT NULL CHECK(length(district) BETWEEN 2 AND 80),
  village TEXT NOT NULL CHECK(length(village) BETWEEN 1 AND 80),
  total_area_square_meters INTEGER NOT NULL CHECK(total_area_square_meters > 0),
  is_cks_registered INTEGER CHECK(is_cks_registered IS NULL OR is_cks_registered IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_state TEXT NOT NULL DEFAULT 'local' CHECK(sync_state IN ('local','pending','synced','conflict'))
);

CREATE TABLE IF NOT EXISTS farms (
  id TEXT PRIMARY KEY NOT NULL,
  owner_local_id TEXT NOT NULL REFERENCES farmer_profiles(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 80),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_state TEXT NOT NULL DEFAULT 'local' CHECK(sync_state IN ('local','pending','synced','conflict'))
);

CREATE TABLE IF NOT EXISTS farm_crops (
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  crop_code TEXT NOT NULL CHECK(crop_code IN ('cotton','corn','wheat','hazelnut','tobacco','vegetable','other')),
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_state TEXT NOT NULL DEFAULT 'local' CHECK(sync_state IN ('local','pending','synced','conflict')),
  PRIMARY KEY (farm_id, crop_code)
);

CREATE TABLE IF NOT EXISTS parcels (
  id TEXT PRIMARY KEY NOT NULL,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
  area_square_meters INTEGER NOT NULL CHECK(area_square_meters > 0),
  crop_code TEXT NOT NULL CHECK(crop_code IN ('cotton','corn','wheat','hazelnut','tobacco','vegetable','other')),
  season_year INTEGER NOT NULL CHECK(season_year BETWEEN 2000 AND 2200),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_state TEXT NOT NULL DEFAULT 'local' CHECK(sync_state IN ('local','pending','synced','conflict')),
  FOREIGN KEY (farm_id, crop_code) REFERENCES farm_crops(farm_id, crop_code) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  parcel_id TEXT REFERENCES parcels(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK(kind IN ('income','expense')),
  amount_kurus INTEGER NOT NULL CHECK(amount_kurus > 0),
  occurred_on TEXT NOT NULL CHECK(occurred_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  category TEXT NOT NULL CHECK(length(category) BETWEEN 1 AND 60),
  crop_code TEXT CHECK(crop_code IS NULL OR crop_code IN ('cotton','corn','wheat','hazelnut','tobacco','vegetable','other')),
  note TEXT CHECK(note IS NULL OR length(note) <= 240),
  is_tax_exempt_support INTEGER NOT NULL DEFAULT 0 CHECK(is_tax_exempt_support IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_state TEXT NOT NULL DEFAULT 'local' CHECK(sync_state IN ('local','pending','synced','conflict')),
  FOREIGN KEY (farm_id, crop_code) REFERENCES farm_crops(farm_id, crop_code) ON DELETE RESTRICT,
  CHECK(is_tax_exempt_support = 0 OR kind = 'income')
);

CREATE INDEX IF NOT EXISTS idx_transactions_farm_date
  ON transactions(farm_id, occurred_on DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_parcel_date
  ON transactions(parcel_id, occurred_on DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_farm_crop_date
  ON transactions(farm_id, crop_code, occurred_on DESC);
`;

export const TRANSACTION_HISTORY_INDEX_SQL = String.raw`
CREATE INDEX IF NOT EXISTS idx_transactions_active_history
  ON transactions(farm_id, occurred_on DESC, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;
`;

export const PROFILE_PHONE_REMOVAL_SQL = String.raw`
ALTER TABLE farmer_profiles DROP COLUMN phone;
`;

export const PARTNERSHIP_LEDGER_SQL = String.raw`
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
`;

export const DEBT_LEDGER_SQL = String.raw`
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
`;

export const BANK_MOVEMENTS_SQL = String.raw`
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
`;

export const INVENTORY_LEDGER_SQL = String.raw`
CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY NOT NULL,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  item_kind TEXT NOT NULL CHECK(item_kind IN ('product','input')),
  display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 2 AND 80),
  unit_code TEXT NOT NULL CHECK(unit_code IN ('kg','ton','litre','piece','sack')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_state TEXT NOT NULL DEFAULT 'local' CHECK(sync_state IN ('local','pending','synced','conflict')),
  UNIQUE(farm_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_active_name_unit
  ON inventory_items(farm_id, display_name COLLATE NOCASE, unit_code)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY NOT NULL,
  farm_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('increase','decrease')),
  quantity_milli INTEGER NOT NULL CHECK(quantity_milli > 0 AND quantity_milli <= 9000000000000),
  occurred_on TEXT NOT NULL CHECK(occurred_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  note TEXT CHECK(note IS NULL OR length(note) <= 180),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_state TEXT NOT NULL DEFAULT 'local' CHECK(sync_state IN ('local','pending','synced','conflict')),
  FOREIGN KEY (farm_id, item_id) REFERENCES inventory_items(farm_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_date
  ON inventory_movements(farm_id, item_id, occurred_on DESC, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;
`;
