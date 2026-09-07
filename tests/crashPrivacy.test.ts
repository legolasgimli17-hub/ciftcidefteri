import assert from "node:assert/strict";
import test from "node:test";
import { isSafeCrashCode, sanitizeCrashEvent } from "../src/domain/crashPrivacy.js";

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
    tags: {
      crash_code: "root_error_boundary",
      environment: "production",
      farm_name: "Benim Çiftliğim"
    }
  });

  assert.equal(event.message, "[redacted]");
  assert.equal("user" in event, false);
  assert.equal("request" in event, false);
  assert.equal("breadcrumbs" in event, false);
  assert.equal("extra" in event, false);
  assert.equal("transaction" in event, false);
  assert.equal("fingerprint" in event, false);
  assert.equal("server_name" in event, false);
  assert.deepEqual(event.tags, {
    crash_code: "root_error_boundary",
    environment: "production"
  });
});

test("crash scrubber keeps stack trace but redacts exception value", () => {
  const stacktrace = {
    frames: [
      { filename: "app/_layout.tsx", function: "RootLayout", lineno: 42, colno: 7 }
    ]
  };
  const event = sanitizeCrashEvent({
    exception: {
      values: [
        {
          type: "Error",
          value: "Kullanıcı notu: 5000 TL mazot",
          stacktrace,
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
  assert.deepEqual(values[0]?.stacktrace, stacktrace);
  assert.deepEqual(values[0]?.mechanism, { type: "generic", handled: false });
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
