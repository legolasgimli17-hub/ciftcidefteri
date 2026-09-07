import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import {
  APP_LOCK_RECORD_VERSION,
  constantTimeHexEqual,
  nextAppLockBlockedUntilMs,
  normalizeAppLockPin,
  parseAppLockRecord,
  serializeAppLockRecord,
  type AppLockRecord
} from "../domain/appLock";

const APP_LOCK_KEY = "ciftci-defteri.app-lock.v1";
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
};

export interface AppLockStatus {
  readonly enabled: boolean;
  readonly failedAttempts: number;
  readonly blockedUntilMs: number;
}

export type AppLockVerificationResult =
  | { readonly status: "ok" }
  | { readonly status: "invalid"; readonly failedAttempts: number; readonly blockedUntilMs: number }
  | { readonly status: "blocked"; readonly failedAttempts: number; readonly blockedUntilMs: number };

export async function readAppLockStatus(): Promise<AppLockStatus> {
  const record = await readRecord();
  if (record === null) {
    return { enabled: false, failedAttempts: 0, blockedUntilMs: 0 };
  }
  return {
    enabled: true,
    failedAttempts: record.failedAttempts,
    blockedUntilMs: record.blockedUntilMs
  };
}

export async function enableAppLock(pinInput: string): Promise<void> {
  const pin = normalizeAppLockPin(pinInput);
  const saltHex = bytesToHex(await Crypto.getRandomBytesAsync(16));
  const pinDigestHex = await digestPin(pin, saltHex);
  const record: AppLockRecord = {
    version: APP_LOCK_RECORD_VERSION,
    saltHex,
    pinDigestHex,
    failedAttempts: 0,
    blockedUntilMs: 0
  };
  await SecureStore.setItemAsync(APP_LOCK_KEY, serializeAppLockRecord(record), SECURE_STORE_OPTIONS);
}

export async function verifyAppLockPin(
  pinInput: string,
  nowMs: number = Date.now()
): Promise<AppLockVerificationResult> {
  const pin = normalizeAppLockPin(pinInput);
  const record = await readRecord();
  if (record === null) {
    throw new Error("Uygulama kilidi açık değil.");
  }

  if (record.blockedUntilMs > nowMs) {
    return {
      status: "blocked",
      failedAttempts: record.failedAttempts,
      blockedUntilMs: record.blockedUntilMs
    };
  }

  const candidateDigest = await digestPin(pin, record.saltHex);
  if (constantTimeHexEqual(candidateDigest, record.pinDigestHex)) {
    if (record.failedAttempts !== 0 || record.blockedUntilMs !== 0) {
      await saveRecord({ ...record, failedAttempts: 0, blockedUntilMs: 0 });
    }
    return { status: "ok" };
  }

  const failedAttempts = record.failedAttempts + 1;
  const blockedUntilMs = nextAppLockBlockedUntilMs(failedAttempts, nowMs);
  await saveRecord({ ...record, failedAttempts, blockedUntilMs });
  return { status: "invalid", failedAttempts, blockedUntilMs };
}

export async function disableAppLock(
  pinInput: string,
  nowMs: number = Date.now()
): Promise<AppLockVerificationResult> {
  const result = await verifyAppLockPin(pinInput, nowMs);
  if (result.status !== "ok") return result;
  await SecureStore.deleteItemAsync(APP_LOCK_KEY, SECURE_STORE_OPTIONS);
  return result;
}

async function readRecord(): Promise<AppLockRecord | null> {
  const raw = await SecureStore.getItemAsync(APP_LOCK_KEY, SECURE_STORE_OPTIONS);
  if (raw === null) return null;
  return parseAppLockRecord(raw);
}

async function saveRecord(record: AppLockRecord): Promise<void> {
  await SecureStore.setItemAsync(APP_LOCK_KEY, serializeAppLockRecord(record), SECURE_STORE_OPTIONS);
}

async function digestPin(pin: string, saltHex: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `ciftci-defteri|app-lock|v1|${saltHex}|${pin}`,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
