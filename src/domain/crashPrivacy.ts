export type CrashEventRecord = Record<string, unknown>;

const SAFE_TAG_KEYS = new Set([
  "crash_code",
  "environment",
  "platform",
  "release"
]);

const SAFE_CONTEXTS = new Set(["app", "device", "os"]);
const SAFE_STACK_FRAME_KEYS = ["filename", "function", "module", "package", "lineno", "colno", "in_app"] as const;

export function sanitizeCrashEvent<T extends CrashEventRecord>(input: T): T {
  const event: CrashEventRecord = { ...input };

  delete event.user;
  delete event.request;
  delete event.extra;
  delete event.breadcrumbs;
  delete event.transaction;
  delete event.fingerprint;
  delete event.server_name;
  delete event.logentry;
  delete event.logger;
  delete event.culprit;
  delete event.spans;
  delete event.sdkProcessingMetadata;

  if (typeof event.message === "string") {
    event.message = "[redacted]";
  }

  if (isRecord(event.tags)) {
    const tags: CrashEventRecord = {};
    for (const [key, value] of Object.entries(event.tags)) {
      if (SAFE_TAG_KEYS.has(key) && isPrimitive(value)) {
        tags[key] = value;
      }
    }
    event.tags = tags;
  } else {
    delete event.tags;
  }

  if (isRecord(event.contexts)) {
    const contexts: CrashEventRecord = {};
    for (const [key, value] of Object.entries(event.contexts)) {
      if (SAFE_CONTEXTS.has(key) && isRecord(value)) {
        contexts[key] = sanitizeSafeContext(key, value);
      }
    }
    event.contexts = contexts;
  } else {
    delete event.contexts;
  }

  if (isRecord(event.exception) && Array.isArray(event.exception.values)) {
    event.exception = {
      ...event.exception,
      values: event.exception.values.map((value) => sanitizeExceptionValue(value))
    };
  }

  if (isRecord(event.stacktrace)) {
    event.stacktrace = sanitizeStacktrace(event.stacktrace);
  }

  return event as T;
}

export function isSafeCrashCode(value: string): boolean {
  return /^[a-z0-9_]{3,48}$/.test(value);
}

function sanitizeExceptionValue(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const sanitized: CrashEventRecord = { ...value };
  if (typeof sanitized.value === "string") {
    sanitized.value = "[redacted]";
  }
  if (isRecord(sanitized.mechanism)) {
    sanitized.mechanism = {
      handled: sanitized.mechanism.handled,
      type: typeof sanitized.mechanism.type === "string" ? sanitized.mechanism.type : undefined
    };
  }
  if (isRecord(sanitized.stacktrace)) {
    sanitized.stacktrace = sanitizeStacktrace(sanitized.stacktrace);
  }
  return sanitized;
}

function sanitizeStacktrace(value: CrashEventRecord): CrashEventRecord {
  if (!Array.isArray(value.frames)) return {};
  return {
    frames: value.frames.map((frame) => {
      if (!isRecord(frame)) return {};
      return pickPrimitives(frame, SAFE_STACK_FRAME_KEYS);
    })
  };
}

function sanitizeSafeContext(kind: string, value: CrashEventRecord): CrashEventRecord {
  if (kind === "app") {
    return pickPrimitives(value, ["app_identifier", "app_version", "app_build"]);
  }
  if (kind === "device") {
    return pickPrimitives(value, ["arch", "family", "model"]);
  }
  if (kind === "os") {
    return pickPrimitives(value, ["name", "version", "build"]);
  }
  return {};
}

function pickPrimitives(source: CrashEventRecord, keys: readonly string[]): CrashEventRecord {
  const target: CrashEventRecord = {};
  for (const key of keys) {
    const value = source[key];
    if (isPrimitive(value)) target[key] = value;
  }
  return target;
}

function isPrimitive(value: unknown): value is string | number | boolean | null {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isRecord(value: unknown): value is CrashEventRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
