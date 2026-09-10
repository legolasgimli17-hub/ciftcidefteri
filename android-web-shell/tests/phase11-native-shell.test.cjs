const fs=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.join(__dirname,'../..');
const ui=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/phase11-app-shell.js'),'utf8');
const phase9=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/phase9-field-ui.js'),'utf8');
const android=fs.readFileSync(path.join(__dirname,'../app/src/main/java/app/ciftcidefteri/web/MainActivity.java'),'utf8');
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

// Phase 11 owns route history; Phase 9 patches all visible back surfaces to use that same history.
assert.match(ui,/history\.pushState/);
assert.match(ui,/window\.handleNativeBack=backInternal/);
assert.match(ui,/addEventListener\('popstate'/);
assert.match(ui,/v12MapPanel/);
assert.match(ui,/v12SimplePanel/);
assert.match(ui,/rawShowPage/);
assert.match(ui,/rawOpenTx/);
assert.match(ui,/rawOpenField/);
assert.match(phase9,/installUnifiedBackHandler/);
assert.match(phase9,/history\.state\?\.ek13/);
assert.match(phase9,/history\.back\(\)/);
assert.match(phase9,/active!==\'home\'/);
assert.match(phase9,/installBackSurfaceFix/);
assert.match(phase9,/addEventListener\('popstate',closeVisibleOverlayOnBack,true\)/);

// Android never guesses inner navigation from WebView history first; it asks EkinCep and only falls back if the handler is missing.
assert.match(android,/window\.handleNativeBack/);
assert.match(android,/return window\.handleNativeBack\(\)\?\'handled\'\:\'root\'/);
assert.match(android,/\"\\\"handled\\\"\"\.equals\(result\)/);
assert.match(android,/\"\\\"root\\\"\"\.equals\(result\)/);
assert.match(android,/backDispatchInFlight/);
assert.match(android,/finishBackAtRoot\(\)/);
assert.match(android,/webView\.canGoBack\(\)/);

// Android asset mode and PWA load the same Phase 11 shell and a fresh V13.1 navigation bundle.
assert.match(phase9,/phase11-app-shell\.js/);
assert.match(phase9,/location\.protocol!==\'file:\'/);
assert.match(pwa,/'phase11-app-shell\.js'/);
assert.match(pwa,/ekincep-pwa-assets-v13-1/);
assert.match(pwa,/installUnifiedBackHandler/);
assert.match(pwa,/__EKINCEP_UNIFIED_BACK_PATCH__/);
assert.match(pwa,/EkinCep 13\.1/);

// Offline cache is bounded for satellite tiles and real photography.
assert.match(sw,/ekincep-pwa-v9/);
assert.match(sw,/MAX_MAP_ENTRIES=140/);
assert.match(sw,/MAX_PHOTO_ENTRIES=8/);
assert.match(sw,/images\.unsplash\.com/);
assert.match(sw,/staleWhileRevalidate/);

console.log('Phase 11 native shell and unified back assertions passed');
