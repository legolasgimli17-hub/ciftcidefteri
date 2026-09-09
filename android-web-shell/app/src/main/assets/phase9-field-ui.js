(function(){
'use strict';
if(window.__EKINCEP_PHASE9__)return;
window.__EKINCEP_PHASE9__=true;
const BRAND='EkinCep';
const DESCRIPTION='Çiftçiler için tarla gideri, gelir, borç, stok, hava ve ürün değeri takibini tek yerde sunan güvenli ve çevrimdışı çalışabilen tarla defteri.';

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
.ec-fieldBadge{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:850;color:#173f30;background:#edf6f0;border:1px solid #bad1c3;border-radius:999px;padding:7px 10px}.ec-fieldBadge:before{content:'';width:7px;height:7px;border-radius:50%;background:#2d7a59}
@media(prefers-contrast:more){body{background:#fff!important}.card,.menuBtn,.p5-stat,.p5-farmCard,.p5-group{border-width:2px!important;box-shadow:none!important}.sub,.hint,label,.ec-toolCopy small{color:#354039!important}.top,.hero,.bottom,.p5-marketHero,.p5-calcShell{background:#0a1016!important}}
@media(max-width:420px){button,.action,.primary,.small,.menuBtn,.p5-edit,.tp-delete,.p4-ghost{min-height:54px!important}.nav button{min-height:62px!important;font-size:11px!important}}
`;
document.head.appendChild(css);

function replaceBrandText(root=document.body){const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const n of nodes){const before=n.nodeValue||'';const after=before.replace(/Tarla\s*Pusula/gi,BRAND).replace(/TarlaPusula/g,BRAND).replace(/Çiftçi Defteri/g,BRAND);if(after!==before)n.nodeValue=after;}}
function decorateStatus(){const s=document.getElementById('storageStatus');if(!s)return;s.textContent=s.textContent.replace(/Offline/gi,'Çevrimdışı hazır').replace(/İnternetsiz çalışır/gi,'Çevrimdışı hazır');s.classList.add('ec-fieldBadge');}
function run(){replaceBrandText();decorateStatus();}
run();let queued=false;const mo=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;run();});});mo.observe(document.body,{childList:true,subtree:true,characterData:true});
window.addEventListener('offline',()=>{decorateStatus();try{toast('İnternet yok — kayıtların cihazında çalışmaya devam eder.')}catch{}});
window.addEventListener('online',()=>{try{toast('İnternet bağlantısı geri geldi.')}catch{}});
})();
