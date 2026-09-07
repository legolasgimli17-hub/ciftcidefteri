import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { type File } from "expo-file-system";
import { useRef, useState } from "react";
import { Alert, Share, StyleSheet, Text, View } from "react-native";
import {
  createBackupPayload,
  restoreBackupPayload,
  validateBackupTableLayout
} from "@/src/application/localBackupRepository";
import { formatRecoveryKey, type BackupPayload } from "@/src/domain/backup";
import { mobileDatabase } from "@/src/mobile/database";
import { decryptBackupFile, encryptBackupPayload } from "@/src/mobile/backupCrypto";
import {
  pickEncryptedBackupFile,
  shareEncryptedBackupFile,
  writeEncryptedBackupFile,
  type PickedBackupFile
} from "@/src/mobile/backupFile";
import { BigButton, Card, ErrorNote, Field, PageTitle, Screen, SecondaryButton, SectionTitle } from "@/src/ui/components";
import { theme } from "@/src/ui/theme";

interface GeneratedBackup {
  readonly file: File;
  readonly recoveryKey: string;
  readonly createdAt: string;
}

export default function BackupScreen() {
  const sqlite = useSQLiteContext();
  const [generated, setGenerated] = useState<GeneratedBackup | null>(null);
  const [picked, setPicked] = useState<PickedBackupFile | null>(null);
  const [recoveryKey, setRecoveryKey] = useState("");
  const [preview, setPreview] = useState<BackupPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const busyRef = useRef(false);

  const runExclusive = async (work: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await work();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const createBackup = async () => {
    await runExclusive(async () => {
      try {
        const createdAt = new Date().toISOString();
        const payload = await createBackupPayload(mobileDatabase(sqlite), createdAt);
        const encrypted = await encryptBackupPayload(payload);
        const file = writeEncryptedBackupFile(encrypted.fileText, createdAt);
        setGenerated({ file, recoveryKey: encrypted.recoveryKey, createdAt });
      } catch {
        setError("Şifreli yedeği şu an oluşturamadık. Kayıtların değişmedi; tekrar deneyebilirsin.");
      }
    });
  };

  const shareBackup = async () => {
    if (generated === null) return;
    await runExclusive(async () => {
      try {
        await shareEncryptedBackupFile(generated.file);
      } catch {
        setError("Yedek dosyasını paylaşamadık. Dosyayı yeniden oluşturup tekrar deneyebilirsin.");
      }
    });
  };

  const shareKey = async () => {
    if (generated === null) return;
    await runExclusive(async () => {
      try {
        await Share.share({
          message: [
            "Çiftçi Defteri yedek kurtarma anahtarı",
            formatRecoveryKey(generated.recoveryKey),
            "Bu anahtarı yedek dosyasından ayrı bir yerde sakla."
          ].join("\n\n")
        });
      } catch {
        setError("Kurtarma anahtarını paylaşamadık. Ekrandaki anahtarı güvenli bir yere kaydedebilirsin.");
      }
    });
  };

  const chooseBackup = async () => {
    await runExclusive(async () => {
      try {
        const selected = await pickEncryptedBackupFile();
        if (selected === null) return;
        setPicked(selected);
        setPreview(null);
        setRecoveryKey("");
      } catch {
        setError("Yedek dosyasını açamadık. Başka bir Çiftçi Defteri yedeği seçebilirsin.");
      }
    });
  };

  const checkBackup = async () => {
    if (picked === null || recoveryKey.trim().length === 0) {
      setError("Yedek dosyasını ve kurtarma anahtarını birlikte seçmelisin.");
      return;
    }
    await runExclusive(async () => {
      try {
        const payload = await decryptBackupFile(picked.text, recoveryKey);
        validateBackupTableLayout(payload);
        setPreview(payload);
      } catch {
        setPreview(null);
        setError("Yedeği doğrulayamadık. Dosya bozulmuş olabilir veya kurtarma anahtarı eşleşmiyor.");
      }
    });
  };

  const askRestore = () => {
    if (preview === null || busyRef.current) return;
    Alert.alert(
      "Bu yedek geri yüklensin mi?",
      "Bu telefondaki mevcut Çiftçi Defteri kayıtlarının yerine seçtiğin yedek gelecek. İşlem yarıda kalırsa mevcut kayıtların korunur.",
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Geri yükle", style: "destructive", onPress: () => void restorePreview() }
      ]
    );
  };

  const restorePreview = async () => {
    if (preview === null) return;
    await runExclusive(async () => {
      try {
        await restoreBackupPayload(mobileDatabase(sqlite), preview);
        setPicked(null);
        setPreview(null);
        setRecoveryKey("");
        Alert.alert(
          "Yedek geri yüklendi",
          "Kayıtların bu telefona güvenli biçimde geri geldi.",
          [{ text: "Defteri aç", onPress: () => router.replace("/home") }]
        );
      } catch {
        setError("Yedeği geri yükleyemedik. Bu telefondaki mevcut kayıtların değiştirilmedi.");
      }
    });
  };

  const totalRows = preview?.tables.reduce((total, table) => total + table.rows.length, 0) ?? 0;

  return (
    <Screen>
      <PageTitle hint="Kayıtlarını şifreli bir dosyada sakla ve gerektiğinde geri getir.">Yedekleme</PageTitle>

      <Card tone="soft">
        <Text style={styles.cardTitle}>Yedeğin şifreli kalır</Text>
        <Text style={styles.body}>
          Yedek dosyasını WhatsApp, e-posta veya Dosyalar ile taşıyabilirsin. Dosya tek başına açılamaz.
        </Text>
      </Card>

      <BigButton
        label={busy ? "Hazırlanıyor…" : "Şifreli yedek oluştur"}
        icon="↑"
        disabled={busy}
        onPress={() => void createBackup()}
      />

      {generated !== null ? (
        <Card>
          <Text accessibilityRole="header" style={styles.cardTitle}>Kurtarma anahtarın</Text>
          <Text style={styles.body}>
            Bu anahtar olmadan yedek açılamaz. Yedek dosyasıyla aynı yerde saklama.
          </Text>
          <Text selectable accessibilityLabel="Yedek kurtarma anahtarı" style={styles.key}>
            {formatRecoveryKey(generated.recoveryKey)}
          </Text>
          <SecondaryButton label="Yedek dosyasını paylaş" disabled={busy} onPress={() => void shareBackup()} />
          <SecondaryButton label="Kurtarma anahtarını ayrı paylaş" disabled={busy} onPress={() => void shareKey()} />
        </Card>
      ) : null}

      <SectionTitle>Yedeği geri yükle</SectionTitle>
      <Text style={styles.body}>Başka bir telefondan veya daha önce oluşturduğun şifreli yedeği seçebilirsin.</Text>
      <SecondaryButton label={picked === null ? "Yedek dosyası seç" : "Başka yedek seç"} disabled={busy} onPress={() => void chooseBackup()} />
      {picked !== null ? <Text style={styles.selected}>Seçilen: {picked.name}</Text> : null}

      {picked !== null ? (
        <>
          <Field
            label="Kurtarma anahtarı"
            hint="Yedek oluştururken verilen anahtar"
            value={recoveryKey}
            onChangeText={(value) => {
              setRecoveryKey(value);
              setPreview(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            maxLength={96}
            placeholder="xxxx-xxxx-xxxx-…"
          />
          <SecondaryButton label={busy ? "Kontrol ediliyor…" : "Yedeği kontrol et"} disabled={busy} onPress={() => void checkBackup()} />
        </>
      ) : null}

      {preview !== null ? (
        <Card tone="soft">
          <Text style={styles.cardTitle}>Yedek hazır</Text>
          <Text style={styles.body}>Yedek tarihi: {formatBackupDate(preview.createdAt)}</Text>
          <Text style={styles.body}>Kaynak kayıt sayısı: {totalRows}</Text>
          <BigButton label={busy ? "Geri yükleniyor…" : "Bu yedeği geri yükle"} icon="↺" kind="expense" disabled={busy} onPress={askRestore} />
        </Card>
      ) : null}

      <ErrorNote message={error} />
      <SecondaryButton label="Daha'ya dön" disabled={busy} onPress={() => router.replace("/more")} />
    </Screen>
  );
}

function formatBackupDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return year && month && day ? `${day}.${month}.${year}` : "Bilinmiyor";
}

const styles = StyleSheet.create({
  cardTitle: { color: theme.color.text, fontSize: 17, fontWeight: "900" },
  body: { color: theme.color.textMuted, fontSize: 14, fontWeight: "600", lineHeight: 21 },
  key: {
    color: theme.color.text,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 24,
    letterSpacing: 0.3
  },
  selected: { color: theme.color.text, fontSize: 14, fontWeight: "700" }
});
