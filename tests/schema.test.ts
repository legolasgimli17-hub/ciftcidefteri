declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

function createDb(): any {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  const schemaPath = path.resolve("src/storage/schema.sql");
  db.exec(fs.readFileSync(schemaPath, "utf8"));
  return db;
}

function seedFarm(db: any): void {
  const now = "2026-09-06T12:00:00.000Z";
  db.prepare(`INSERT INTO farmer_profiles
    (id,name,phone,province,district,village,total_area_square_meters,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
      "profile-0001", "Mehmet Kaya", "+905321234567", "Diyarbakır", "Bismil", "Örnek", 100000, now, now
    );
  db.prepare(`INSERT INTO farms
    (id,owner_local_id,display_name,created_at,updated_at)
    VALUES (?,?,?,?,?)`).run("farm-0000001", "profile-0001", "Benim Tarlam", now, now);
}

test("SQLite foreign key koruması gerçekten açık", () => {
  const db = createDb();
  assert.throws(() => {
    db.prepare(`INSERT INTO farms (id,owner_local_id,display_name,created_at,updated_at) VALUES (?,?,?,?,?)`)
      .run("farm-invalid", "missing-profile", "Tarla", "x", "x");
  });
  db.close();
});

test("SQLite negatif/sıfır tutarı ve gider desteklemesini reddeder", () => {
  const db = createDb();
  seedFarm(db);
  const insert = db.prepare(`INSERT INTO transactions
    (id,farm_id,kind,amount_kurus,occurred_on,category,is_tax_exempt_support,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  assert.throws(() => insert.run("tx-zero-0001", "farm-0000001", "expense", 0, "2026-09-06", "Mazot", 0, "x", "x"));
  assert.throws(() => insert.run("tx-support-1", "farm-0000001", "expense", 100, "2026-09-06", "Destek", 1, "x", "x"));
  db.close();
});

test("SQLite bilinmeyen ürün ve sync state değerini reddeder", () => {
  const db = createDb();
  seedFarm(db);
  assert.throws(() => db.prepare(`INSERT INTO farm_crops (farm_id,crop_code,created_at,sync_state) VALUES (?,?,?,?)`).run("farm-0000001", "banana", "x", "local"));
  assert.throws(() => db.prepare(`UPDATE farms SET sync_state=? WHERE id=?`).run("broken", "farm-0000001"));
  db.close();
});

test("SQLite transaction rollback yarım finans kaydı bırakmaz", () => {
  const db = createDb();
  seedFarm(db);
  const insert = db.prepare(`INSERT INTO transactions (id,farm_id,kind,amount_kurus,occurred_on,category,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`);
  db.exec("BEGIN IMMEDIATE");
  try {
    insert.run("tx-rollback-1", "farm-0000001", "expense", 5000, "2026-09-06", "Mazot", "x", "x");
    throw new Error("simulated crash");
  } catch {
    db.exec("ROLLBACK");
  }
  const row = db.prepare("SELECT COUNT(*) AS count FROM transactions WHERE id=?").get("tx-rollback-1");
  assert.equal(row.count, 0);
  db.close();
});

test("SQLite işlem ürününü çiftliğin ürünlerinden biri olmak zorunda tutar", () => {
  const db = createDb();
  seedFarm(db);
  db.prepare(`INSERT INTO farm_crops (farm_id,crop_code,created_at) VALUES (?,?,?)`)
    .run("farm-0000001", "cotton", "2026-09-06T12:00:00.000Z");
  const insert = db.prepare(`INSERT INTO transactions
    (id,farm_id,kind,amount_kurus,occurred_on,category,crop_code,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  assert.throws(() => insert.run(
    "tx-wrong-crop", "farm-0000001", "expense", 1000, "2026-09-06", "Budama", "hazelnut",
    "2026-09-06T12:00:00.000Z", "2026-09-06T12:00:00.000Z"
  ));
  db.close();
});
