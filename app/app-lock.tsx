import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { normalizeAppLockPin, remainingAppLockSeconds } from "@/src/domain/appLock";
import { disableAppLock, enableAppLock, readAppLockStatus } from "@/src/mobile/appLockStore";
import { BigButton, Card, ErrorNote, Field, PageTitle, Screen, SecondaryButton } from "@/src/ui/components";
import { theme } from "@/src/ui/theme";

export default function AppLockScreen() {
  const params = useLocalSearchParams<{ from?: string | string[] }>();
  const from = Array.isArray(params.from) ? params.from[0] : params.from;
  const fromOnboarding = from === "onboarding";
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const status = await readAppLockStatus();
      setEnabled(status.enabled);
      setError(undefined);
    } catch {
      setEnabled(null);
      setError("Uygulama kilidi durumunu şu an okuyamadık. Tekrar deneyebilirsin.");
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

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

  const turnOn = async () => {
    let normalized: string;
    try {
      normalized = normalizeAppLockPin(pin);
    } catch {
      setError("PIN 6 rakamdan oluşmalı.");
      return;
    }
    if (normalized !== confirmPin.trim()) {
      setError("İki PIN aynı değil. Tekrar kontrol et.");
      return;
    }

    await runExclusive(async () => {
      try {
        await enableAppLock(normalized);
        setPin("");
        setConfirmPin("");
        setEnabled(true);
        if (fromOnboarding) router.replace("/home");
      } catch {
        setError("Uygulama kilidini şu an açamadık. Kayıtların değişmedi; tekrar deneyebilirsin.");
      }
    });
  };

  const turnOff = async () => {
    if (currentPin.length !== 6) {
      setError("Mevcut 6 haneli PIN'ini gir.");
      return;
    }
    await runExclusive(async () => {
      try {
        const nowMs = Date.now();
        const result = await disableAppLock(currentPin, nowMs);
        if (result.status === "blocked") {
          const seconds = remainingAppLockSeconds(result.blockedUntilMs, nowMs);
          setCurrentPin("");
          setError(`${seconds} saniye sonra tekrar deneyebilirsin.`);
          return;
        }
        if (result.status === "invalid") {
          setCurrentPin("");
          setError(result.blockedUntilMs > nowMs
            ? "Çok fazla yanlış deneme oldu. Biraz sonra tekrar dene."
            : "PIN doğru değil. Tekrar deneyebilirsin.");
          return;
        }
        setCurrentPin("");
        setEnabled(false);
      } catch {
        setCurrentPin("");
        setError("Kilidi şu an kapatamadık. Tekrar deneyebilirsin.");
      }
    });
  };

  const askTurnOff = () => {
    if (busyRef.current) return;
    Alert.alert(
      "Uygulama kilidi kapatılsın mı?",
      "Telefonu eline alan biri uygulamayı tekrar PIN sormadan açabilir.",
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Kilidi kapat", style: "destructive", onPress: () => void turnOff() }
      ]
    );
  };

  return (
    <Screen>
      <PageTitle hint={fromOnboarding
        ? "İstersen defterini 6 haneli PIN ile koru. Bu adımı şimdi geçebilirsin."
        : "Telefon açık kalsa bile finansal kayıtların doğrudan görünmesin."}
      >
        Uygulama kilidi
      </PageTitle>

      {enabled === null ? (
        <Card tone="soft">
          <Text style={styles.body}>Kilit durumu kontrol ediliyor…</Text>
        </Card>
      ) : null}

      {enabled === false ? (
        <>
          <Card tone="soft">
            <Text style={styles.title}>Kilit kapalı</Text>
            <Text style={styles.body}>
              Kilidi açarsan uygulama açılırken PIN ister. PIN telefonunda güvenli alanda saklanan doğrulama bilgisiyle kontrol edilir.
            </Text>
            <Text style={styles.warning}>
              PIN'ini unutursan uygulama içinden atlatma yolu yoktur. Şifreli yedeğini ve kurtarma anahtarını ayrı yerde saklaman iyi olur.
            </Text>
          </Card>
          <Field
            label="6 haneli PIN"
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            value={pin}
            onChangeText={(value) => setPin(value.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder="••••••"
          />
          <Field
            label="PIN'i tekrar yaz"
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            value={confirmPin}
            onChangeText={(value) => setConfirmPin(value.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder="••••••"
          />
          <ErrorNote message={error} />
          <BigButton
            label={busy ? "Açılıyor…" : "Uygulama kilidini aç"}
            icon="✓"
            disabled={busy}
            onPress={() => void turnOn()}
          />
          {fromOnboarding ? (
            <SecondaryButton label="Şimdi değil" disabled={busy} onPress={() => router.replace("/home")} />
          ) : (
            <SecondaryButton label="Daha'ya dön" disabled={busy} onPress={() => router.replace("/more")} />
          )}
        </>
      ) : null}

      {enabled === true ? (
        <>
          <Card tone="soft">
            <Text style={styles.title}>Kilit açık</Text>
            <Text style={styles.body}>
              Uygulama yeniden açıldığında veya arka plana gittiğinde finansal ekranlar PIN girilene kadar gösterilmez.
            </Text>
          </Card>
          <Field
            label="Mevcut PIN"
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            value={currentPin}
            onChangeText={(value) => setCurrentPin(value.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder="••••••"
          />
          <ErrorNote message={error} />
          <BigButton
            label={busy ? "Kontrol ediliyor…" : "Uygulama kilidini kapat"}
            icon="−"
            kind="expense"
            disabled={busy}
            onPress={askTurnOff}
          />
          <SecondaryButton label="Daha'ya dön" disabled={busy} onPress={() => router.replace("/more")} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: theme.color.text, fontSize: 17, fontWeight: "900" },
  body: { color: theme.color.textMuted, fontSize: 14, fontWeight: "600", lineHeight: 21 },
  warning: { color: theme.color.warning, fontSize: 13, fontWeight: "700", lineHeight: 19 }
});
