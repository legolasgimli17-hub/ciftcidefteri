const fs=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const file=path.join(__dirname,'../app/src/main/assets/phase8-redesign.js');
const src=fs.readFileSync(file,'utf8');

assert.match(src,/const BRAND='EkinCep'/);
assert.match(src,/brandMark\(/);
assert.match(src,/ec-toolIcon/);
assert.match(src,/calculator:'<rect/);
assert.match(src,/market:'<path/);
assert.match(src,/weather:'<path/);
assert.match(src,/Karkalkan|--ec-charcoal|--ec-copper/);
assert.match(src,/TarlaPusula\|kilitli/);
assert.match(src,/Hesap Makinesi/);
assert.match(src,/Piyasa & Ürün Değeri/);
assert.match(src,/Hava durumu/);

console.log('Phase 8 visual assertions: 11 passed');
