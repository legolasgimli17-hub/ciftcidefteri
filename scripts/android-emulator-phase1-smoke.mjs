import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PACKAGE_NAME = "app.ciftcidefteri.mobile";
const APK_PATH = process.env.PHASE1_APK_PATH ?? "android/app/build/outputs/apk/release/app-release.apk";
const EVIDENCE_DIR = "dist-phase1-evidence";
const UI_DUMP_PATH = "/sdcard/ciftci-defteri-window.xml";
const WAIT_TIMEOUT_MS = 30_000;
const POLL_MS = 700;
const evidence = [];

if (!fs.existsSync(APK_PATH)) {
  fail(`APK bulunamadı: ${APK_PATH}`);
}
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

try {
  record("Android emulator Phase 1 smoke başladı.");
  adb(["wait-for-device"]);
  waitForBoot();

  record("Release APK kuruluyor.");
  adb(["install", "-r", APK_PATH], { timeout: 120_000 });
  clearLogcat();
  enableOfflineMode();
  launchApp();

  tapLabel("Başlayalım");
  fillField("Adın", "MehmetSmoke");
  tapLabel("Devam");

  fillField("İl", "DiyarbakirSmoke");
  fillField("İlçe", "BismilSmoke");
  fillField("Köy / mahalle", "KoySmoke");
  tapLabel("Devam");

  fillField("Arazi", "100");
  tapLabel("Devam");
  tapLabel("Pamuk");
  tapLabel("Defteri aç", { scroll: true });

  waitForLabel("Para girdi");
  tapLabel("Para girdi");
  fillField("Tutar", "1234");
  tapLabel("Devam");
  tapLabel("Ürün satışı", { scroll: true });
  waitForLabel("Kaydettim");
  tapLabel("Deftere dön");
  waitForLabel("Ürün satışı");
  record("Offline onboarding ve gelir kaydı başarılı.");

  forceStop();
  launchApp();
  waitForLabel("Ürün satışı");
  record("Force-stop sonrası finans kaydı kalıcı.");

  forceStop();
  adb(["install", "-r", APK_PATH], { timeout: 120_000 });
  launchApp();
  waitForLabel("Ürün satışı");
  record("Yerinde APK yeniden kurulumu sonrası SecureStore + DB sürekliliği başarılı.");

  assertNoSensitiveLogLeakage();
  forceStop();
  const databaseFiles = exportEncryptedDatabaseFiles();
  const mainDb = databaseFiles.find((item) => item.devicePath.endsWith("/ciftci-defteri.db") || item.devicePath.endsWith("ciftci-defteri.db"));
  if (!mainDb) fail("Ana SQLCipher DB dosyası bulunamadı.");
  assertEncryptedDatabase(databaseFiles, mainDb.hostPath);
  record("Ham DB normal SQLite olarak okunamıyor ve bilinen kullanıcı metinleri plaintext değil.");

  assertWrongKeyFailsClosed(mainDb);
  record("Yanlış SecureStore anahtarıyla eski DB fail-closed davranıyor.");

  record("Android emulator Phase 1 smoke TAMAM.");
  writeEvidence();
} catch (error) {
  captureDiagnostics();
  record(`BAŞARISIZ: ${error instanceof Error ? error.message : String(error)}`);
  writeEvidence();
  throw error;
}

function adb(args, options = {}) {
  return execFileSync("adb", args, {
    encoding: options.encoding ?? "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    timeout: options.timeout ?? 30_000
  });
}

function waitForBoot() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const value = adb(["shell", "getprop", "sys.boot_completed"]).trim();
    if (value === "1") {
      adb(["shell", "input", "keyevent", "82"]);
      record("Emulator boot tamamlandı.");
      return;
    }
    sleep(POLL_MS);
  }
  fail("Android emulator boot süresi aşıldı.");
}

function enableOfflineMode() {
  try { adb(["shell", "svc", "wifi", "disable"]); } catch {}
  try { adb(["shell", "svc", "data", "disable"]); } catch {}
  try { adb(["shell", "settings", "put", "global", "airplane_mode_on", "1"]); } catch {}
  try {
    adb(["shell", "am", "broadcast", "-a", "android.intent.action.AIRPLANE_MODE", "--ez", "state", "true"]);
  } catch {}
  record("Emulator ağ bağlantıları kapatıldı; temel akış offline test ediliyor.");
}

function launchApp() {
  adb(["shell", "monkey", "-p", PACKAGE_NAME, "-c", "android.intent.category.LAUNCHER", "1"]);
}

function forceStop() {
  adb(["shell", "am", "force-stop", PACKAGE_NAME]);
  sleep(500);
}

function clearLogcat() {
  try { adb(["logcat", "-c"]); } catch {}
}

function fillField(label, value) {
  const node = findNode(label, { scroll: true });
  tapNode(node);
  adb(["shell", "input", "text", value]);
  hideKeyboard();
}

function tapLabel(label, options = {}) {
  const node = findNode(label, { scroll: options.scroll === true });
  tapNode(node);
  sleep(500);
}

function waitForLabel(label, timeoutMs = WAIT_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const node = findNodeOnce(label);
    if (node) return node;
    sleep(POLL_MS);
  }
  fail(`Ekranda beklenen öğe bulunamadı: ${label}`);
}

function findNode(label, options = {}) {
  const attempts = options.scroll ? 8 : 1;
  for (let index = 0; index < attempts; index += 1) {
    const deadline = Date.now() + 8_000;
    while (Date.now() < deadline) {
      const node = findNodeOnce(label);
      if (node) return node;
      sleep(POLL_MS);
    }
    if (index < attempts - 1) scrollDown();
  }
  fail(`Dokunulacak öğe bulunamadı: ${label}`);
}

function findNodeOnce(label) {
  const nodes = dumpUiNodes();
  return nodes.find((node) => node.text === label || node.contentDesc === label) ?? null;
}

function dumpUiNodes() {
  try {
    adb(["shell", "uiautomator", "dump", UI_DUMP_PATH]);
  } catch {
    return [];
  }
  const xml = adb(["shell", "cat", UI_DUMP_PATH]);
  fs.writeFileSync(path.join(EVIDENCE_DIR, "last-window.xml"), xml);
  const nodes = [];
  for (const match of xml.matchAll(/<node\b([^>]*)\/>/g)) {
    const attrs = {};
    for (const attr of match[1].matchAll(/([\w-]+)="([^"]*)"/g)) {
      attrs[attr[1]] = decodeXml(attr[2]);
    }
    nodes.push({
      text: attrs.text ?? "",
      contentDesc: attrs["content-desc"] ?? "",
      bounds: attrs.bounds ?? ""
    });
  }
  return nodes;
}

function tapNode(node) {
  const match = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(node.bounds);
  if (!match) fail(`Geçersiz UI bounds: ${node.bounds}`);
  const x = Math.round((Number(match[1]) + Number(match[3])) / 2);
  const y = Math.round((Number(match[2]) + Number(match[4])) / 2);
  adb(["shell", "input", "tap", String(x), String(y)]);
}

function scrollDown() {
  hideKeyboard();
  adb(["shell", "input", "swipe", "540", "1650", "540", "500", "450"]);
  sleep(600);
}

function hideKeyboard() {
  try { adb(["shell", "input", "keyevent", "4"]); } catch {}
  sleep(250);
}

function assertNoSensitiveLogLeakage() {
  const log = adb(["logcat", "-d"]);
  fs.writeFileSync(path.join(EVIDENCE_DIR, "logcat.txt"), log);
  const forbidden = ["MehmetSmoke", "DiyarbakirSmoke", "BismilSmoke", "KoySmoke", "Ürün satışı"];
  for (const marker of forbidden) {
    if (log.includes(marker)) fail(`Logcat hassas kullanıcı verisi içeriyor: ${marker}`);
  }
  record("Logcat bilinen kullanıcı/finans metinlerini içermiyor.");
}

function exportEncryptedDatabaseFiles() {
  const output = adb([
    "shell", "run-as", PACKAGE_NAME, "sh", "-c",
    "find . -type f \\( -name 'ciftci-defteri.db' -o -name 'ciftci-defteri.db-*' \\) -print"
  ]).trim();
  if (!output) fail("Uygulama sandboxında DB dosyası bulunamadı.");

  const files = [];
  for (const devicePath of output.split(/\r?\n/).filter(Boolean)) {
    const bytes = adb(["exec-out", "run-as", PACKAGE_NAME, "cat", devicePath], { encoding: null });
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) fail(`DB dosyası dışarı alınamadı: ${devicePath}`);
    const safeName = devicePath.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const hostPath = path.join(EVIDENCE_DIR, safeName);
    fs.writeFileSync(hostPath, bytes);
    files.push({ devicePath, hostPath, bytes });
  }
  return files;
}

function assertEncryptedDatabase(files, mainDbHostPath) {
  const plaintextMarkers = ["SQLite format 3", "MehmetSmoke", "DiyarbakirSmoke", "BismilSmoke", "KoySmoke", "Benim Çiftliğim"];
  for (const file of files) {
    const text = file.bytes.toString("utf8");
    for (const marker of plaintextMarkers) {
      if (text.includes(marker)) fail(`Şifreli DB/WAL içinde plaintext bulundu: ${marker} -> ${file.devicePath}`);
    }
  }

  const sqlite = spawnSync("sqlite3", [mainDbHostPath, ".schema"], { encoding: "utf8" });
  fs.writeFileSync(path.join(EVIDENCE_DIR, "plain-sqlite-attempt.txt"), `${sqlite.stdout ?? ""}\n${sqlite.stderr ?? ""}`);
  if (sqlite.status === 0) fail("Ham finans DB'si normal sqlite3 ile okunabildi; SQLCipher kanıtı başarısız.");
}

function assertWrongKeyFailsClosed(oldMainDb) {
  adb(["shell", "pm", "clear", PACKAGE_NAME]);
  launchApp();
  waitForLabel("Başlayalım");
  forceStop();

  const newDbPathOutput = adb([
    "shell", "run-as", PACKAGE_NAME, "sh", "-c",
    "find . -type f -name 'ciftci-defteri.db' -print | head -n 1"
  ]).trim();
  if (!newDbPathOutput) fail("Yeni anahtarla oluşturulan DB yolu bulunamadı.");

  const tempHost = path.join(EVIDENCE_DIR, "old-encrypted-main.db");
  fs.copyFileSync(oldMainDb.hostPath, tempHost);
  adb(["push", tempHost, "/data/local/tmp/ciftci-defteri-old.db"]);
  adb(["shell", "chmod", "0644", "/data/local/tmp/ciftci-defteri-old.db"]);
  adb(["shell", "run-as", PACKAGE_NAME, "sh", "-c", `rm -f '${newDbPathOutput}-wal' '${newDbPathOutput}-shm' && cp /data/local/tmp/ciftci-defteri-old.db '${newDbPathOutput}'`]);
  launchApp();
  waitForLabel("Defter açılamadı", 20_000);
}

function captureDiagnostics() {
  try {
    const xml = adb(["shell", "cat", UI_DUMP_PATH]);
    fs.writeFileSync(path.join(EVIDENCE_DIR, "failure-window.xml"), xml);
  } catch {}
  try {
    const screenshot = adb(["exec-out", "screencap", "-p"], { encoding: null });
    fs.writeFileSync(path.join(EVIDENCE_DIR, "failure-screen.png"), screenshot);
  } catch {}
  try {
    fs.writeFileSync(path.join(EVIDENCE_DIR, "failure-logcat.txt"), adb(["logcat", "-d"]));
  } catch {}
}

function decodeXml(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function record(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  evidence.push(line);
  console.log(line);
}

function writeEvidence() {
  fs.writeFileSync(path.join(EVIDENCE_DIR, "phase1-android-emulator-evidence.txt"), `${evidence.join("\n")}\n`);
}

function fail(message) {
  throw new Error(message);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
