export const SCHEMA_VERSION = 2;

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
