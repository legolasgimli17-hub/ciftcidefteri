import { execFileSync } from "node:child_process";
import fs from "node:fs";

const PACKAGE = "app.ciftcidefteri.mobile";
const APK = process.env.APK_PATH ?? "android/app/build/outputs/apk/release/app-release.apk";
const UI = "/sdcard/ciftci-init.xml";
const out = "dist-db-init-evidence";
fs.mkdirSync(out, { recursive: true });

function adb(args, options = {}) {
  return execFileSync("adb", args, { encoding: options.encoding ?? "utf8", timeout: options.timeout ?? 30000 });
}
function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
function dump() {
  try { adb(["shell", "uiautomator", "dump", UI]); } catch {}
  try { return adb(["shell", "cat", UI]); } catch { return ""; }
}
function saveDiagnostics() {
  try { fs.writeFileSync(`${out}/window.xml`, dump()); } catch {}
  try { fs.writeFileSync(`${out}/logcat.txt`, adb(["logcat", "-d"])); } catch {}
  try { fs.writeFileSync(`${out}/screen.png`, adb(["exec-out", "screencap", "-p"], { encoding: null })); } catch {}
}

adb(["wait-for-device"]);
for (let i = 0; i < 180; i++) {
  if (adb(["shell", "getprop", "sys.boot_completed"]).trim() === "1") break;
  sleep(500);
}
adb(["install", "-r", APK], { timeout: 120000 });
try { adb(["logcat", "-c"]); } catch {}
adb(["shell", "monkey", "-p", PACKAGE, "-c", "android.intent.category.LAUNCHER", "1"]);

let xml = "";
for (let i = 0; i < 60; i++) {
  sleep(500);
  xml = dump();
  if (xml.includes("Başlayalım")) {
    saveDiagnostics();
    console.log("PASS: standalone release açıldı ve onboarding göründü.");
    process.exit(0);
  }
  if (xml.includes("Defter açılamadı")) break;
}

saveDiagnostics();
const log = fs.readFileSync(`${out}/logcat.txt`, "utf8");
const interesting = log.split(/\r?\n/).filter(line => /ciftci|sqlite|cipher|securestore|ReactNativeJS|Expo/i.test(line)).slice(-250).join("\n");
console.error(interesting);
throw new Error(xml.includes("Defter açılamadı") ? "FAIL: release DB init Defter açılamadı ekranına düştü." : "FAIL: onboarding görünmedi.");
