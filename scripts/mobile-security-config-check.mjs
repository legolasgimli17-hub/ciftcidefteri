import fs from "node:fs";

const app = JSON.parse(fs.readFileSync("app.json", "utf8"));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const rootLayout = fs.readFileSync("app/_layout.tsx", "utf8");
const expo = app.expo ?? {};
const errors = [];

if (expo.android?.allowBackup !== false) {
  errors.push("android.allowBackup=false olmalı; finansal uygulama verisi cihaz yedeğine gitmemeli.");
}

const sqliteOptions = pluginOptions(expo.plugins, "expo-sqlite");
if (sqliteOptions?.useSQLCipher !== true) {
  errors.push("expo-sqlite useSQLCipher=true olmalı.");
}

if (!hasPlugin(expo.plugins, "expo-secure-store")) {
  errors.push("expo-secure-store config plugin eksik.");
}

if (!pkg.dependencies?.["expo-secure-store"]) {
  errors.push("expo-secure-store dependency eksik.");
}

if (!Array.isArray(expo.platforms) || expo.platforms.some(platform => !["android", "ios"].includes(platform))) {
  errors.push("Şifreli mobil depolama sınırı için production platformları yalnızca android/ios olmalı.");
}

if (!/<SQLiteProvider[\s\S]*?onError=/.test(rootLayout)) {
  errors.push("SQLiteProvider init hataları için onError recovery handler zorunlu.");
}

if (!/key=\{`database-provider-\$\{providerKey\}`\}/.test(rootLayout)) {
  errors.push("SQLiteProvider güvenli yeniden deneme için remount anahtarı kullanmalı.");
}

if (errors.length > 0) {
  for (const error of errors) console.error(`Mobile security gate: ${error}`);
  process.exit(1);
}

console.log("Mobile security gate: SQLCipher, SecureStore, backup ve init recovery politikası doğru yapılandırılmış.");

function hasPlugin(plugins = [], name) {
  return plugins.some(plugin => plugin === name || (Array.isArray(plugin) && plugin[0] === name));
}

function pluginOptions(plugins = [], name) {
  const plugin = plugins.find(item => Array.isArray(item) && item[0] === name);
  return plugin?.[1] ?? null;
}
