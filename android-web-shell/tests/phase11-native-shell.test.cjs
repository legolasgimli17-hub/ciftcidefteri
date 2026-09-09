const fs=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.join(__dirname,'../..');
const ui=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/phase11-app-shell.js'),'utf8');
const phase9=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/phase9-field-ui.js'),'utf8');
const pwa=fs.readFileSync(path.join(root,'pwa/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'pwa/sw.js'),'utf8');

// Visual contract: agricultural photography + real satellite + dedicated iconography.
assert.match(ui,/__EKINCEP_PHASE11_NATIVE_SHELL__/);
assert.match(ui,/images\.unsplash\.com/);
assert.match(ui,/e13-photoHero/);
assert.match(ui,/e13-satCard/);
assert.match(ui,/World_Imagery/);
assert.match(ui,/e13-services/);
assert.match(ui,/e13-dataGrid/);
assert.match(ui,/safe-area-inset-top/);
assert.match(ui,/safe-area-inset-bottom/);
assert.match(ui,/prefers-reduced-motion/);

// Native-style navigation: every internal route writes history, browser back and Android back share one stack.
assert.match(ui,/history\.pushState/);
assert.match(ui,/window\.handleNativeBack=backInternal/);
assert.match(ui,/addEventListener\('popstate'/);
assert.match(ui,/v12MapPanel/);
assert.match(ui,/v12SimplePanel/);
assert.match(ui,/rawShowPage/);
assert.match(ui,/rawOpenTx/);
assert.match(ui,/rawOpenField/);

// Android asset mode and PWA must load the same Phase 11 shell.
assert.match(phase9,/phase11-app-shell\.js/);
assert.match(phase9,/location\.protocol!==\'file:\'/);
assert.match(pwa,/'phase11-app-shell\.js'/);
assert.match(pwa,/ekincep-pwa-assets-v13/);
assert.match(pwa,/__EKINCEP_PHASE11_NATIVE_SHELL__/);
assert.match(pwa,/EkinCep 13/);

// Offline cache is bounded for satellite tiles and real photography.
assert.match(sw,/ekincep-pwa-v8/);
assert.match(sw,/MAX_MAP_ENTRIES=140/);
assert.match(sw,/MAX_PHOTO_ENTRIES=8/);
assert.match(sw,/images\.unsplash\.com/);
assert.match(sw,/staleWhileRevalidate/);

console.log('Phase 11 native shell assertions passed');
