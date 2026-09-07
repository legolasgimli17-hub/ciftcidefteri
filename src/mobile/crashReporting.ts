import * as Sentry from "@sentry/react-native";
import { isSafeCrashCode, sanitizeCrashEvent } from "../domain/crashPrivacy";

export type CrashCode =
  | "database_init_error"
  | "root_error_boundary"
  | "screen_error_boundary";

let initialized = false;
const alreadyReported = new WeakSet<object>();

export function initializeCrashReporting(): boolean {
  if (initialized) return true;

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (__DEV__ || !dsn) return false;

  Sentry.init({
    dsn,
    enabled: true,
    environment: "production",
    sendDefaultPii: false,
    tracesSampleRate: 0,
    enableAutoSessionTracking: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    beforeSend: (event, hint) => {
      if (hint && Array.isArray((hint as { attachments?: unknown[] }).attachments)) {
        (hint as { attachments: unknown[] }).attachments = [];
      }
      return sanitizeCrashEvent(event as unknown as Record<string, unknown>) as unknown as typeof event;
    }
  });

  Sentry.setUser(null);
  initialized = true;
  return true;
}

export function reportCrash(error: unknown, crashCode: CrashCode): void {
  if (!initialized || !isSafeCrashCode(crashCode)) return;

  if (typeof error === "object" && error !== null) {
    if (alreadyReported.has(error)) return;
    alreadyReported.add(error);
  }

  const reportableError = error instanceof Error ? error : new Error("non_error_throwable");

  Sentry.withScope((scope) => {
    scope.setUser(null);
    scope.setTag("crash_code", crashCode);
    Sentry.captureException(reportableError);
  });
}
