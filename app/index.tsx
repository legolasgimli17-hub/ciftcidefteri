import { Redirect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { LocalFarmRepository } from "@/src/application/localFarmRepository";
import { mobileDatabase } from "@/src/mobile/database";
import { BigButton } from "@/src/ui/components";
import { theme } from "@/src/ui/theme";

export default function IndexScreen() {
  const sqlite = useSQLiteContext();
  const [state, setState] = useState<"loading" | "onboarding" | "home" | "error">("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const repository = new LocalFarmRepository(mobileDatabase(sqlite));
      const complete = await repository.hasCompletedOnboarding();
      setState(complete ? "home" : "onboarding");
    } catch {
      setState("error");
    }
  }, [sqlite]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const repository = new LocalFarmRepository(mobileDatabase(sqlite));
        const complete = await repository.hasCompletedOnboarding();
        if (active) setState(complete ? "home" : "onboarding");
      } catch {
        if (active) setState("error");
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [sqlite]);

  if (state === "onboarding") return <Redirect href="/onboarding" />;
  if (state === "home") return <Redirect href="/home" />;

  return (
    <View style={styles.loading}>
      {state === "error" ? (
        <>
          <Text accessibilityRole="alert" style={styles.error}>
            Defter açılamadı. Kayıtların silinmedi.
          </Text>
          <BigButton label="Tekrar dene" icon="↻" onPress={() => void load()} />
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={theme.color.primary} />
          <Text style={styles.text}>Defterin hazırlanıyor…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 28,
    backgroundColor: theme.color.background
  },
  text: { color: theme.color.text, fontSize: 18, fontWeight: "700" },
  error: { color: theme.color.expense, fontSize: 18, fontWeight: "700", textAlign: "center" }
});
