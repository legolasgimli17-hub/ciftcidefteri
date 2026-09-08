declare function require(name: string): any;

const test = require("node:test");
const assert = require("node:assert/strict");
const NodeModule = require("node:module");

const MAIN_PATH = "/data/databases/ciftci-defteri.db";
const BACKUP_PATH = `${MAIN_PATH}.legacy-plaintext-v03`;
const TEMP_PATH = `${MAIN_PATH}.sqlcipher-migration`;
const VALID_KEY = "a".repeat(64);

type HarnessState = {
  integrity: string;
  sourceSchemaCount: number;
  targetSchemaCount: number;
  attachFails: boolean;
  exportFails: boolean;
  walCheckpointFails: boolean;
  sourceClosed: number;
  encryptedOpened: number;
  encryptedClosed: number;
  calls: string[];
};

let files = new Map<string, number>();
let state: HarnessState = freshState();

class FakeFile {
  readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  get uri(): string {
    return this.path;
  }

  get exists(): boolean {
    return files.has(this.path);
  }

  get size(): number {
    return files.get(this.path) ?? 0;
  }

  delete(): void {
    files.delete(this.path);
  }

  async move(destination: FakeFile): Promise<void> {
    if (!this.exists) throw new Error("fake_source_missing");
    const size = this.size;
    files.delete(this.path);
    files.set(destination.path, size);
  }
}

function freshState(): HarnessState {
  return {
    integrity: "ok",
    sourceSchemaCount: 4,
    targetSchemaCount: 4,
    attachFails: false,
    exportFails: false,
    walCheckpointFails: false,
    sourceClosed: 0,
    encryptedOpened: 0,
    encryptedClosed: 0,
    calls: []
  };
}

function resetHarness(): void {
  files = new Map<string, number>();
  state = freshState();
}

function sourceDatabase(): any {
  return {
    databasePath: MAIN_PATH,
    async execAsync(sql: string): Promise<void> {
      state.calls.push(`source.exec:${sql}`);
      if (sql === "PRAGMA wal_checkpoint(TRUNCATE);" && state.walCheckpointFails) {
        throw new Error("native_wal_failure_with_unknown_contents");
      }
    },
    async getFirstAsync(sql: string): Promise<any> {
      state.calls.push(`source.get:${sql}`);
      if (sql.includes("sqlite_master")) return { count: 1 };
      return null;
    },
    async runAsync(): Promise<void> {
      throw new Error("source_run_unexpected");
    },
    async closeAsync(): Promise<void> {
      state.calls.push("source.close");
      state.sourceClosed += 1;
    }
  };
}

function encryptedDatabase(tempPath: string): any {
  return {
    databasePath: tempPath,
    async execAsync(sql: string): Promise<void> {
      state.calls.push(`encrypted.exec:${sql}`);
      if (sql === "DETACH DATABASE legacy;") return;
    },
    async runAsync(sql: string): Promise<void> {
      state.calls.push(`encrypted.run:${sql}`);
      if (sql.startsWith("ATTACH DATABASE")) {
        if (state.attachFails) throw new Error("native_attach_failure_with_unknown_contents");
        return;
      }
    },
    async getFirstAsync(sql: string): Promise<any> {
      state.calls.push(`encrypted.get:${sql}`);
      if (sql === "PRAGMA cipher_version;") return { cipher_version: "4.6.1" };
      if (sql.includes("sqlcipher_export")) {
        if (state.exportFails) throw new Error("native_export_failure_with_unknown_contents");
        files.set(tempPath, 512);
        return { ok: 1 };
      }
      if (sql === "PRAGMA main.integrity_check;") {
        return { integrity_check: state.integrity };
      }
      if (sql.includes("legacy.sqlite_master WHERE sql IS NOT NULL")) {
        return { count: state.sourceSchemaCount };
      }
      if (sql.includes("main.sqlite_master WHERE sql IS NOT NULL")) {
        return { count: state.targetSchemaCount };
      }
      if (sql.includes("legacy.sqlite_master")) return { count: 1 };
      if (sql.includes("main.sqlite_master")) return { count: 1 };
      return null;
    },
    async closeAsync(): Promise<void> {
      state.calls.push("encrypted.close");
      state.encryptedClosed += 1;
    }
  };
}

const ModuleCtor = NodeModule.Module as any;
const originalLoad = ModuleCtor._load;
ModuleCtor._load = function mockedLoad(request: string, parent: unknown, isMain: boolean): unknown {
  if (request === "expo-file-system") {
    return { File: FakeFile };
  }
  if (request === "expo-sqlite") {
    return {
      async openDatabaseAsync(fileName: string, _options: unknown, directory: string): Promise<any> {
        state.encryptedOpened += 1;
        const tempPath = `${directory}/${fileName}`;
        return encryptedDatabase(tempPath);
      }
    };
  }
  if (request === "./databaseKey") {
    return {
      assertDatabaseKeyHex(value: string): string {
        if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error("invalid_key");
        return value.toLowerCase();
      },
      sqlCipherKeyPragma(value: string): string {
        return `PRAGMA key = \"x'${value.toLowerCase()}'\";`;
      }
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const upgrade = require("../src/mobile/legacyDatabaseUpgrade") as {
  migrateLegacyPlaintextIfNeeded(database: any, keyHex: string): Promise<void>;
  legacyUpgradeDiagnosticTag(error: unknown): string | null;
};
ModuleCtor._load = originalLoad;

test("legacy upgrade is a no-op when there is no old database file", async () => {
  resetHarness();

  await upgrade.migrateLegacyPlaintextIfNeeded(sourceDatabase(), VALID_KEY);

  assert.equal(state.encryptedOpened, 0);
  assert.equal(state.sourceClosed, 0);
  assert.equal(files.size, 0);
});

test("legacy upgrade completes export and preserves plaintext backup until reopen", async () => {
  resetHarness();
  files.set(MAIN_PATH, 1024);

  await assert.rejects(
    () => upgrade.migrateLegacyPlaintextIfNeeded(sourceDatabase(), VALID_KEY),
    (error: unknown) => error instanceof Error && error.message === "database_reopen_required"
  );

  assert.equal(files.get(BACKUP_PATH), 1024);
  assert.equal(files.get(MAIN_PATH), 512);
  assert.equal(files.has(TEMP_PATH), false);
  assert.equal(state.sourceClosed, 1);
  assert.equal(state.encryptedOpened, 1);
  assert.equal(state.encryptedClosed, 1);
});

test("legacy upgrade recovers an interrupted swap on the next startup", async () => {
  resetHarness();
  files.set(BACKUP_PATH, 1024);
  files.set(TEMP_PATH, 512);

  await assert.rejects(
    () => upgrade.migrateLegacyPlaintextIfNeeded(sourceDatabase(), VALID_KEY),
    (error: unknown) => error instanceof Error && error.message === "database_reopen_required"
  );

  assert.equal(files.get(MAIN_PATH), 512);
  assert.equal(files.get(BACKUP_PATH), 1024);
  assert.equal(files.has(TEMP_PATH), false);
  assert.equal(state.sourceClosed, 1);
  assert.equal(state.encryptedOpened, 0);
});

test("legacy upgrade stops safely when a plaintext backup already exists", async () => {
  resetHarness();
  files.set(MAIN_PATH, 1024);
  files.set(BACKUP_PATH, 900);

  await assert.rejects(
    () => upgrade.migrateLegacyPlaintextIfNeeded(sourceDatabase(), VALID_KEY),
    (error: unknown) => error instanceof Error && error.message === "legacy_plaintext_backup_conflict"
  );

  assert.equal(files.get(MAIN_PATH), 1024);
  assert.equal(files.get(BACKUP_PATH), 900);
  assert.equal(state.sourceClosed, 0);
  assert.equal(state.encryptedOpened, 0);
});

test("legacy upgrade keeps the original database untouched when integrity verification fails", async () => {
  resetHarness();
  files.set(MAIN_PATH, 1024);
  state.integrity = "not ok";

  await assert.rejects(
    () => upgrade.migrateLegacyPlaintextIfNeeded(sourceDatabase(), VALID_KEY),
    (error: unknown) => error instanceof Error && error.message === "legacy_export_integrity_failed"
  );

  assert.equal(files.get(MAIN_PATH), 1024);
  assert.equal(files.has(BACKUP_PATH), false);
  assert.equal(files.has(TEMP_PATH), false);
  assert.equal(state.sourceClosed, 1);
});

test("unknown native migration errors become allowlisted stage tags instead of leaking raw messages", async () => {
  resetHarness();
  files.set(MAIN_PATH, 1024);
  state.attachFails = true;

  let caught: unknown = null;
  try {
    await upgrade.migrateLegacyPlaintextIfNeeded(sourceDatabase(), VALID_KEY);
  } catch (error) {
    caught = error;
  }

  assert.equal(upgrade.legacyUpgradeDiagnosticTag(caught), "legacy_export_attach_failed");
  assert.equal(caught instanceof Error ? caught.message : "", "legacy_export_attach_failed");
  assert.equal(files.get(MAIN_PATH), 1024);
  assert.equal(files.has(BACKUP_PATH), false);
  assert.equal(files.has(TEMP_PATH), false);
});
