import {
  AESEncryptionKey,
  aesEncryptAsync
} from "expo-crypto";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

const RECOVERY_FORMAT = "ciftci-defteri-db-recovery-v1";
const LEGACY_BACKUP_SUFFIX = ".legacy-plaintext-v03";
const MAX_RECOVERY_DATABASE_BYTES = 64 * 1024 * 1024;
const encoder = new TextEncoder();

let lastDatabasePath: string | null = null;

export interface DatabaseRecoveryExportResult {
  readonly recoveryKey: string;
  readonly sourceKind: "legacy-plaintext-backup" | "current-database";
}

export function rememberDatabasePathForRecovery(databasePath: string): void {
  if (databasePath.trim().length > 0) lastDatabasePath = databasePath;
}

export async function exportEncryptedDatabaseRecoveryCopy(): Promise<DatabaseRecoveryExportResult> {
  if (lastDatabasePath === null) {
    throw new Error("Kurtarma için veritabanı yolu bulunamadı.");
  }

  const backupFile = new File(`${lastDatabasePath}${LEGACY_BACKUP_SUFFIX}`);
  const mainFile = new File(lastDatabasePath);
  const sourceFile = backupFile.exists && backupFile.size > 0 ? backupFile : mainFile;
  const sourceKind = sourceFile === backupFile
    ? "legacy-plaintext-backup" as const
    : "current-database" as const;

  if (!sourceFile.exists || sourceFile.size <= 0) {
    throw new Error("Dışa aktarılabilecek kurtarma verisi bulunamadı.");
  }
  if (sourceFile.size > MAX_RECOVERY_DATABASE_BYTES) {
    throw new Error("Kurtarma verisi bu cihazda güvenli biçimde dışa aktarılamayacak kadar büyük.");
  }

  const sourceBytes = await sourceFile.bytes();
  if (sourceBytes.byteLength <= 0 || sourceBytes.byteLength > MAX_RECOVERY_DATABASE_BYTES) {
    throw new Error("Kurtarma verisi güvenli biçimde okunamadı.");
  }

  const key = await AESEncryptionKey.generate();
  const sealed = await aesEncryptAsync(sourceBytes, key, {
    additionalData: encoder.encode(RECOVERY_FORMAT),
    tagLength: 16
  });
  const sealedDataBase64 = await sealed.combined("base64");
  const recoveryKey = await key.encoded("hex");
  if (typeof sealedDataBase64 !== "string" || typeof recoveryKey !== "string") {
    throw new Error("Kurtarma kopyası şifrelenemedi.");
  }

  const envelope = JSON.stringify({
    format: RECOVERY_FORMAT,
    version: 1,
    createdAt: new Date().toISOString(),
    sourceKind,
    sealedDataBase64
  });
  const outputFile = new File(
    Paths.cache,
    `ciftci-defteri-kurtarma-${Date.now()}.cdrecover`
  );
  outputFile.create({ overwrite: true });
  outputFile.write(envelope);
  if (!outputFile.exists || outputFile.size <= 0) {
    throw new Error("Kurtarma dosyası oluşturulamadı.");
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Bu telefonda dosya paylaşımı kullanılamıyor.");
  }
  await Sharing.shareAsync(outputFile.uri, {
    dialogTitle: "Şifreli Çiftçi Defteri kurtarma kopyasını paylaş",
    mimeType: "application/octet-stream"
  });

  return {
    recoveryKey: recoveryKey.toUpperCase(),
    sourceKind
  };
}
