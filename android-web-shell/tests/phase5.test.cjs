const assert=require('node:assert/strict');
const Core=require('../app/src/main/assets/phase5-core.js');
assert.ok(Core.MARKET.length>=20);
assert.equal(Core.marketFor('Domates').ref,17.92);
assert.equal(Core.marketFor('Buğday').low,16.315);
assert.equal(Core.marketFor('Tütün'),null);
let r=Core.effectiveReference(Core.marketFor('Buğday'));assert.equal(r.low,16.315);assert.equal(r.high,20.166);assert.ok(r.mid>18&&r.mid<19);
r=Core.effectiveReference(Core.marketFor('Domates'));assert.equal(r.low,17.92);assert.equal(r.high,17.92);
let v=Core.productValue(1000,Core.marketFor('Domates'));assert.equal(v.mid,17920);assert.equal(v.custom,false);
v=Core.productValue(1000,Core.marketFor('Buğday'));assert.equal(v.low,16315);assert.equal(v.high,20166);
v=Core.productValue(1000,null,25);assert.equal(v.mid,25000);assert.equal(v.custom,true);
assert.equal(Core.productValue(1000,null,null),null);assert.throws(()=>Core.productValue(-1,null,20),/invalid_quantity/);
const tx=[
{id:'1',type:'expense',category:'Mazot',parcel:'A',crop:'Buğday',amount:10000,date:'2026-09-01'},
{id:'2',type:'expense',category:'Mazot',parcel:'A',crop:'Buğday',amount:5000,date:'2026-09-02'},
{id:'3',type:'expense',category:'Gübre',parcel:'B',crop:'Pamuk',amount:20000,date:'2026-08-30'},
{id:'4',type:'income',category:'Ürün satışı',parcel:'A',crop:'Buğday',amount:50000,date:'2026-09-03'}
];
const eff=t=>t.amount;
let g=Core.groupExpenseSections(tx,eff);assert.equal(g.length,2);assert.equal(g[0].category,'Gübre');assert.equal(g[0].total,20000);assert.equal(g[1].category,'Mazot');assert.equal(g[1].items.length,2);
let p=Core.parcelSummaries(tx,eff);assert.equal(p.length,2);const a=p.find(x=>x.parcel==='A');assert.equal(a.expense,15000);assert.equal(a.income,50000);assert.equal(a.result,35000);assert.equal(a.lastCategory,'Ürün satışı');
let top=Core.topExpenseCategories(tx,eff,1);assert.equal(top.length,1);assert.equal(top[0].category,'Gübre');
let s=Core.calcInitial();assert.equal(s.display,'0');s=Core.calculatorPress(s,'1');s=Core.calculatorPress(s,'2');assert.equal(s.display,'12');s=Core.calculatorPress(s,'+');s=Core.calculatorPress(s,'3');s=Core.calculatorPress(s,'=');assert.equal(s.display,'15');
s=Core.calcInitial();s=Core.calculatorPress(s,'9');s=Core.calculatorPress(s,'÷');s=Core.calculatorPress(s,'3');s=Core.calculatorPress(s,'=');assert.equal(s.display,'3');
s=Core.calcInitial();s=Core.calculatorPress(s,'5');s=Core.calculatorPress(s,'0');s=Core.calculatorPress(s,'%');assert.equal(s.display,'0,5');
s=Core.calcInitial();s=Core.calculatorPress(s,'8');s=Core.calculatorPress(s,'±');assert.equal(s.display,'-8');s=Core.calculatorPress(s,'⌫');assert.equal(s.display,'0');
s=Core.calcInitial();s=Core.calculatorPress(s,'9');s=Core.calculatorPress(s,'÷');s=Core.calculatorPress(s,'0');s=Core.calculatorPress(s,'=');assert.equal(s.display,'Hata');assert.equal(s.error,true);
console.log('Phase 5 tests: 31 assertions passed');