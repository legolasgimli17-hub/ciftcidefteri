const fs=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.join(__dirname,'../..');
const assetRoot=path.join(__dirname,'../app/src/main/assets');
const ui=fs.readFileSync(path.join(assetRoot,'phase10-command-center.js'),'utf8');
const fieldUi=fs.readFileSync(path.join(assetRoot,'phase9-field-ui.js'),'utf8');
const android=fs.readFileSync(path.join(__dirname,'../app/src/main/java/app/ciftcidefteri/web/MainActivity.java'),'utf8');
const manifest=fs.readFileSync(path.join(__dirname,'../app/src/main/AndroidManifest.xml'),'utf8');
const pwa=fs.readFileSync(path.join(root,'pwa/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'pwa/sw.js'),'utf8');

// Product shell: the home screen is field-first, while finance remains real data.
assert.match(ui,/__EKINCEP_PHASE10_COMMAND_CENTER__/);
assert.match(ui,/Bu sezon cebinde kalan/);
assert.match(ui,/ec10-financeHero/);
assert.match(ui,/ec10-todayRail/);
assert.match(ui,/ec10-cropLines/);
assert.match(ui,/ec10-fieldGrid/);
assert.match(ui,/ec10-dataRail/);
assert.match(ui,/ec10-toolChest/);
assert.match(ui,/cropSvg/);
assert.match(ui,/cotton/);
assert.match(ui,/corn/);
assert.match(ui,/wheat/);
assert.match(ui,/Piyasa/);
assert.match(ui,/Elindekiler/);
assert.match(ui,/Canlı saha/);
assert.match(ui,/prefers-reduced-motion/);
assert.doesNotMatch(ui,/field-hero\.webp/);

// Real field workflow: satellite + map tiles, parcel geometry and dekar calculation.
assert.match(ui,/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery/);
assert.match(ui,/tile\.openstreetmap\.org/);
assert.match(ui,/catalogue\.dataspace\.copernicus\.eu\/odata\/v1\/Products/);
assert.match(ui,/SENTINEL-2/);
assert.match(ui,/app\.fields/);
assert.match(ui,/function areaDa\(/);
assert.match(ui,/Tarla sınırını çiz/);
assert.match(ui,/En az 3 köşe/);
assert.match(ui,/prefill\('expense'/);
assert.match(ui,/prefill\('income'/);

// Turkey-specific operating layer: supports and simple field task plan.
assert.match(ui,/app\.supports/);
assert.match(ui,/app\.tasks/);
assert.match(ui,/Mazot-gübre desteği/);
assert.match(ui,/Fark ödemesi desteği/);
assert.match(ui,/supportExempt:true/);
assert.match(ui,/Saha planı/);
assert.match(fieldUi,/SAHA v12\.1/);

// Android field location is permission-gated and only granted to the local app origin.
assert.match(android,/readAssetText\("phase10-command-center\.js"\)/);
assert.match(android,/setGeolocationEnabled\(true\)/);
assert.match(android,/onGeolocationPermissionsShowPrompt/);
assert.match(android,/origin\.startsWith\("file:\/\/"\)/);
assert.match(android,/ACCESS_FINE_LOCATION/);
assert.match(manifest,/android\.permission\.ACCESS_COARSE_LOCATION/);
assert.match(manifest,/android\.permission\.ACCESS_FINE_LOCATION/);

// PWA hard-pins the v12 bundle and never silently falls back to the old asset DB.
assert.match(pwa,/const BUILD='v12\.1-d4058ea'/);
assert.match(pwa,/const REF='d4058ead7d29fc08423b7bf2bd8d890f90ad7921'/);
assert.match(pwa,/ekincep-pwa-assets-v12-1/);
assert.match(pwa,/validAsset\(name,text\)/);
assert.match(pwa,/SAHA v12\.1/);
assert.match(pwa,/World_Imagery/);
assert.doesNotMatch(pwa,/const DB='ekincep-pwa-cache-v1'/);
assert.match(sw,/ekincep-pwa-v7/);
assert.match(sw,/api\.open-meteo\.com/);
assert.match(sw,/server\.arcgisonline\.com/);
assert.match(sw,/tile\.openstreetmap\.org/);
assert.match(sw,/catalogue\.dataspace\.copernicus\.eu/);
assert.match(sw,/MAX_MAP_ENTRIES=120/);
assert.match(sw,/staleWhileRevalidate/);
assert.match(sw,/networkFirst\(e\.request,RUNTIME\)/);

console.log('Phase 10 EkinCep field operating system assertions passed');
