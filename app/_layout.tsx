import { Stack, type ErrorBoundaryProps } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
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
import {
  archiveCurrentDatabaseForFreshEncryptedStart,
  exportEncryptedDatabaseRecoveryCopy
} from "@/src/mobile/databaseRecoveryExport";
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
        tertiaryAction={null}
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
      tertiaryAction={null}
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
  const [freshStarting, setFreshStarting] = useState(false);
  const [freshStartStatus, setFreshStartStatus] = useState<string | null>(null);

  const retryDatabase = () => {
    setDatabaseFailure(null);
    setRecoveryExportStatus(null);
    setFreshStartStatus(null);
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

  const performFreshStart = async () => {
    if (freshStarting) return;
    setFreshStarting(true);
    setFreshStartStatus(null);
    try {
      const result = await archiveCurrentDatabaseForFreshEncryptedStart();
      setDatabaseFailure(null);
      setRecoveryExportStatus(null);
      setRecoveryKey(null);
      setFreshStartStatus(
        result.archived
          ? "Eski defter cihazda kurtarma dosyası olarak korundu."
          : "Eski defter dosyası bulunamadı; yeni defter hazırlanıyor."
      );
      setProviderKey((current) => current + 1);
    } catch {
      setFreshStartStatus(
        "Eski defter güvenle ayrılamadı. Hiçbir kayıt silinmedi."
      );
    } finally {
      setFreshStarting(false);
    }
  };

  const confirmFreshStart = () => {
    Alert.alert(
      "Yeni defterle açılsın mı?",
      "Eski defter silinmeyecek. Cihazda kurtarma dosyası olarak saklanacak ve uygulama yeni, şifreli bir defterle açılacak.",
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Yeni defterle aç", onPress: () => void performFreshStart() }
      ]
    );
  };

  const databaseDetail = databaseFailure === null
    ? null
    : [
        `Hata kodu: ${databaseFailure.code}`,
        databaseFailure.diagnosticTag === null
          ? null
          : `Teşhis etiketi: ${databaseFailure.diagnosticTag}`,
        freshStartStatus,
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
            message="Eski kayıtlarını silmeden devam edebilirsin."
            detail={databaseDetail}
            onRetry={retryDatabase}
            secondaryAction={databaseFailure.code === "DB-UPGRADE" ? {
              label: freshStarting ? "Yeni defter hazırlanıyor..." : "Eski kaydı koru, yeni defter aç",
              onPress: confirmFreshStart,
              disabled: freshStarting || recoveryExporting
            } : null}
            tertiaryAction={databaseFailureCount >= 3 ? {
              label: recoveryExporting ? "Kurtarma kopyası hazırlanıyor..." : "Verini dışa aktarmayı dene",
              onPress: () => void exportRecoveryCopy(),
              disabled: recoveryExporting || freshStarting
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
  readonly tertiaryAction: RecoverySecondaryAction | null;
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
        <RecoveryActionButton action={props.secondaryAction} />
        <RecoveryActionButton action={props.tertiaryAction} />
      </View>
    </SafeAreaView>
  );
}

function RecoveryActionButton(props: { readonly action: RecoverySecondaryAction | null }) {
  if (props.action === null) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.action.label}
      disabled={props.action.disabled}
      onPress={props.action.onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        props.action?.disabled && styles.disabled,
        pressed && styles.pressed
      ]}
    >
      <Text style={styles.secondaryText}>{props.action.label}</Text>
    </Pressable>
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
    fontWeight: "800",
    textAlign: "center"
  },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.86 }
});
