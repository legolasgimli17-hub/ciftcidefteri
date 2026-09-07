import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { MAX_BACKUP_FILE_BYTES } from "../domain/backup";

export interface PickedBackupFile {
  readonly name: string;
  readonly text: string;
}

export function writeEncryptedBackupFile(fileText: string, createdAt: string): File {
  if (new TextEncoder().encode(fileText).byteLength > MAX_BACKUP_FILE_BYTES) {
    throw new Error("Yedek dosyası paylaşım sınırını aşıyor.");
  }
  const date = createdAt.slice(0, 10);
  const file = new File(Paths.cache, `ciftci-defteri-yedek-${date}.cdyedek`);
  file.create({ overwrite: true });
  file.write(fileText);
  if (!file.exists || file.size <= 0 || file.size > MAX_BACKUP_FILE_BYTES) {
    throw new Error("Yedek dosyası güvenli biçimde oluşturulamadı.");
  }
  return file;
}

export async function shareEncryptedBackupFile(file: File): Promise<void> {
  if (!file.exists || file.size <= 0 || file.size > MAX_BACKUP_FILE_BYTES) {
    throw new Error("Paylaşılacak yedek dosyası bulunamadı.");
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Bu telefonda dosya paylaşımı kullanılamıyor.");
  }
  await Sharing.shareAsync(file.uri, {
    dialogTitle: "Şifreli Çiftçi Defteri yedeğini paylaş",
    mimeType: "application/octet-stream"
  });
}

export async function pickEncryptedBackupFile(): Promise<PickedBackupFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: "*/*"
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (asset === undefined) {
    throw new Error("Yedek dosyası seçilemedi.");
  }
  if (typeof asset.size === "number" && asset.size > MAX_BACKUP_FILE_BYTES) {
    throw new Error("Seçilen yedek dosyası çok büyük.");
  }

  const file = new File(asset.uri);
  if (!file.exists || file.size <= 0 || file.size > MAX_BACKUP_FILE_BYTES) {
    throw new Error("Seçilen yedek dosyası okunamadı veya çok büyük.");
  }
  const text = await file.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_FILE_BYTES) {
    throw new Error("Seçilen yedek dosyası çok büyük.");
  }
  return { name: asset.name || "Çiftçi Defteri yedeği", text };
}
