declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");

import {
  APP_LOCK_MAX_FAILED_ATTEMPTS_BEFORE_DELAY,
  APP_LOCK_RECORD_VERSION,
  constantTimeHexEqual,
  nextAppLockBlockedUntilMs,
  normalizeAppLockPin,
  parseAppLockRecord,
  remainingAppLockSeconds,
  serializeAppLockRecord,
  type AppLockRecord
} from "../src/domain/appLock";

const VALID_RECORD: AppLockRecord = {
  version: APP_LOCK_RECORD_VERSION,
  saltHex: "0123456789abcdef0123456789abcdef",
  pinDigestHex: "a".repeat(64),
  failedAttempts: 0,
  blockedUntilMs: 0
};

test("uygulama kilidi yalnız 6 rakamlı PIN kabul eder", () => {
  assert.equal(normalizeAppLockPin(" 123456 "), "123456");
  assert.throws(() => normalizeAppLockPin("12345"), /6 haneli/);
  assert.throws(() => normalizeAppLockPin("1234567"), /6 haneli/);
  assert.throws(() => normalizeAppLockPin("12a456"), /6 haneli/);
});

test("ilk dört yanlış deneme bekletmez, beşinci denemeden sonra kalıcı gecikme başlar", () => {
  const now = 1_800_000_000_000;
  assert.equal(APP_LOCK_MAX_FAILED_ATTEMPTS_BEFORE_DELAY, 5);
  assert.equal(nextAppLockBlockedUntilMs(4, now), 0);
  assert.equal(nextAppLockBlockedUntilMs(5, now), now + 30_000);
  assert.equal(nextAppLockBlockedUntilMs(6, now), now + 60_000);
  assert.equal(nextAppLockBlockedUntilMs(7, now), now + 120_000);
});

test("yanlış deneme gecikmesi beş dakikada sınırlandırılır", () => {
  const now = 1_800_000_000_000;
  assert.equal(nextAppLockBlockedUntilMs(20, now), now + 300_000);
});

test("kalan kilit süresi kullanıcıya tam saniye olarak verilir", () => {
  assert.equal(remainingAppLockSeconds(10_001, 10_000), 1);
  assert.equal(remainingAppLockSeconds(11_001, 10_000), 2);
  assert.equal(remainingAppLockSeconds(9_000, 10_000), 0);
});

test("kilit kaydı yalnız beklenen alanlarla ve güvenli biçimle kabul edilir", () => {
  assert.deepEqual(parseAppLockRecord(JSON.stringify(VALID_RECORD)), VALID_RECORD);
  assert.throws(
    () => parseAppLockRecord(JSON.stringify({ ...VALID_RECORD, rawPin: "123456" })),
    /geçersiz/
  );
  assert.throws(
    () => parseAppLockRecord(JSON.stringify({ ...VALID_RECORD, saltHex: "kısa" })),
    /tuzu geçersiz/
  );
});

test("kilit kaydı serialize-parse turunda değişmez", () => {
  const record: AppLockRecord = { ...VALID_RECORD, failedAttempts: 6, blockedUntilMs: 1_800_000_060_000 };
  assert.deepEqual(parseAppLockRecord(serializeAppLockRecord(record)), record);
});

test("digest karşılaştırması yalnız aynı uzunluk ve içerikte true döner", () => {
  assert.equal(constantTimeHexEqual("a".repeat(64), "a".repeat(64)), true);
  assert.equal(constantTimeHexEqual("a".repeat(64), "b".repeat(64)), false);
  assert.equal(constantTimeHexEqual("a".repeat(64), "a".repeat(62)), false);
  assert.equal(constantTimeHexEqual("zz", "zz"), false);
});
