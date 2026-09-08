import { spawnSync } from "node:child_process";

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const ANSI = /\u001B\[[0-?]*[ -\/]*[@-~]/g;

function run(command, args) {
  return spawnSync(command, args, {
    encoding: "utf8",
    env: { ...process.env, CI: "1" },
    timeout: 30_000,
  });
}

function combinedOutput(result) {
  return `${result.stdout ?? ""}${result.stderr ?? ""}`.replace(ANSI, "");
}

function commandFailedUnexpectedly(result, label) {
  if (result.error) {
    console.error(`${label} çalıştırılamadı: ${result.error.message}`);
    process.exit(1);
  }
  if (result.signal) {
    console.error(`${label} ${result.signal} sinyaliyle sonlandı.`);
    process.exit(1);
  }
}

const expoCheck = run(npxCommand, ["expo", "install", "--check"]);
commandFailedUnexpectedly(expoCheck, "Expo uyumluluk kontrolü");

const expoOutput = combinedOutput(expoCheck);
process.stdout.write(expoOutput);

if (expoCheck.status === 0) {
  process.exit(0);
}

const mismatchPattern = /^\s*((?:@[^/\s]+\/)?[^@\s]+)@([^\s]+)\s+-\s+expected version:\s+(\S+)\s*$/gm;
const mismatches = [...expoOutput.matchAll(mismatchPattern)].map((match) => ({
  packageName: match[1],
  actualVersion: match[2],
  expectedRange: match[3],
}));

if (mismatches.length === 0) {
  console.error("Expo kontrolü başarısız oldu ancak güvenli biçimde sınıflandırılabilecek bir sürüm farkı bulunamadı.");
  process.exit(1);
}

const unavailableTargets = [];

for (const mismatch of mismatches) {
  const target = `${mismatch.packageName}@${mismatch.expectedRange}`;
  const npmCheck = run(npmCommand, ["view", target, "version", "--json"]);
  commandFailedUnexpectedly(npmCheck, `npm registry kontrolü (${target})`);

  const npmOutput = combinedOutput(npmCheck);
  const hasPublishedMatch = npmCheck.status === 0 && npmOutput.trim() && npmOutput.trim() !== "null";

  if (hasPublishedMatch) {
    console.error(
      `\n${target} npm üzerinde kurulabilir durumda. Mevcut ${mismatch.actualVersion} sürümü güncellenmeden CI geçemez.`,
    );
    process.exit(1);
  }

  const unavailable = /ETARGET|E404|No matching version found|No match found for version|404 Not Found/i.test(npmOutput);
  if (!unavailable) {
    console.error(`\n${target} için npm registry durumu güvenli biçimde doğrulanamadı:`);
    console.error(npmOutput.trim() || `npm exit code: ${npmCheck.status}`);
    process.exit(1);
  }

  unavailableTargets.push(target);
}

console.warn(
  `\nExpo uyumluluk servisi npm registry'den ileride. Henüz kurulabilir olmayan hedef(ler): ${unavailableTargets.join(
    ", ",
  )}.`,
);
console.warn(
  "CI yalnız hedef sürümler gerçekten yayımlanmamış olduğu için devam ediyor. Sürümler npm'e geldiği anda bu kontrol tekrar fail ederek güncellemeyi zorunlu kılacak.",
);
