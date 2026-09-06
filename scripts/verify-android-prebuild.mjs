import fs from "node:fs";

const failures = [];
const manifestPath = "android/app/src/main/AndroidManifest.xml";
const gradlePropertiesPath = "android/gradle.properties";
const appGradlePath = "android/app/build.gradle";

for (const required of [manifestPath, gradlePropertiesPath, appGradlePath]) {
  if (!fs.existsSync(required)) failures.push(`Native prebuild dosyası eksik: ${required}`);
}

if (failures.length === 0) {
  const manifest = fs.readFileSync(manifestPath, "utf8");
  const gradleProperties = fs.readFileSync(gradlePropertiesPath, "utf8");
  const appGradle = fs.readFileSync(appGradlePath, "utf8");

  if (!/android:allowBackup=["']false["']/.test(manifest)) {
    failures.push("AndroidManifest allowBackup=false içermiyor.");
  }

  if (!/^expo\.sqlite\.useSQLCipher=true$/m.test(gradleProperties)) {
    failures.push("Prebuild SQLCipher Gradle özelliğini etkinleştirmedi.");
  }

  if (!/^expo\.sqlite\.enableFTS=false$/m.test(gradleProperties)) {
    failures.push("Prebuild beklenen expo-sqlite FTS politikasını üretmedi.");
  }

  if (!/applicationId\s+["']app\.ciftcidefteri\.mobile["']/.test(appGradle)) {
    failures.push("Android applicationId beklenen paket adıyla eşleşmiyor.");
  }
}

const sqlCipherVendor = "node_modules/expo-sqlite/vendor/sqlcipher";
if (!fs.existsSync(sqlCipherVendor)) {
  failures.push("expo-sqlite paketinde SQLCipher vendor kaynakları bulunamadı.");
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`Android native gate: ${failure}`);
  process.exit(1);
}

console.log("Android native gate: backup kapalı, SQLCipher prebuild özelliği aktif ve paket kimliği doğru.");
