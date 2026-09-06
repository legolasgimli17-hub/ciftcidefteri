import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { DATABASE_NAME, initializeDatabase } from "@/src/mobile/database";
import { theme } from "@/src/ui/theme";
import { uxPolicy } from "@/src/ui/policy";

export default function RootLayout() {
  const [providerKey, setProviderKey] = useState(0);
  const [databaseError, setDatabaseError] = useState(false);

  const retryDatabase = () => {
    setDatabaseError(false);
    setProviderKey((current) => current + 1);
  };

  return (
    <SafeAreaProvider>
      {databaseError ? (
        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
          <View style={styles.errorScreen}>
            <Text accessibilityRole="header" style={styles.title}>Defter açılamadı</Text>
            <Text accessibilityLiveRegion="polite" style={styles.message}>
              Kayıtlarını silmeden yeniden deneyebilirsin.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Defteri yeniden açmayı dene"
              onPress={retryDatabase}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            >
              <Text style={styles.retryText}>Tekrar dene</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      ) : (
        <SQLiteProvider
          key={`database-provider-${providerKey}`}
          databaseName={DATABASE_NAME}
          onInit={initializeDatabase}
          onError={() => setDatabaseError(true)}
        >
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "fade"
            }}
          />
        </SQLiteProvider>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.color.background },
  errorScreen: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
    backgroundColor: theme.color.background
  },
  title: {
    color: theme.color.text,
    fontSize: theme.type.title,
    fontWeight: "900",
    lineHeight: 38
  },
  message: {
    color: theme.color.textMuted,
    fontSize: theme.type.body,
    lineHeight: 26
  },
  retryButton: {
    minHeight: uxPolicy.primaryActionHeightPx,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: theme.type.button,
    fontWeight: "800"
  },
  pressed: { opacity: 0.86 }
});
