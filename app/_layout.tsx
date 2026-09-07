import { Stack, type ErrorBoundaryProps } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AppLockGate } from "@/src/mobile/AppLockGate";
import { initializeCrashReporting, reportCrash } from "@/src/mobile/crashReporting";
import { DATABASE_NAME, initializeDatabase } from "@/src/mobile/database";
import { theme } from "@/src/ui/theme";
import { uxPolicy } from "@/src/ui/policy";

initializeCrashReporting();

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  reportCrash(error, "root_error_boundary");
  return (
    <SafeAreaProvider>
      <RecoveryScreen
        title="Bir şey ters gitti"
        message="Kayıtların güvende. Bu ekranı yeniden açmayı deneyebilirsin."
        onRetry={() => void retry()}
      />
    </SafeAreaProvider>
  );
}

function ScreenErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  reportCrash(error, "screen_error_boundary");
  return (
    <RecoveryScreen
      title="Bu ekran açılamadı"
      message="Kayıtların güvende. Yeniden deneyebilirsin."
      onRetry={() => void retry()}
    />
  );
}

export default function RootLayout() {
  const [providerKey, setProviderKey] = useState(0);
  const [databaseError, setDatabaseError] = useState(false);

  const retryDatabase = () => {
    setDatabaseError(false);
    setProviderKey((current) => current + 1);
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppLockGate>
        {databaseError ? (
          <RecoveryScreen
            title="Defter açılamadı"
            message="Kayıtlarını silmeden yeniden deneyebilirsin."
            onRetry={retryDatabase}
          />
        ) : (
          <SQLiteProvider
            key={`database-provider-${providerKey}`}
            databaseName={DATABASE_NAME}
            onInit={initializeDatabase}
            onError={(error) => {
              reportCrash(error, "database_init_error");
              setDatabaseError(true);
            }}
          >
            <Stack
              unstable_screenErrorBoundary={ScreenErrorBoundary}
              screenOptions={{
                headerShown: false,
                animation: "fade"
              }}
            />
          </SQLiteProvider>
        )}
      </AppLockGate>
    </SafeAreaProvider>
  );
}

function RecoveryScreen(props: {
  readonly title: string;
  readonly message: string;
  readonly onRetry: () => void;
}) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.errorScreen}>
        <Text accessibilityRole="header" style={styles.title}>{props.title}</Text>
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.message}>
          {props.message}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ekranı yeniden açmayı dene"
          onPress={props.onRetry}
          style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
        >
          <Text style={styles.retryText}>Tekrar dene</Text>
        </Pressable>
      </View>
    </SafeAreaView>
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
