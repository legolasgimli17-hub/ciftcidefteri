declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");

import {
  isSafeCrashCode,
  isSafeDiagnosticCode,
  sanitizeCrashEvent
} from "../src/domain/crashPrivacy";

test("crash scrubber removes user, request, breadcrumbs and free-form financial data", () => {
  const event = sanitizeCrashEvent({
    message: "Mehmet 18500 TL gübre kaydı çöktü",
    user: { id: "profile-1", name: "Mehmet" },
    request: { url: "https://example.test/?not=18500" },
    breadcrumbs: [{ message: "Gübre 18500" }],
    extra: { note: "2. uygulama gübresi", amount: 18500 },
    transaction: "/transaction-edit?id=secret",
    fingerprint: ["Mehmet", "18500"],
    server_name: "private-device",
    logentry: { message: "Borç 5000 TL" },
    logger: "private-ledger",
    culprit: "/transaction-edit?id=private",
    spans: [{ description: "Mehmet 18500" }],
    sdkProcessingMetadata: { secret: "recovery-key" },
    tags: {
      crash_code: "root_error_boundary",
      diagnostic_code: "legacy_export_failed",
      environment: "production",
      farm_name: "Benim Çiftliğim"
    }
  });

  assert.equal(event.message, "[redacted]");
  for (const forbidden of [
    "user",
    "request",
    "breadcrumbs",
    "extra",
    "transaction",
    "fingerprint",
    "server_name",
    "logentry",
    "logger",
    "culprit",
    "spans",
    "sdkProcessingMetadata"
  ]) {
    assert.equal(forbidden in event, false);
  }
  assert.deepEqual(event.tags, {
    crash_code: "root_error_boundary",
    diagnostic_code: "legacy_export_failed",
    environment: "production"
  });
});

test("crash scrubber keeps only diagnostic stack coordinates and redacts exception value", () => {
  const event = sanitizeCrashEvent({
    exception: {
      values: [
        {
          type: "Error",
          value: "Kullanıcı notu: 5000 TL mazot",
          stacktrace: {
            frames: [
              {
                filename: "app/_layout.tsx",
                function: "RootLayout",
                module: "app._layout",
                lineno: 42,
                colno: 7,
                in_app: true,
                abs_path: "/data/user/0/private/Mehmet/18500",
                vars: { amount: 18500, note: "2. uygulama gübresi" },
                context_line: "throw new Error(userNote)"
              }
            ]
          },
          mechanism: {
            type: "generic",
            handled: false,
            data: { secret: "do-not-send" }
          }
        }
      ]
    }
  });

  const values = (event.exception as { values: Array<Record<string, unknown>> }).values;
  assert.equal(values[0]?.value, "[redacted]");
  assert.deepEqual(values[0]?.stacktrace, {
    frames: [
      {
        filename: "app/_layout.tsx",
        function: "RootLayout",
        module: "app._layout",
        lineno: 42,
        colno: 7,
        in_app: true
      }
    ]
  });
  assert.deepEqual(values[0]?.mechanism, { type: "generic", handled: false });
});

test("top-level stack trace is minimized with the same allowlist", () => {
  const event = sanitizeCrashEvent({
    stacktrace: {
      frames: [
        {
          filename: "src/mobile/database.ts",
          function: "initializeDatabase",
          lineno: 17,
          colno: 3,
          vars: { dbKey: "secret" },
          abs_path: "/private/device/path"
        }
      ]
    }
  });

  assert.deepEqual(event.stacktrace, {
    frames: [
      {
        filename: "src/mobile/database.ts",
        function: "initializeDatabase",
        lineno: 17,
        colno: 3
      }
    ]
  });
});

test("crash scrubber only keeps narrow device, OS and app context", () => {
  const event = sanitizeCrashEvent({
    contexts: {
      device: { model: "Redmi", family: "Android", arch: "arm64", name: "AbdullahPhone", free_memory: 123 },
      os: { name: "Android", version: "14", build: "UP1A", rooted: false },
      app: { app_identifier: "app.ciftcidefteri.mobile", app_version: "0.4.0", app_build: "4", app_name: "Çiftçi Defteri" },
      custom: { amount: 25000, partner: "Mehmet" }
    }
  });

  assert.deepEqual(event.contexts, {
    device: { model: "Redmi", family: "Android", arch: "arm64" },
    os: { name: "Android", version: "14", build: "UP1A" },
    app: { app_identifier: "app.ciftcidefteri.mobile", app_version: "0.4.0", app_build: "4" }
  });
});

test("crash code is intentionally small and machine-only", () => {
  assert.equal(isSafeCrashCode("database_init_error"), true);
  assert.equal(isSafeCrashCode("root_error_boundary"), true);
  assert.equal(isSafeCrashCode("Mehmet 18500 TL"), false);
  assert.equal(isSafeCrashCode("../../secret"), false);
});

test("diagnostic code accepts only fixed legacy machine labels", () => {
  assert.equal(isSafeDiagnosticCode("legacy_export_integrity_failed"), true);
  assert.equal(isSafeDiagnosticCode("legacy_plaintext_backup_conflict"), true);
  assert.equal(isSafeDiagnosticCode("Mehmet 18500 TL"), false);
  assert.equal(isSafeDiagnosticCode("legacy_/data/user/0/private"), false);
});
