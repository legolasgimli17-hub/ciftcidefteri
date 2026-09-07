import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const rootRequire = createRequire(import.meta.url);
const queryStringPath = rootRequire.resolve('query-string');
const queryRequire = createRequire(queryStringPath);
const decoderPath = queryRequire.resolve('decode-uri-component');
const decoder = queryRequire('decode-uri-component');
const queryString = rootRequire('query-string');
const safeDecoderModule = rootRequire('decode-uri-component-safe');
const safeDecoder = safeDecoderModule.default ?? safeDecoderModule;

assert.equal(typeof decoder, 'function', 'query-string decoder must stay CommonJS-callable');
assert.equal(typeof safeDecoder, 'function', 'patched decoder must expose a callable default');
assert.equal(typeof queryString.parse, 'function', 'query-string parse API changed unexpectedly');
assert.equal(typeof queryString.stringify, 'function', 'query-string stringify API changed unexpectedly');

const bridgeManifestPath = path.join(path.dirname(decoderPath), 'package.json');
const bridgeManifest = JSON.parse(fs.readFileSync(bridgeManifestPath, 'utf8'));
assert.equal(
  bridgeManifest.version,
  '0.5.0-cjs-bridge',
  'query-string must resolve the audited local decoder bridge, not the vulnerable registry package',
);

assert.equal(safeDecoder('%25'), '%');
assert.equal(safeDecoder('%'), '%');

const parsed = queryString.parse('urun=pamuk&not=%25');
assert.equal(parsed.urun, 'pamuk');
assert.equal(parsed.not, '%');

const malformed = queryString.parse('not=%E0%A4%A');
assert.equal(typeof malformed.not, 'string');

const encoded = queryString.stringify({ urun: 'pamuk', not: '%' }, { sort: false });
assert.match(encoded, /urun=pamuk/);
assert.match(encoded, /not=%25/);

const xcodePath = rootRequire.resolve('xcode');
const xcodeRequire = createRequire(xcodePath);
const xcode = rootRequire('xcode');
const xcodeUuidEntry = xcodeRequire.resolve('uuid');
const xcodeUuid = xcodeRequire('uuid');
const xcodeUuidManifest = findPackageManifest(xcodeUuidEntry, 'uuid');

assert.equal(
  xcodeUuidManifest.version,
  '11.1.1',
  'xcode must resolve the patched CommonJS-compatible uuid version',
);
assert.equal(typeof xcodeUuid.v4, 'function', 'patched uuid must keep the v4 API used by xcode');

const xcodeProject = xcode.project('/tmp/ciftci-defteri-ci.xcodeproj/project.pbxproj');
xcodeProject.hash = { project: { objects: {} } };
const generatedXcodeId = xcodeProject.generateUuid();
assert.match(
  generatedXcodeId,
  /^[A-F0-9]{24}$/,
  'xcode generateUuid() must keep producing a 24-character uppercase project identifier',
);

console.log('Dependency runtime check passed: Router decoder and xcode UUID tooling use patched compatible paths.');

function findPackageManifest(entryPath, expectedName) {
  let current = path.dirname(entryPath);
  while (true) {
    const candidate = path.join(current, 'package.json');
    if (fs.existsSync(candidate)) {
      const manifest = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      if (manifest.name === expectedName) return manifest;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`Could not locate package manifest for ${expectedName}.`);
}
