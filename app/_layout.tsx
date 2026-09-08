import { Stack, type ErrorBoundaryProps } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AppLockGate } from "@/src/mobile/AppLockGate";
import { initializeCrashReporting, reportCrash } from "@/src/mobile/crashReporting";
import {
  DATABASE_NAME,
  databaseFailureDetails,
  initializeDatabase,
  isDatabaseReopenRequired,
  type DatabaseFailureDetails
} from "@/src/mobile/database";
import { exportEncryptedDatabaseRecoveryCopy } from "@/src/mobile/databaseRecoveryExport";
import { theme } from "@/src/ui/theme";
import { uxPolicy } from "@/src/ui/policy";

initializeCrashReporting();

interface RecoverySecondaryAction {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled: boolean;
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  reportCrash(error, "root_error_boundary");
  return (
    <SafeAreaProvider>
      <RecoveryScreen
        title="Bir şey ters gitti"
        message="Kayıtların güvende. Bu ekranı yeniden açmayı deneyebilirsin."
        detail={null}
        onRetry={() => void retry()}
        secondaryAction={null}
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
      detail={null}
      onRetry={() => void retry()}
      secondaryAction={null}
    />
  );
}

export default function RootLayout() {
  const [providerKey, setProviderKey] = useState(0);
  const [databaseFailure, setDatabaseFailure] = useState<DatabaseFailureDetails | null>(null);
  const [databaseFailureCount, setDatabaseFailureCount] = useState(0);
  const [recoveryExporting, setRecoveryExporting] = useState(false);
  const [recoveryExportStatus, setRecoveryExportStatus] = useState<string | null>(null);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);

  const retryDatabase = () => {
    setDatabaseFailure(null);
    setRecoveryExportStatus(null);
    setProviderKey((current) => current + 1);
  };

  const exportRecoveryCopy = async () => {
    if (recoveryExporting) return;
    setRecoveryExporting(true);
    setRecoveryExportStatus(null);
    setRecoveryKey(null);
    try {
      const result = await exportEncryptedDatabaseRecoveryCopy();
      setRecoveryKey(result.recoveryKey);
      setRecoveryExportStatus(
        "Şifreli kurtarma kopyası oluşturuldu. Kurtarma anahtarını dosyadan ayrı bir yerde sakla."
      );
    } catch {
      setRecoveryExportStatus(
        "Kurtarma kopyası oluşturulamadı. Uygulamayı silme; kayıtların üzerinde işlem yapılmadı."
      );
    } finally {
      setRecoveryExporting(false);
    }
  };

  const databaseDetail = databaseFailure === null
    ? null
    : [
        `Hata kodu: ${databaseFailure.code}`,
        databaseFailure.diagnosticTag === null
          ? null
          : `Teşhis etiketi: ${databaseFailure.diagnosticTag}`,
        recoveryExportStatus,
        recoveryKey === null ? null : `Kurtarma anahtarı: ${recoveryKey}`
      ].filter((value): value is string => value !== null).join("\n");

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppLockGate>
        {databaseFailure ? (
          <RecoveryScreen
            title="Defter açılamadı"
            message="Kayıtlarını silmeden yeniden deneyebilirsin."
            detail={databaseDetail}
            onRetry={retryDatabase}
            secondaryAction={databaseFailureCount >= 3 ? {
              label: recoveryExporting ? "Kurtarma kopyası hazırlanıyor..." : "Verini dışa aktarmayı dene",
              onPress: () => void exportRecoveryCopy(),
              disabled: recoveryExporting
            } : null}
          />
        ) : (
          <SQLiteProvider
            key={`database-provider-${providerKey}`}
            databaseName={DATABASE_NAME}
            onInit={initializeDatabase}
            onError={(error) => {
              if (isDatabaseReopenRequired(error)) {
                setProviderKey((current) => current + 1);
                return;
              }
              const failure = databaseFailureDetails(error);
              reportCrash(
                error,
                "database_init_error",
                failure.diagnosticTag === null ? undefined : failure.diagnosticTag
              );
              setDatabaseFailureCount((current) => current + 1);
              setDatabaseFailure(failure);
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
  readonly detail: string | null;
  readonly onRetry: () => void;
  readonly secondaryAction: RecoverySecondaryAction | null;
}) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.errorScreen}>
        <Text accessibilityRole="header" style={styles.title}>{props.title}</Text>
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.message}>
          {props.message}
        </Text>
        {props.detail === null ? null : (
          <Text selectable style={styles.detail}>{props.detail}</Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ekranı yeniden açmayı dene"
          onPress={props.onRetry}
          style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
        >
          <Text style={styles.retryText}>Tekrar dene</Text>
        </Pressable>
        {props.secondaryAction === null ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.secondaryAction.label}
            disabled={props.secondaryAction.disabled}
            onPress={props.secondaryAction.onPress}
            style={({ pressed }) => [
              styles.secondaryButton,
              props.secondaryAction?.disabled && styles.disabled,
              pressed && styles.pressed
            ]}
          >
            <Text style={styles.secondaryText}>{props.secondaryAction.label}</Text>
          </Pressable>
        )}
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
  detail: {
    color: theme.color.textMuted,
    fontSize: 15,
    lineHeight: 22
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
  secondaryButton: {
    minHeight: uxPolicy.primaryActionHeightPx,
    borderRadius: theme.radius.md,
    borderWidth: 2,
    borderColor: theme.color.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  secondaryText: {
    color: theme.color.primary,
    fontSize: theme.type.button,
    fontWeight: "800"
  },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.86 }
});
