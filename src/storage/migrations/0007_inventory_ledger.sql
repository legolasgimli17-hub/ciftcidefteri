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
