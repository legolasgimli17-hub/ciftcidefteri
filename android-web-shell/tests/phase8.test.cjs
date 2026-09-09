const fs=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const file=path.join(__dirname,'../app/src/main/assets/phase8-redesign.js');
const src=fs.readFileSync(file,'utf8');

assert.match(src,/const BRAND='EkinCep'/);
assert.match(src,/brandMark\(/);
assert.match(src,/--ec-basalt:#202521/);
assert.match(src,/--ec-cotton:#F5F7F2/);
assert.match(src,/--ec-leaf:#376B43/);
assert.match(src,/--ec-water:#24717A/);
assert.match(src,/--ec-wheat:#C79B35/);
assert.match(src,/--ec-dry:#A64538/);
assert.match(src,/\.p5-eyebrow\{display:none!important\}/);
assert.match(src,/font-family:Georgia,"Times New Roman",serif/);
assert.doesNotMatch(src,/ec-chevron/);
assert.match(src,/Hesap Makinesi/);
assert.match(src,/Piyasa & Ürün Değeri/);
assert.match(src,/Hava durumu/);
assert.match(src,/TarlaPusula\|Çiftçi Defteri\|kilitli/);

console.log('Phase 8 EkinCep identity assertions: 15 passed');
