const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../app/src/main/assets/phase10-core.js');

assert.equal(Core.validLatLon(37.91,40.23),true);
assert.equal(Core.validLatLon(100,40),false);
const p=Core.panLatLon(39,35,10,100,-50);assert.ok(Core.validLatLon(p.lat,p.lon));assert.equal(p.zoom,10);
const tiles=Core.tileLayout(39,35,10,360,300,1);assert.ok(tiles.length>=9);assert.match(Core.esriTileUrl(tiles[0]),/World_Imagery\/MapServer\/tile\/10\//);
assert.equal(Core.freshnessLabel('2026-09-09T10:00:00Z',Date.parse('2026-09-09T12:00:00Z')),'2 saat önce');
assert.deepEqual(Core.parcelNames([{parcel:'B Tarla'},{parcel:'A Tarla'},{parcel:'A Tarla',deletedAt:1},{parcel:''}]),['A Tarla','B Tarla']);
assert.equal(Core.activeTransactions([{id:1},{id:2,deletedAt:1}]).length,1);
assert.equal(Core.safeLivePayload({source:'EPDK',updatedAt:'2026-09-09T10:00:00Z'}).source,'EPDK');
assert.equal(Core.safeLivePayload({source:'',updatedAt:'x'}),null);

const ui=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/phase10-command.js'),'utf8');
assert.match(ui,/Uydu & Tarlalar/);
assert.match(ui,/canlı kamera değildir/);
assert.match(ui,/const API='https:\/\/ekincep\.vercel\.app\/api'/);
assert.match(ui,/API\+'\/market'/);
assert.match(ui,/API\+'\/fuel'/);
assert.match(ui,/Imagery © Esri/);
const fuel=fs.readFileSync(path.join(__dirname,'../../pwa/api/fuel.js'),'utf8');assert.match(fuel,/apigateway\.epdk\.gov\.tr/);assert.match(fuel,/petrolBayiSatisFiyatBulten/);
const market=fs.readFileSync(path.join(__dirname,'../../pwa/api/market.js'),'utf8');assert.match(market,/borsa\.tobb\.org\.tr/);assert.match(market,/TOBB Ticaret Borsaları/);
const loader=fs.readFileSync(path.join(__dirname,'../../pwa/app-loader.js'),'utf8');assert.match(loader,/phase10-core\.js/);assert.match(loader,/phase10-command\.js/);
const sw=fs.readFileSync(path.join(__dirname,'../../pwa/sw.js'),'utf8');assert.match(sw,/server\.arcgisonline\.com/);assert.match(sw,/SATELLITE,160/);assert.match(sw,/\/api\/market/);assert.match(sw,/\/api\/fuel/);
console.log('Phase 10 assertions: 24 passed');