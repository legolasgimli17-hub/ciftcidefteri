import fs from "node:fs";
import path from "node:path";

const REQUIRED_BLOCKED_PERMISSIONS = [
  "android.permission.CAMERA",
  "android.permission.RECORD_AUDIO",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_BACKGROUND_LOCATION",
  "android.permission.READ_CONTACTS",
  "android.permission.WRITE_CONTACTS",
  "android.permission.GET_ACCOUNTS",
  "android.permission.READ_PHONE_STATE",
  "android.permission.READ_PHONE_NUMBERS",
  "android.permission.CALL_PHONE",
  "android.permission.READ_CALL_LOG",
  "android.permission.WRITE_CALL_LOG",
  "android.permission.READ_SMS",
  "android.permission.SEND_SMS",
  "android.permission.RECEIVE_SMS",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  "android.permission.MANAGE_EXTERNAL_STORAGE",
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_VIDEO",
  "android.permission.READ_MEDIA_AUDIO",
  "android.permission.BODY_SENSORS",
  "android.permission.ACTIVITY_RECOGNITION",
  "android.permission.BLUETOOTH_SCAN",
  "android.permission.BLUETOOTH_CONNECT",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.SCHEDULE_EXACT_ALARM",
  "android.permission.USE_EXACT_ALARM",
  "android.permission.REQUEST_INSTALL_PACKAGES",
  "android.permission.USE_BIOMETRIC",
  "android.permission.USE_FINGERPRINT"
];

const variant = (process.env.ANDROID_VARIANT ?? "debug").trim().toLowerCase();
if (!/^[a-z0-9_-]+$/.test(variant)) {
  console.error(`Android permission gate: geçersiz variant: ${variant}`);
  process.exit(1);
}

const app = JSON.parse(fs.readFileSync("app.json", "utf8"));
const configured = new Set(app.expo?.android?.blockedPermissions ?? []);
const failures = [];

for (const permission of REQUIRED_BLOCKED_PERMISSIONS) {
  if (!configured.has(permission)) {
    failures.push(`app.json blockedPermissions eksik: ${permission}`);
  }
}

const manifests = findMergedManifests("android/app/build/intermediates", variant);
if (manifests.length === 0) {
  failures.push(`Gradle merged ${variant} AndroidManifest.xml bulunamadı.`);
}

for (const manifestPath of manifests) {
  const manifest = fs.readFileSync(manifestPath, "utf8");
  const effectivePermissions = new Set(extractPermissions(manifest));
  for (const permission of REQUIRED_BLOCKED_PERMISSIONS) {
    if (effectivePermissions.has(permission)) {
      failures.push(`Final merged manifest yasak izni içeriyor: ${permission} -> ${manifestPath}`);
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`Android permission gate: ${failure}`);
  process.exit(1);
}

console.log(
  `Android permission gate: ${REQUIRED_BLOCKED_PERMISSIONS.length} hassas izin default-deny ve ${manifests.length} ${variant} merged manifest temiz.`
);

function extractPermissions(xml) {
  const permissions = [];
  const pattern = /<uses-permission(?:-sdk-\d+)?\b[^>]*\bandroid:name=["']([^"']+)["'][^>]*>/g;
  for (const match of xml.matchAll(pattern)) {
    if (match[1]) permissions.push(match[1]);
  }
  return permissions;
}

function findMergedManifests(root, buildVariant) {
  if (!fs.existsSync(root)) return [];
  const results = [];
  walk(root, results);
  const markerA = `/merged_manifests/${buildVariant}/`;
  const markerB = `/merged_manifest/${buildVariant}/`;
  return results.filter((candidate) => {
    const normalized = candidate.replace(/\\/g, "/");
    return normalized.endsWith("/AndroidManifest.xml") &&
      (normalized.includes(markerA) || normalized.includes(markerB));
  });
}

function walk(target, results) {
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) walk(full, results);
    else if (entry.name === "AndroidManifest.xml") results.push(full);
  }
}
