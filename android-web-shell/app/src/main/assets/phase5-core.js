(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CiftciPhase5Core=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const MARKET=[
{crop:'Buğday',low:16.315,high:20.166,unit:'kg',date:'2026-09-08',source:'TOBB / Uzunköprü TB',kind:'borsa aralığı'},
{crop:'Arpa',low:13.51,high:14.21,unit:'kg',date:'2026-09-02',source:'TOBB / Edirne TB',kind:'borsa referansı'},
{crop:'Mısır',low:13,high:14,unit:'kg',date:'2026-09-07',source:'Kahramanmaraş TB',kind:'borsa aralığı'},
{crop:'Pamuk',low:45,high:50,unit:'kg',date:'2026-09-07',source:'Kahramanmaraş TB',kind:'kütlü pamuk'},
{crop:'Ayçiçeği',low:35.51,high:41.54,unit:'kg',date:'2026-09-08',source:'TOBB / Edirne TB',kind:'yağlık ayçiçeği'},
{crop:'Kanola',low:21.26,high:32.664,unit:'kg',date:'2026-08-31',source:'TOBB / Bandırma-Edirne-Uzunköprü',kind:'borsalar arası referans'},
{crop:'Mercimek',low:22.82,high:44.83,unit:'kg',date:'2026-08-28',source:'TZOB',kind:'yeşil-kırmızı üretici ortalamaları'},
{crop:'Nohut',ref:32.22,unit:'kg',date:'2026-08-28',source:'TZOB',kind:'üretici ortalaması'},
{crop:'Fasulye',ref:39.86,unit:'kg',date:'2026-08-28',source:'TZOB',kind:'kuru fasulye üretici ortalaması'},
{crop:'Domates',ref:17.92,unit:'kg',date:'2026-08-28',source:'TZOB',kind:'üretici ortalaması'},
{crop:'Biber',ref:41.68,unit:'kg',date:'2026-08-28',source:'TZOB',kind:'sivri biber üretici ortalaması'},
{crop:'Patlıcan',ref:17.90,unit:'kg',date:'2026-08-28',source:'TZOB',kind:'üretici ortalaması'},
{crop:'Salatalık',ref:13.08,unit:'kg',date:'2026-08-28',source:'TZOB',kind:'üretici ortalaması'},
{crop:'Kabak',ref:16.02,unit:'kg',date:'2026-08-28',source:'TZOB',kind:'üretici ortalaması'},
{crop:'Soğan',ref:17.75,unit:'kg',date:'2026-08-28',source:'TZOB',kind:'kuru soğan üretici ortalaması'},
{crop:'Patates',ref:17.66,unit:'kg',date:'2026-08-28',source:'TZOB',kind:'üretici ortalaması'},
{crop:'Havuç',ref:10.66,unit:'kg',date:'2026-08-28',source:'TZOB',kind:'üretici ortalaması'},
{crop:'Elma',ref:18.75,unit:'kg',date:'2026-08-28',source:'TZOB',kind:'üretici ortalaması'},
{crop:'Şeftali',ref:30.00,unit:'kg',date:'2026-08-28',source:'TZOB',kind:'üretici ortalaması'},
{crop:'Limon',ref:10.00,unit:'kg',date:'2026-08-28',source:'TZOB',kind:'üretici ortalaması'},
{crop:'Fındık',ref:410.00,unit:'kg',date:'2026-08-28',source:'TZOB',kind:'iç fındık serbest piyasa referansı'},
{crop:'Antep fıstığı',ref:600.00,unit:'kg',date:'2026-08-28',source:'TZOB',kind:'serbest piyasa referansı'},
{crop:'Karpuz',ref:4.78,unit:'kg',date:'2026-07-27',source:'TZOB',kind:'üretici ortalaması (daha eski)'},
{crop:'Şeker pancarı',ref:3.10,unit:'kg',date:'2025-09-30',source:'TÜRKŞEKER',kind:'2025-2026 baz alım + kota tamamlama; eski sezon'}
];
function marketFor(crop){return MARKET.find(x=>x.crop===crop)||null;}
function effectiveReference(entry){if(!entry)return null;if(Number.isFinite(entry.ref))return {low:entry.ref,high:entry.ref,mid:entry.ref};if(Number.isFinite(entry.low)&&Number.isFinite(entry.high))return {low:entry.low,high:entry.high,mid:(entry.low+entry.high)/2};return null;}
function productValue(quantityKg,entry,overridePrice){const qty=Number(quantityKg);if(!Number.isFinite(qty)||qty<0)throw new Error('invalid_quantity');const custom=Number(overridePrice);if(Number.isFinite(custom)&&custom>0)return {low:qty*custom,high:qty*custom,mid:qty*custom,custom:true};const r=effectiveReference(entry);if(!r)return null;return {low:qty*r.low,high:qty*r.high,mid:qty*r.mid,custom:false};}
function groupExpenseSections(transactions,effective){const map=new Map();for(const t of transactions||[]){if(t.type!=='expense')continue;const k=t.category||'Diğer masraf';if(!map.has(k))map.set(k,{category:k,total:0,items:[]});const g=map.get(k);g.items.push(t);g.total+=Number(effective(t))||0;}return [...map.values()].sort((a,b)=>b.total-a.total);}
function parcelSummaries(transactions,effective){const map=new Map();for(const t of transactions||[]){const parcel=(t.parcel||'').trim();if(!parcel)continue;if(!map.has(parcel))map.set(parcel,{parcel,crop:t.crop||'Genel',income:0,expense:0,count:0,lastDate:'',lastCategory:''});const p=map.get(parcel);p.crop=t.crop||p.crop;p.count++;const v=Number(effective(t))||0;if(t.type==='income')p.income+=v;else p.expense+=v;if(!p.lastDate||String(t.date)>p.lastDate){p.lastDate=t.date||'';p.lastCategory=t.category||'';}}return [...map.values()].map(x=>({...x,result:x.income-x.expense})).sort((a,b)=>String(b.lastDate).localeCompare(String(a.lastDate)));}
function topExpenseCategories(transactions,effective,limit){return groupExpenseSections(transactions,effective).slice(0,limit||3);}
function calcInitial(){return {display:'0',stored:null,operator:null,waiting:false,error:false};}
function applyOp(a,b,op){if(op==='+')return a+b;if(op==='−')return a-b;if(op==='×')return a*b;if(op==='÷'){if(b===0)throw new Error('divide_by_zero');return a/b;}throw new Error('bad_operator');}
function cleanNumber(n){if(!Number.isFinite(n))throw new Error('invalid_result');const rounded=Math.round((n+Number.EPSILON)*1e10)/1e10;return String(rounded);}
function calculatorPress(state,key){state={...state};if(key==='C')return calcInitial();if(key==='⌫'){if(state.waiting||state.error)return calcInitial();const next=state.display.length>1?state.display.slice(0,-1):'0';state.display=(next===''||next==='-')?'0':next;return state;}if(key==='±'){if(state.error)return calcInitial();if(state.display!=='0')state.display=state.display.startsWith('-')?state.display.slice(1):'-'+state.display;return state;}if(key==='%'){if(state.error)return calcInitial();const current=Number(state.display.replace(',','.'));if(!Number.isFinite(current))return calcInitial();state.display=cleanNumber(current/100).replace('.',',');return state;}if(/^[0-9]$/.test(key)||key===','){if(state.error)state=calcInitial();if(state.waiting){state.display=key===','?'0,':key;state.waiting=false;return state;}if(key===','){if(!state.display.includes(','))state.display+=',';return state;}state.display=state.display==='0'?key:state.display+key;return state;}if(['+','−','×','÷'].includes(key)){if(state.error)return calcInitial();const current=Number(state.display.replace(',','.'));try{if(state.stored!==null&&!state.waiting)state.stored=applyOp(state.stored,current,state.operator);else state.stored=current;state.display=cleanNumber(state.stored).replace('.',',');state.operator=key;state.waiting=true;return state;}catch{return {...calcInitial(),display:'Hata',error:true};}}if(key==='='){if(state.error||state.operator===null||state.stored===null)return state;const current=Number(state.display.replace(',','.'));try{const r=applyOp(state.stored,current,state.operator);return {...calcInitial(),display:cleanNumber(r).replace('.',',')};}catch{return {...calcInitial(),display:'Hata',error:true};}}return state;}
return {MARKET,marketFor,effectiveReference,productValue,groupExpenseSections,parcelSummaries,topExpenseCategories,calcInitial,calculatorPress};
});