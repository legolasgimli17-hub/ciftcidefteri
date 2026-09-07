import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/mobile/crashReporting.ts', 'utf8');
const appConfig = fs.readFileSync('app.json', 'utf8');
const packageJson = fs.readFileSync('package.json', 'utf8');

assert.match(packageJson, /"@sentry\/react-native"\s*:\s*"8\.18\.0"/, 'Sentry SDK must stay pinned to the reviewed stable release');
assert.match(appConfig, /"@sentry\/react-native"/, 'Expo Sentry config plugin must stay enabled');

assert.match(source, /EXPO_PUBLIC_SENTRY_DSN/, 'runtime DSN must come from the build environment');
assert.doesNotMatch(source, /https:\/\/[^\s"']+@[^\s"']+sentry/i, 'never commit a concrete Sentry DSN');
assert.match(source, /sendDefaultPii:\s*false/, 'default PII collection must stay disabled');
assert.match(source, /tracesSampleRate:\s*0/, 'performance tracing must stay disabled in P0');
assert.match(source, /enableAutoSessionTracking:\s*false/, 'automatic Sentry sessions must stay disabled in P0');
assert.match(source, /attachScreenshot:\s*false/, 'crash screenshots must stay disabled');
assert.match(source, /attachViewHierarchy:\s*false/, 'view hierarchy capture must stay disabled');
assert.match(source, /maxBreadcrumbs:\s*0/, 'automatic breadcrumbs must stay disabled');
assert.match(source, /beforeBreadcrumb:\s*\(\)\s*=>\s*null/, 'breadcrumbs must be rejected before send');
assert.match(source, /sanitizeCrashEvent/, 'every outgoing JS event must pass the privacy scrubber');
assert.match(source, /Sentry\.setUser\(null\)/, 'global Sentry user identity must stay empty');
assert.doesNotMatch(source, /replayIntegration|mobileReplayIntegration|sessionReplay/i, 'session replay is forbidden for financial data');
assert.doesNotMatch(source, /setUser\(\s*\{/, 'do not attach user identity to crash reports');

console.log('Crash privacy check passed: crash reporting stays minimal and finance-safe.');
