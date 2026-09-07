export const APP_LOCK_PIN_LENGTH = 6;
export const APP_LOCK_RECORD_VERSION = 1 as const;
export const APP_LOCK_MAX_FAILED_ATTEMPTS_BEFORE_DELAY = 5;

const APP_LOCK_MAX_COOLDOWN_MS = 5 * 60 * 1000;
const APP_LOCK_BASE_COOLDOWN_MS = 30 * 1000;

export interface AppLockRecord {
  readonly version: typeof APP_LOCK_RECORD_VERSION;
  readonly saltHex: string;
  readonly pinDigestHex: string;
  readonly failedAttempts: number;
  readonly blockedUntilMs: number;
}

export function normalizeAppLockPin(input: string): string {
  const pin = input.trim();
  if (!new RegExp(`^[0-9]{${APP_LOCK_PIN_LENGTH}}$`).test(pin)) {
    throw new Error(`PIN ${APP_LOCK_PIN_LENGTH} haneli olmalı.`);
  }
  return pin;
}

export function nextAppLockBlockedUntilMs(failedAttempts: number, nowMs: number): number {
  assertSafeNonNegativeInteger(failedAttempts, "Başarısız deneme sayısı geçersiz.");
  assertSafeNonNegativeInteger(nowMs, "Zaman bilgisi geçersiz.");
  if (failedAttempts < APP_LOCK_MAX_FAILED_ATTEMPTS_BEFORE_DELAY) return 0;

  const delayStep = failedAttempts - APP_LOCK_MAX_FAILED_ATTEMPTS_BEFORE_DELAY;
  const multiplier = 2 ** Math.min(delayStep, 4);
  const delayMs = Math.min(APP_LOCK_BASE_COOLDOWN_MS * multiplier, APP_LOCK_MAX_COOLDOWN_MS);
  return nowMs + delayMs;
}

export function remainingAppLockSeconds(blockedUntilMs: number, nowMs: number): number {
  assertSafeNonNegativeInteger(blockedUntilMs, "Kilit süresi geçersiz.");
  assertSafeNonNegativeInteger(nowMs, "Zaman bilgisi geçersiz.");
  return Math.max(0, Math.ceil((blockedUntilMs - nowMs) / 1000));
}

export function parseAppLockRecord(raw: string): AppLockRecord {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Uygulama kilidi bilgisi okunamadı.");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Uygulama kilidi bilgisi geçersiz.");
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const expected = ["blockedUntilMs", "failedAttempts", "pinDigestHex", "saltHex", "version"].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new Error("Uygulama kilidi bilgisi geçersiz.");
  }
  if (record.version !== APP_LOCK_RECORD_VERSION) {
    throw new Error("Uygulama kilidi sürümü desteklenmiyor.");
  }
  if (typeof record.saltHex !== "string" || !/^[0-9a-f]{32}$/.test(record.saltHex)) {
    throw new Error("Uygulama kilidi tuzu geçersiz.");
  }
  if (typeof record.pinDigestHex !== "string" || !/^[0-9a-f]{64}$/.test(record.pinDigestHex)) {
    throw new Error("Uygulama kilidi doğrulama bilgisi geçersiz.");
  }
  assertSafeNonNegativeInteger(record.failedAttempts, "Başarısız deneme sayısı geçersiz.");
  assertSafeNonNegativeInteger(record.blockedUntilMs, "Kilit süresi geçersiz.");

  return {
    version: APP_LOCK_RECORD_VERSION,
    saltHex: record.saltHex,
    pinDigestHex: record.pinDigestHex,
    failedAttempts: record.failedAttempts,
    blockedUntilMs: record.blockedUntilMs
  };
}

export function serializeAppLockRecord(record: AppLockRecord): string {
  const parsed = parseAppLockRecord(JSON.stringify(record));
  return JSON.stringify(parsed);
}

export function constantTimeHexEqual(left: string, right: string): boolean {
  if (!/^[0-9a-f]+$/.test(left) || !/^[0-9a-f]+$/.test(right) || left.length !== right.length) return false;
  let different = 0;
  for (let index = 0; index < left.length; index += 1) {
    different |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return different === 0;
}

function assertSafeNonNegativeInteger(value: unknown, message: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(message);
  }
}
