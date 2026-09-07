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
const xcodeUuidManifest = xcodeRequire('uuid/package.json');
const xcodeUuid = xcodeRequire('uuid');
assert.equal(xcodeUuidManifest.version, '11.1.1', 'xcode must resolve the audited uuid 11.1.1 release');
assert.equal(typeof xcodeUuid.v4, 'function', 'xcode uuid dependency must keep the CommonJS v4 API');

const xcode = rootRequire('xcode');
const project = xcode.project('unused.pbxproj');
project.hash = { project: { objects: {} } };
const generatedXcodeId = project.generateUuid();
assert.match(generatedXcodeId, /^[0-9A-F]{24}$/, 'xcode generateUuid contract changed unexpectedly');

console.log('Dependency runtime check passed: Router decoder and xcode uuid paths are hardened and compatible.');
