(function(){
'use strict';
if(window.__EKINCEP_PHASE9__)return;
window.__EKINCEP_PHASE9__=true;
const BRAND='EkinCep';
const BUILD='SAHA v12.1';
const DESCRIPTION='Çiftçiler için tarla gideri, gelir, borç, stok, hava, uydu ve ürün değeri takibini tek yerde sunan güvenli ve çevrimdışı çalışabilen tarla defteri.';
const CROP_EXPENSES={
  pamuk:['Çırçır / ginleme','Pamuk toplama işçiliği','Beyaz sinek / yaprak biti ilacı'],
  misir:['Mısır kurutma','Koçan / dane hasadı','Azotlu üst gübre'],
  bugday:['Buğday biçerdöveri','Lisanslı depo / nakliye','Sapa kalkma gübresi'],
  findik:['Budama işçiliği','Fındık toplama işçiliği','Kurutma / patoz'],
  tutun:['Kırma / dizme işçiliği','Tütün kurutma yakıtı','Fide / dikim'],
  sebze:['Hal / komisyoncu kesintisi','Sera / örtü masrafı','Sık hasat işçiliği']
};
const DEBT_SOURCES=['Banka kredisi (nakdi)','Tarım Kredi ayni kredi','Tarım Kredi nakdi kredi','Özel şahıs borcu','Çek / senet','Diğer'];

document.title=BRAND+' — Tarla defteri ve saha takibi';
function meta(name,content,property){let el=document.head.querySelector(property?`meta[property="${name}"]`:`meta[name="${name}"]`);if(!el){el=document.createElement('meta');el.setAttribute(property?'property':'name',name);document.head.appendChild(el);}el.setAttribute('content',content);}
meta('description',DESCRIPTION);meta('application-name',BRAND);meta('og:title',BRAND+' — Tarla defteri ve saha takibi',true);meta('og:description',DESCRIPTION,true);meta('og:type','website',true);

const css=document.createElement('style');css.textContent=`
/* Phase 9 — direct sunlight / glove-friendly field ergonomics */
:root{--field-ink:#0a1016;--field-muted:#4f5b65;--field-line:#bfc7c3;--field-focus:#9a581f;--field-card:#fff}
body{color:var(--field-ink)!important}.card,.p5-stat,.p5-farmCard,.p5-group,.menuBtn{border-color:var(--field-line)!important}.sub,.hint,label,.ec-toolCopy small,.p5-stat span{color:var(--field-muted)!important}
button,.action,.primary,.small,.menuBtn,.p5-edit,.tp-delete,.p4-ghost,.p5-key,.nav button{min-height:52px!important;touch-action:manipulation}
input,select,textarea{min-height:54px!important;font-size:16px!important;border-width:1.5px!important;border-color:#aeb8b3!important}
button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #f2a65a!important;outline-offset:2px!important}
.nav button{padding-left:5px!important;padding-right:5px!important}.menuBtn{min-height:146px!important}.p5-record{padding-top:13px!important;padding-bottom:13px!important}.p5-edit,.tp-delete{padding:10px 13px!important}
.ec-fieldBadge{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:850;color:#173f30;background:#edf6f0;border:1px solid #bad1c3;border-radius:999px;padding:7px 10px}.ec-fieldBadge:before{content:'';width:7px;height:7px;border-radius:50%;background:#2d7a59}.ec-debtSource{margin-top:10px}.ec-buildBadge{display:inline-flex;align-items:center;min-height:30px;padding:0 9px;border:1px solid #202521;background:#202521;color:#fff;border-radius:8px;font-size:10px;font-weight:950;letter-spacing:.35px;white-space:nowrap;margin-left:8px;vertical-align:middle}
@media(prefers-contrast:more){body{background:#fff!important}.card,.menuBtn,.p5-stat,.p5-farmCard,.p5-group{border-width:2px!important;box-shadow:none!important}.sub,.hint,label,.ec-toolCopy small{color:#354039!important}.top,.hero,.bottom,.p5-marketHero,.p5-calcShell{background:#0a1016!important}}
@media(max-width:420px){button,.action,.primary,.small,.menuBtn,.p5-edit,.tp-delete,.p4-ghost{min-height:54px!important}.nav button{min-height:62px!important;font-size:11px!important}.ec-buildBadge{font-size:9px;padding:0 7px}}
`;
document.head.appendChild(css);

function replaceBrandText(root=document.body){const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const n of nodes){const before=n.nodeValue||'';const after=before.replace(/Tarla\s*Pusula/gi,BRAND).replace(/TarlaPusula/g,BRAND).replace(/Çiftçi Defteri/g,BRAND);if(after!==before)n.nodeValue=after;}}
function decorateStatus(){const s=document.getElementById('storageStatus');if(!s)return;s.textContent=s.textContent.replace(/Offline/gi,'Çevrimdışı hazır').replace(/İnternetsiz çalışır/gi,'Çevrimdışı hazır');s.classList.add('ec-fieldBadge');}
function decorateBuild(){if(document.getElementById('ecBuildBadge'))return;const brand=document.querySelector('.brand')||document.querySelector('.top');if(!brand)return;const b=document.createElement('span');b.id='ecBuildBadge';b.className='ec-buildBadge';b.textContent=BUILD;brand.appendChild(b);}
function normCrop(value){return String(value||'').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o').replace(/ç/g,'c');}
function cropSuggestions(value){const n=normCrop(value);if(n.includes('pamuk'))return CROP_EXPENSES.pamuk;if(n.includes('misir'))return CROP_EXPENSES.misir;if(n.includes('bugday')||n.includes('arpa'))return CROP_EXPENSES.bugday;if(n.includes('findik'))return CROP_EXPENSES.findik;if(n.includes('tutun'))return CROP_EXPENSES.tutun;if(/domates|biber|patlican|salatalik|kabak|sogan|sarimsak|patates|fasulye|bezelye|bamya|lahana|karnabahar|brokoli|marul|ispanak|havuc|turp|kavun|karpuz/.test(n))return CROP_EXPENSES.sebze;return[];}
function applyCropAwareCategories(){const category=document.getElementById('txCategory'),crop=document.getElementById('cropItem'),segOut=document.getElementById('segOut');if(!category||!crop)return;if(!crop.dataset.ekCropBound){crop.dataset.ekCropBound='1';crop.addEventListener('change',()=>{category.dataset.ekCropSig='';applyCropAwareCategories();});}const isExpense=!!segOut?.classList.contains('on'),items=isExpense?cropSuggestions(crop.value):[],sig=(isExpense?'expense:':'other:')+normCrop(crop.value);if(category.dataset.ekCropSig===sig&&(!items.length||category.querySelector('option[data-ek-crop="1"]')))return;category.querySelectorAll('option[data-ek-crop="1"]').forEach(o=>o.remove());category.dataset.ekCropSig=sig;if(!items.length)return;const existing=new Set([...category.options].map(o=>o.value));for(const item of [...items].reverse()){if(existing.has(item))continue;const option=document.createElement('option');option.value=item;option.textContent=item;option.dataset.ekCrop='1';category.insertBefore(option,category.firstChild);}}
function enhanceDebtSource(){const party=document.getElementById('debtParty');if(!party||document.getElementById('debtCreditType'))return;const label=document.createElement('label');label.className='ec-debtSource';label.textContent='Bu borç nereden?';const select=document.createElement('select');select.id='debtCreditType';select.innerHTML=DEBT_SOURCES.map(x=>`<option>${x}</option>`).join('');party.previousElementSibling?.insertAdjacentElement('beforebegin',label);label.insertAdjacentElement('afterend',select);}
function installDebtCapture(){if(typeof window.addDebt!=='function'||window.addDebt.__ekDebtSource)return;const original=window.addDebt;const wrapped=async function(){const before=new Set((app.debts||[]).map(d=>d.id)),source=document.getElementById('debtCreditType')?.value||'Diğer',result=await original.apply(this,arguments),added=(app.debts||[]).find(d=>!before.has(d.id));if(added){added.creditType=source;added.note=added.note?source+' · '+added.note:source;await save();try{render();}catch{}}return result;};wrapped.__ekDebtSource=true;window.addDebt=wrapped;}
function run(){replaceBrandText();decorateStatus();decorateBuild();applyCropAwareCategories();enhanceDebtSource();installDebtCapture();}
run();let queued=false;const mo=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;run();});});mo.observe(document.body,{childList:true,subtree:true,characterData:true});
window.addEventListener('offline',()=>{decorateStatus();try{toast('İnternet yok — kayıtların cihazında çalışmaya devam eder.')}catch{}});
window.addEventListener('online',()=>{try{toast('İnternet bağlantısı geri geldi.')}catch{}});
})();
