import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync
} from "expo-crypto";
import {
  assertPayloadMatchesEnvelope,
  backupAuthenticatedData,
  createEncryptedBackupHeader,
  normalizeRecoveryKey,
  parseBackupPayload,
  parseEncryptedBackupEnvelope,
  serializeEncryptedBackupEnvelope,
  type BackupPayload
} from "../domain/backup";
import { SCHEMA_VERSION } from "../storage/schemaText";

export interface EncryptedBackupResult {
  readonly fileText: string;
  readonly recoveryKey: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function encryptBackupPayload(payload: BackupPayload): Promise<EncryptedBackupResult> {
  if (payload.sourceSchemaVersion !== SCHEMA_VERSION) {
    throw new Error("Güncel olmayan veri yedeklenemez.");
  }

  const header = createEncryptedBackupHeader({
    sourceSchemaVersion: payload.sourceSchemaVersion,
    createdAt: payload.createdAt
  });
  const key = await AESEncryptionKey.generate();
  const sealed = await aesEncryptAsync(encoder.encode(JSON.stringify(payload)), key, {
    additionalData: encoder.encode(backupAuthenticatedData(header)),
    tagLength: 16
  });
  const sealedDataBase64 = await sealed.combined("base64");
  const recoveryKey = await key.encoded("hex");
  if (typeof sealedDataBase64 !== "string" || typeof recoveryKey !== "string") {
    throw new Error("Yedek şifrelenemedi.");
  }

  return {
    fileText: serializeEncryptedBackupEnvelope({ ...header, sealedDataBase64 }),
    recoveryKey: normalizeRecoveryKey(recoveryKey)
  };
}

export async function decryptBackupFile(
  fileText: string,
  recoveryKeyInput: string
): Promise<BackupPayload> {
  const envelope = parseEncryptedBackupEnvelope(fileText, SCHEMA_VERSION);
  const recoveryKey = normalizeRecoveryKey(recoveryKeyInput);
  const key = await AESEncryptionKey.import(recoveryKey, "hex");
  const sealed = AESSealedData.fromCombined(envelope.sealedDataBase64);

  let plaintext: string | Uint8Array;
  try {
    plaintext = await aesDecryptAsync(sealed, key, {
      additionalData: encoder.encode(backupAuthenticatedData(envelope)),
      output: "bytes"
    });
  } catch {
    throw new Error("Kurtarma anahtarı bu yedekle eşleşmiyor veya dosya bozulmuş.");
  }
  if (typeof plaintext === "string") {
    throw new Error("Yedek içeriği beklenen biçimde çözülemedi.");
  }

  const payload = parseBackupPayload(decoder.decode(plaintext), SCHEMA_VERSION);
  assertPayloadMatchesEnvelope(payload, envelope);
  return payload;
}
