import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { createRetryableSingleFlight } from "../storage/retryableSingleFlight";

const DATABASE_KEY_NAME = "ciftcidefteri.database.key.v1";
const DATABASE_KEY_SERVICE = "app.ciftcidefteri.database";
const DATABASE_KEY_BYTES = 32;
const DATABASE_KEY_HEX_LENGTH = DATABASE_KEY_BYTES * 2;

export function assertDatabaseKeyHex(value: string): string {
  if (value.length !== DATABASE_KEY_HEX_LENGTH || !/^[0-9a-f]+$/i.test(value)) {
    throw new Error("Yerel veri anahtarı geçersiz. Veritabanı güvenli şekilde açılamadı.");
  }
  return value.toLowerCase();
}

export function sqlCipherKeyPragma(keyHex: string): string {
  const safeHex = assertDatabaseKeyHex(keyHex);
  return `PRAGMA key = "x'${safeHex}'";`;
}

export const getOrCreateDatabaseKeyHex = createRetryableSingleFlight(loadOrCreateDatabaseKeyHex);

async function loadOrCreateDatabaseKeyHex(): Promise<string> {
  if (!(await SecureStore.isAvailableAsync())) {
    throw new Error("Bu cihazda güvenli anahtar deposu kullanılamıyor.");
  }

  const options: SecureStore.SecureStoreOptions = {
    keychainService: DATABASE_KEY_SERVICE,
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  };

  const existing = await SecureStore.getItemAsync(DATABASE_KEY_NAME, options);
  if (existing !== null) {
    return assertDatabaseKeyHex(existing);
  }

  const bytes = await Crypto.getRandomBytesAsync(DATABASE_KEY_BYTES);
  const generated = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  const keyHex = assertDatabaseKeyHex(generated);

  await SecureStore.setItemAsync(DATABASE_KEY_NAME, keyHex, options);
  const persisted = await SecureStore.getItemAsync(DATABASE_KEY_NAME, options);
  if (persisted === null || assertDatabaseKeyHex(persisted) !== keyHex) {
    throw new Error("Yerel veri anahtarı güvenli depoya yazılamadı.");
  }

  return keyHex;
}
