import { Redirect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { LocalFarmRepository } from "@/src/application/localFarmRepository";
import { mobileDatabase } from "@/src/mobile/database";
import { theme } from "@/src/ui/theme";

export default function IndexScreen() {
  const sqlite = useSQLiteContext();
  const [state, setState] = useState<"loading" | "onboarding" | "home" | "error">("loading");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const repository = new LocalFarmRepository(mobileDatabase(sqlite));
        const complete = await repository.hasCompletedOnboarding();
        if (active) setState(complete ? "home" : "onboarding");
      } catch {
        if (active) setState("error");
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [sqlite]);

  if (state === "onboarding") return <Redirect href="/onboarding" />;
  if (state === "home") return <Redirect href="/home" />;

  return (
    <View style={styles.loading}>
      {state === "error" ? (
        <Text style={styles.error}>Defter açılamadı. Uygulamayı kapatıp yeniden aç.</Text>
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
