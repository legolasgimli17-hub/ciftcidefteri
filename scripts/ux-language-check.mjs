import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const roots = ["app", "src/ui"];
const forbiddenUserPhrases = [
  "mutabakat",
  "anapara bakiyesi",
  "zirai işletme hesabı",
  "senkronizasyon hatası",
  "gider kategorisi seçiniz",
  "yeni işlem kaydı oluştur",
  "sqlite",
  "sqlcipher",
  "securestore",
  "asyncstorage",
  "schema",
  "migration",
  "stack trace",
  "foreign key",
  "constraint",
  "jwt",
  "rls",
  "service role",
  "sync_state",
  "keystore",
  "keychain",
  "exception",
  "database error",
  "api key"
];

const files = [];
for (const root of roots) walk(root);

let failed = false;
for (const file of files) {
  const sourceText = fs.readFileSync(file, "utf8");

  if (isAppFile(file) && sourceText.includes(".message")) {
    failed = true;
    console.error(`Kullanıcı hata sınırı ihlali: ${file} -> ham Error.message kullanılamaz.`);
  }

  const sourceFile = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  visit(sourceFile, sourceFile, file);
}

if (failed) process.exit(1);
console.log(`UX language gate: ${files.length} dosya temiz; ham hata sızıntısı ve teknik jargon yok.`);

function visit(node, sourceFile, file) {
  if (ts.isStringLiteralLike(node) && !isModuleSpecifier(node)) {
    inspectUserText(node.text, file);
  } else if (ts.isJsxText(node)) {
    inspectUserText(node.getText(sourceFile), file);
  } else if (ts.isTemplateExpression(node)) {
    inspectUserText(node.head.text, file);
    for (const span of node.templateSpans) inspectUserText(span.literal.text, file);
  }
  ts.forEachChild(node, (child) => visit(child, sourceFile, file));
}

function inspectUserText(value, file) {
  const normalized = value.toLocaleLowerCase("tr-TR");
  for (const phrase of forbiddenUserPhrases) {
    if (!normalized.includes(phrase)) continue;
    failed = true;
    console.error(`UX dili ihlali: ${file} -> ${phrase}`);
  }
}

function isModuleSpecifier(node) {
  const parent = node.parent;
  return (
    (ts.isImportDeclaration(parent) && parent.moduleSpecifier === node) ||
    (ts.isExportDeclaration(parent) && parent.moduleSpecifier === node)
  );
}

function isAppFile(file) {
  return file === "app" || file.startsWith(`app${path.sep}`);
}

function walk(target) {
  if (!fs.existsSync(target)) return;
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
}