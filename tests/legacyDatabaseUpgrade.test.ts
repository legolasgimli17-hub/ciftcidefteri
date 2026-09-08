declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");

import {
  isDatabaseReopenRequiredCore,
  legacyDatabaseDiagnosticTag,
  migrateLegacyPlaintextCore,
  type LegacyUpgradeDatabase,
  type LegacyUpgradeEnvironment,
  type LegacyUpgradeFile
} from "../src/mobile/legacyDatabaseUpgradeCore";

const MAIN = "/data/app/SQLite/ciftci-defteri.db";
const BACKUP = `${MAIN}.legacy-plaintext-v03`;
const TEMP = `${MAIN}.sqlcipher-migration`;
const KEY = "a".repeat(64);

class FakeFileSystem {
  private readonly files = new Map<string, number>();

  file(path: string): LegacyUpgradeFile {
    return new FakeFile(this, path);
  }

  set(path: string, size: number): void {
    this.files.set(path, size);
  }

  get(path: string): number | undefined {
    return this.files.get(path);
  }

  has(path: string): boolean {
    return this.files.has(path);
  }

  delete(path: string): void {
    this.files.delete(path);
  }

  move(source: string, destination: string): void {
    const size = this.files.get(source);
    if (size === undefined) throw new Error("fake_missing_source");
    this.files.set(destination, size);
    this.files.delete(source);
  }
}

class FakeFile implements LegacyUpgradeFile {
  constructor(
    private readonly fs: FakeFileSystem,
    readonly path: string
  ) {}

  get exists(): boolean {
    return this.fs.has(this.path);
  }

  get size(): number {
    return this.fs.get(this.path) ?? 0;
  }

  delete(): void {
    this.fs.delete(this.path);
  }

  move(destination: LegacyUpgradeFile): void {
    this.fs.move(this.path, destination.path);
  }
}

class FakeSourceDatabase implements LegacyUpgradeDatabase {
  readonly databasePath = MAIN;
  closeCount = 0;

  constructor(private readonly plaintextReadable = true) {}

  async execAsync(_sql: string): Promise<void> {}

  async runAsync(_sql: string, _params?: readonly unknown[]): Promise<unknown> {
    return undefined;
  }

  async getFirstAsync<T>(sql: string): Promise<T | null> {
    if (sql.includes("sqlite_master")) {
      if (!this.plaintextReadable) throw new Error("not_plaintext");
      return { count: 1 } as T;
    }
    return null;
  }

  async closeAsync(): Promise<void> {
    this.closeCount += 1;
  }
}

interface EncryptedOptions {
  readonly integrity?: "ok" | "bad";
  readonly sourceSchema?: number;
  readonly targetSchema?: number;
  readonly openFailure?: boolean;
}

class FakeEncryptedDatabase implements LegacyUpgradeDatabase {
  closeCount = 0;

  constructor(
    readonly databasePath: string,
    private readonly fs: FakeFileSystem,
    private readonly options: EncryptedOptions
  ) {}

  async execAsync(_sql: string): Promise<void> {}

  async runAsync(_sql: string, _params?: readonly unknown[]): Promise<unknown> {
    return undefined;
  }

  async getFirstAsync<T>(sql: string): Promise<T | null> {
    if (sql === "PRAGMA cipher_version;") {
      return { cipher_version: "4.6.1" } as T;
    }
    if (sql.includes("sqlcipher_export")) {
      this.fs.set(TEMP, 220);
      return null;
    }
    if (sql === "PRAGMA main.integrity_check;") {
      return { integrity_check: this.options.integrity ?? "ok" } as T;
    }
    if (sql.includes("legacy.sqlite_master WHERE")) {
      return { count: this.options.sourceSchema ?? 4 } as T;
    }
    if (sql.includes("main.sqlite_master WHERE")) {
      return { count: this.options.targetSchema ?? 4 } as T;
    }
    if (sql.includes("sqlite_master")) {
      return { count: 4 } as T;
    }
    return null;
  }

  async closeAsync(): Promise<void> {
    this.closeCount += 1;
  }
}

function environment(
  fs: FakeFileSystem,
  options: EncryptedOptions = {}
): { env: LegacyUpgradeEnvironment; opened: FakeEncryptedDatabase[] } {
  const opened: FakeEncryptedDatabase[] = [];
  const env: LegacyUpgradeEnvironment = {
    file: (path) => fs.file(path),
    openDatabase: async (fileName, directory) => {
      if (options.openFailure) throw new Error("native path / user content must not escape");
      const path = `${directory}/${fileName}`;
      fs.set(path, 0);
      const db = new FakeEncryptedDatabase(path, fs, options);
      opened.push(db);
      return db;
    },
    assertKeyHex: (value) => {
      if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error("bad_key");
      return value.toLowerCase();
    },
    keyPragma: (value) => `PRAGMA key = \"x'${value}'\";`
  };
  return { env, opened };
}

async function expectReopen(operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
    assert.fail("database_reopen_required bekleniyordu");
  } catch (error) {
    assert.equal(isDatabaseReopenRequiredCore(error), true);
  }
}

test("legacy upgrade: eski dosya yoksa no-op çalışır", async () => {
  const fs = new FakeFileSystem();
  const source = new FakeSourceDatabase();
  const { env, opened } = environment(fs);

  await migrateLegacyPlaintextCore(source, KEY, env);

  assert.equal(opened.length, 0);
  assert.equal(source.closeCount, 0);
  assert.equal(fs.has(BACKUP), false);
  assert.equal(fs.has(TEMP), false);
});

test("legacy upgrade: baştan sona başarılı geçişte plaintext yedek korunur", async () => {
  const fs = new FakeFileSystem();
  fs.set(MAIN, 100);
  const source = new FakeSourceDatabase(true);
  const { env, opened } = environment(fs);

  await expectReopen(() => migrateLegacyPlaintextCore(source, KEY, env));

  assert.equal(opened.length, 1);
  assert.equal(fs.get(MAIN), 220);
  assert.equal(fs.get(BACKUP), 100);
  assert.equal(fs.has(TEMP), false);
});

test("legacy upgrade: yarıda kesilmiş swap sonraki açılışta temp DB ile toparlanır", async () => {
  const fs = new FakeFileSystem();
  fs.set(BACKUP, 100);
  fs.set(TEMP, 220);
  const source = new FakeSourceDatabase(true);
  const { env, opened } = environment(fs);

  await expectReopen(() => migrateLegacyPlaintextCore(source, KEY, env));

  assert.equal(source.closeCount, 1);
  assert.equal(opened.length, 0);
  assert.equal(fs.get(MAIN), 220);
  assert.equal(fs.get(BACKUP), 100);
  assert.equal(fs.has(TEMP), false);
});

test("legacy upgrade: backup zaten varsa güvenli şekilde conflict ile durur", async () => {
  const fs = new FakeFileSystem();
  fs.set(MAIN, 100);
  fs.set(BACKUP, 100);
  const source = new FakeSourceDatabase(true);
  const { env, opened } = environment(fs);

  await assert.rejects(
    () => migrateLegacyPlaintextCore(source, KEY, env),
    (error: unknown) => legacyDatabaseDiagnosticTag(error) === "legacy_plaintext_backup_conflict"
  );

  assert.equal(opened.length, 0);
  assert.equal(fs.get(MAIN), 100);
  assert.equal(fs.get(BACKUP), 100);
});

test("legacy upgrade: bütünlük başarısızsa orijinal dosya bozulmadan kalır", async () => {
  const fs = new FakeFileSystem();
  fs.set(MAIN, 100);
  const source = new FakeSourceDatabase(true);
  const { env } = environment(fs, { integrity: "bad" });

  await assert.rejects(
    () => migrateLegacyPlaintextCore(source, KEY, env),
    (error: unknown) => legacyDatabaseDiagnosticTag(error) === "legacy_export_integrity_failed"
  );

  assert.equal(fs.get(MAIN), 100);
  assert.equal(fs.has(BACKUP), false);
  assert.equal(fs.has(TEMP), false);
});

test("legacy upgrade: native hata ham mesaj yerine sabit adım etiketine çevrilir", async () => {
  const fs = new FakeFileSystem();
  fs.set(MAIN, 100);
  const source = new FakeSourceDatabase(true);
  const { env } = environment(fs, { openFailure: true });

  await assert.rejects(
    () => migrateLegacyPlaintextCore(source, KEY, env),
    (error: unknown) => legacyDatabaseDiagnosticTag(error) === "legacy_encrypted_open_failed"
  );

  assert.equal(fs.get(MAIN), 100);
  assert.equal(fs.has(BACKUP), false);
  assert.equal(fs.has(TEMP), false);
});
