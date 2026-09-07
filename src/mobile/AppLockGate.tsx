import { type PropsWithChildren, useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { remainingAppLockSeconds } from "../domain/appLock";
import { readAppLockStatus, verifyAppLockPin } from "./appLockStore";
import { theme } from "../ui/theme";
import { uxPolicy } from "../ui/policy";

export function AppLockGate({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string>();
  const [blockedUntilMs, setBlockedUntilMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [checking, setChecking] = useState(false);
  const enabledRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await readAppLockStatus();
      enabledRef.current = status.enabled;
      setEnabled(status.enabled);
      setBlockedUntilMs(status.blockedUntilMs);
      if (!status.enabled) setUnlocked(true);
    } catch {
      enabledRef.current = true;
      setEnabled(true);
      setUnlocked(false);
      setError("Uygulama kilidi şu an okunamadı. Tekrar deneyebilirsin.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previous = appStateRef.current;
      appStateRef.current = nextState;
      if (nextState !== "active" && enabledRef.current) {
        setUnlocked(false);
        setPin("");
        setError(undefined);
      }
      if (nextState === "active" && previous !== "active") {
        setNowMs(Date.now());
        void refreshStatus();
      }
    });
    return () => subscription.remove();
  }, [refreshStatus]);

  useEffect(() => {
    if (blockedUntilMs <= nowMs) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [blockedUntilMs, nowMs]);

  const unlock = async () => {
    if (checking || pin.length !== 6) return;
    setChecking(true);
    setError(undefined);
    try {
      const currentNow = Date.now();
      setNowMs(currentNow);
      const result = await verifyAppLockPin(pin, currentNow);
      if (result.status === "ok") {
        setPin("");
        setBlockedUntilMs(0);
        setUnlocked(true);
        return;
      }
      setBlockedUntilMs(result.blockedUntilMs);
      setPin("");
      setError(result.blockedUntilMs > currentNow
        ? "Çok fazla yanlış deneme oldu. Biraz sonra tekrar dene."
        : "PIN doğru değil. Tekrar deneyebilirsin.");
    } catch {
      setPin("");
      setError("Kilidi şu an doğrulayamadık. Tekrar deneyebilirsin.");
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return <LockShell title="Defter hazırlanıyor" message="Güvenlik kontrolü yapılıyor." />;
  }

  if (!enabled || unlocked) return <>{children}</>;

  const remainingSeconds = remainingAppLockSeconds(blockedUntilMs, nowMs);
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.screen}>
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.title}>Defter kilitli</Text>
          <Text style={styles.message}>6 haneli PIN'ini gir. Finansal kayıtların kilit açılmadan gösterilmez.</Text>
        </View>

        <TextInput
          accessibilityLabel="Uygulama kilidi PIN'i"
          autoFocus
          autoCorrect={false}
          keyboardType="number-pad"
          maxLength={6}
          onChangeText={(value) => {
            setPin(value.replace(/[^0-9]/g, "").slice(0, 6));
            setError(undefined);
          }}
          onSubmitEditing={() => void unlock()}
          placeholder="••••••"
          placeholderTextColor={theme.color.textSubtle}
          secureTextEntry
          style={styles.pin}
          value={pin}
        />

        {remainingSeconds > 0 ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.warning}>
            {remainingSeconds} saniye sonra tekrar deneyebilirsin.
          </Text>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Defteri aç"
          accessibilityState={{ disabled: checking || pin.length !== 6 || remainingSeconds > 0 }}
          disabled={checking || pin.length !== 6 || remainingSeconds > 0}
          onPress={() => void unlock()}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.pressed,
            (checking || pin.length !== 6 || remainingSeconds > 0) && styles.disabled
          ]}
        >
          <Text style={styles.buttonText}>{checking ? "Kontrol ediliyor…" : "Defteri aç"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function LockShell(props: { readonly title: string; readonly message: string }) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.screen}>
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.title}>{props.title}</Text>
          <Text style={styles.message}>{props.message}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.color.background },
  screen: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 18,
    backgroundColor: theme.color.background
  },
  copy: { gap: 8 },
  title: { color: theme.color.text, fontSize: 32, fontWeight: "900", letterSpacing: -0.7 },
  message: { color: theme.color.textMuted, fontSize: 16, fontWeight: "600", lineHeight: 23 },
  pin: {
    minHeight: 62,
    borderWidth: 1,
    borderColor: theme.color.borderStrong,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    color: theme.color.text,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 8,
    paddingHorizontal: 18,
    textAlign: "center"
  },
  warning: { color: theme.color.warning, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  error: { color: theme.color.expense, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  button: {
    minHeight: uxPolicy.primaryActionHeightPx,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20
  },
  buttonText: { color: theme.color.white, fontSize: theme.type.button, fontWeight: "900" },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.45 }
});
