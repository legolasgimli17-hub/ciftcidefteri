(function(){
'use strict';
if(window.__EKINCEP_PHASE11__)return;
window.__EKINCEP_PHASE11__=true;

// Ticari kullanıma uygun CC0 gerçek tarım fotoğrafları — Wikimedia Commons.
const PHOTO={
  wheat:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Bu%C4%9Fday_Tarlas%C4%B1_-_Wheat_field.jpg?width=1280',
  corn:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Corn_Field_(158758545).jpeg?width=1280',
  tomato:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Tomato_-_plant.jpg?width=1000'
};
const SVG={
  home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.2 12 4l9 7.2v8.3a1.5 1.5 0 0 1-1.5 1.5h-5.2v-6.2H9.7V21H4.5A1.5 1.5 0 0 1 3 19.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  add:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  book:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.8h9.2A2.8 2.8 0 0 1 17 7.6V20H7.7A2.7 2.7 0 0 1 5 17.3zM17 7.8h2v12.1h-2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  wallet:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h15a1 1 0 0 1 1 1v9.8a1.7 1.7 0 0 1-1.7 1.7H5.7A1.7 1.7 0 0 1 4 18.3zM4 7.5V6.8A2.8 2.8 0 0 1 6.8 4h9.7v3.5M16.5 12.3H20v3.5h-3.5a1.75 1.75 0 1 1 0-3.5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  grid:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>'
};

const css=document.createElement('style');
css.textContent=`
:root{--ec11-bg:#f1efe8;--ec11-card:#fffdf9;--ec11-ink:#111820;--ec11-muted:#64706a;--ec11-green:#164d38;--ec11-green2:#0d3527;--ec11-gold:#e49a52;--ec11-line:#d8ddd8;--ec11-shadow:0 18px 46px rgba(20,39,30,.09)}
html,body{background:var(--ec11-bg)!important;color:var(--ec11-ink)!important}.wrap{max-width:900px!important;padding:12px 13px 34px!important}.top{margin:4px 0 13px!important;padding:3px 2px}.brand{display:flex;align-items:center;gap:10px;font-size:23px!important;letter-spacing:-.035em;color:var(--ec11-ink)}.ec11-mark{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:linear-gradient(145deg,#13231d,#0b1511);box-shadow:0 8px 20px rgba(13,53,39,.2)}.ec11-mark svg{width:24px;height:24px}.ec11-brandCopy{display:grid;line-height:1.03}.ec11-brandCopy small{margin-top:5px;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#78817c;font-weight:900}.status{font-size:10.5px!important;padding:7px 9px!important;background:#e9f0eb!important;border-color:#c5d4ca!important;box-shadow:none!important}
.hero{position:relative;isolation:isolate;overflow:hidden!important;min-height:230px;padding:22px!important;border-radius:26px!important;background:linear-gradient(120deg,rgba(7,20,15,.93),rgba(14,58,42,.78)),var(--ec11-photo)!important;background-size:cover!important;background-position:center!important;box-shadow:0 20px 50px rgba(14,45,33,.2)!important;border:1px solid rgba(255,255,255,.08)!important}.hero:after{content:'';position:absolute;z-index:-1;inset:auto -80px -100px auto;width:220px;height:220px;border-radius:50%;background:rgba(228,154,82,.16);filter:blur(2px)}.hero>small{display:inline-flex;padding:7px 10px;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:rgba(5,14,11,.28);backdrop-filter:blur(8px);font-size:10px;letter-spacing:.1em}.hero .big{font-size:39px!important;letter-spacing:-.045em;margin-top:12px!important;text-shadow:0 2px 18px rgba(0,0,0,.18)}.metrics{gap:7px!important}.metric{min-height:69px;padding:10px 11px!important;border:1px solid rgba(255,255,255,.12);background:rgba(8,22,16,.4)!important;backdrop-filter:blur(10px);border-radius:14px!important}.metric small{font-size:9px;letter-spacing:.07em}.metric b{font-size:15px!important}
.actions{gap:9px!important;margin:11px 0 0!important}.action{min-height:58px!important;border-radius:16px!important;padding:14px!important;font-size:15.5px!important;box-shadow:none}.action.income{background:linear-gradient(135deg,#19573f,#103c2c)!important}.action.expense{border:1px solid #d6d9d5!important;background:#fffdf9!important;color:#7f352f!important}
.card,.p5-stat,.p5-farmCard,.p5-group,.menuBtn{background:var(--ec11-card)!important;border-color:var(--ec11-line)!important;box-shadow:0 8px 26px rgba(20,39,30,.045)!important}.card{border-radius:19px!important;padding:16px!important}.card h2,.p5-sectionTitle h2{letter-spacing:-.025em;color:var(--ec11-ink)}
.ec10-live{border:0!important;border-radius:24px!important;background:linear-gradient(145deg,#111b17,#0b1411)!important;color:#fff;box-shadow:0 18px 44px rgba(11,20,17,.16)!important}.ec10-liveHead{padding:17px 17px 13px!important}.ec10-kicker{color:#f0a25b!important}.ec10-liveHead h2{font-size:21px!important;letter-spacing:-.035em}.ec10-badge{background:rgba(255,255,255,.1)!important;color:#e4eee8!important}.ec10-dataGrid{border-top-color:rgba(255,255,255,.1)!important}.ec10-data+.ec10-data{border-left-color:rgba(255,255,255,.1)!important}.ec10-data small{color:#9fb0a7!important}.ec10-data strong{color:#fff!important;letter-spacing:-.02em}.ec10-data span,.ec10-note{color:#aebbb5!important}.ec10-actions{padding:1px 14px 14px!important}.ec10-btn{border-color:rgba(255,255,255,.16)!important}.ec10-btn.dark{background:#f0a25b!important;color:#17110c!important;border-color:#f0a25b!important}.ec10-btn:not(.dark){background:rgba(255,255,255,.08)!important;color:#fff!important}.ec10-satCard{border-radius:22px!important;box-shadow:var(--ec11-shadow)!important}.ec10-satHero{height:190px!important}
.ec11-farmBlock{margin-top:13px}.ec11-sectionHead{display:flex;justify-content:space-between;align-items:end;gap:12px;margin:18px 2px 9px}.ec11-sectionHead small{display:block;font-size:10px;font-weight:950;letter-spacing:.11em;color:#97704d;text-transform:uppercase}.ec11-sectionHead h2{font-size:22px;margin:4px 0 0;letter-spacing:-.04em}.ec11-sectionHead span{font-size:11px;color:var(--ec11-muted);text-align:right}.ec11-rail{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(225px,72%);gap:10px;overflow:auto;padding:1px 1px 5px;scroll-snap-type:x mandatory;scrollbar-width:none}.ec11-rail::-webkit-scrollbar{display:none}.ec11-field{position:relative;min-height:178px;overflow:hidden;border-radius:20px;background:#20362b;color:#fff;scroll-snap-align:start;box-shadow:0 13px 30px rgba(16,36,27,.12)}.ec11-field img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.ec11-field:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,10,8,.05) 15%,rgba(5,12,9,.83) 100%)}.ec11-fieldCopy{position:absolute;z-index:2;left:15px;right:15px;bottom:14px}.ec11-fieldCopy small{font-size:10px;color:#dae3de;font-weight:800}.ec11-fieldCopy b{display:block;font-size:19px;letter-spacing:-.025em;margin-top:3px}.ec11-fieldCopy span{display:block;font-size:11px;color:#d3ddd7;margin-top:3px}.ec11-photoSource{font-size:9px;color:#838d87;margin:5px 2px 0}.ec11-emptyFarm{border:1px dashed #b8c3bc;border-radius:20px;background:#f8f8f3;padding:20px}.ec11-emptyFarm b{display:block;font-size:18px}.ec11-emptyFarm p{color:var(--ec11-muted);font-size:12px;line-height:1.5}.ec11-emptyFarm button{min-height:52px;border:0;border-radius:13px;background:#133f2f;color:#fff;font-weight:900;padding:0 17px}
#ec11DeepSummary{margin-top:13px;border:1px solid var(--ec11-line);border-radius:19px;background:var(--ec11-card);overflow:hidden}#ec11DeepSummary>summary{list-style:none;min-height:58px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;font-weight:950;cursor:pointer}#ec11DeepSummary>summary::-webkit-details-marker{display:none}#ec11DeepSummary>summary:after{content:'+';font-size:21px;color:#6b766f}#ec11DeepSummary[open]>summary:after{content:'−'}#ec11DeepSummary>#p5Home{padding:0 14px 14px}#ec11DeepSummary #p5Home>.p5-sectionTitle:first-child{margin-top:4px}
.menuGrid{gap:10px!important}.menuBtn{min-height:128px!important;border-radius:18px!important;padding:15px!important;transition:transform .16s ease,box-shadow .16s ease}.menuBtn:active{transform:scale(.985)}
.bottom{background:rgba(255,253,249,.94)!important;backdrop-filter:blur(18px);border-top-color:#d9ddd8!important;padding:5px 5px calc(7px + env(safe-area-inset-bottom))!important}.nav{gap:2px!important}.nav button{display:grid!important;place-items:center;gap:2px;min-height:58px!important;border-radius:13px!important;padding:5px 2px!important;font-size:9.5px!important}.nav button svg{width:21px;height:21px}.nav button.active{background:#e8f0eb!important;color:#174c38!important}.ec11-navText{display:block}
input,select,textarea{background:#fffefa!important;border-color:#c6cec9!important;border-radius:13px!important}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline-color:#e49a52!important}
@media(min-width:650px){.ec11-rail{grid-auto-columns:minmax(240px,32%)}.hero{min-height:250px}.menuGrid{grid-template-columns:repeat(3,1fr)!important}}
@media(max-width:390px){.hero{padding:18px!important;min-height:218px}.hero .big{font-size:34px!important}.metric{padding:9px!important}.ec11-rail{grid-auto-columns:82%}.ec10-dataGrid{grid-template-columns:1fr!important}}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
`;
document.head.appendChild(css);

function currentTransactions(){
  try{return typeof window.activeTransactions==='function'?window.activeTransactions():(app.transactions||[]).filter(t=>!t.deletedAt);}catch{return [];}
}
function photoFor(crop){const c=String(crop||'').toLocaleLowerCase('tr');if(/mısır|misir/.test(c))return PHOTO.corn;if(/domates|biber|patlıcan|salatalık|kabak|sebze/.test(c))return PHOTO.tomato;return PHOTO.wheat;}
function latestCrop(){const list=currentTransactions().filter(t=>t.crop);return list.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))[0]?.crop||'Buğday';}
function fieldModels(){
  const map=new Map();
  for(const t of currentTransactions()){
    const parcel=String(t.parcel||'').trim();if(!parcel)continue;
    const prev=map.get(parcel);
    if(!prev||String(t.date||'')>=String(prev.date||''))map.set(parcel,{parcel,crop:t.crop||'Genel',date:t.date||'',category:t.category||''});
  }
  return [...map.values()].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,4);
}
function topIdentity(){
  const brand=document.querySelector('.brand');if(!brand||brand.dataset.ec11)return;brand.dataset.ec11='1';brand.innerHTML=`<span class="ec11-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M7 22c6-7 11-10 19-11M7 26c7-5 13-7 19-6" fill="none" stroke="#78c9a3" stroke-width="2.2" stroke-linecap="round"/><path d="M9 17c4-4 8-6 13-8" fill="none" stroke="#f0a25b" stroke-width="2.1" stroke-linecap="round"/></svg></span><span class="ec11-brandCopy"><span>EkinCep</span><small>Çiftlik komuta merkezi</small></span>`;
}
function hero(){
  const el=document.querySelector('#home>.hero');if(!el)return;el.style.setProperty('--ec11-photo',`url("${photoFor(latestCrop())}")`);const label=el.querySelector(':scope>small');if(label)label.textContent='BU SEZON NET';
  const income=document.querySelector('.actions .income'),expense=document.querySelector('.actions .expense');if(income)income.textContent='Gelir ekle';if(expense)expense.textContent='Masraf ekle';
}
function renderFarmRail(){
  const home=document.getElementById('home');if(!home)return;let host=document.getElementById('ec11FarmBlock');if(!host){host=document.createElement('section');host.id='ec11FarmBlock';host.className='ec11-farmBlock';const live=document.getElementById('ec10Command');const actions=home.querySelector('.actions');(live||actions)?.insertAdjacentElement('afterend',host);}const fields=fieldModels();
  const signature=fields.length?fields.map(f=>[f.parcel,f.crop,f.date,f.category].join('|')).join('||'):'empty';if(host.dataset.signature===signature)return;host.dataset.signature=signature;
  if(!fields.length){host.innerHTML=`<div class="ec11-sectionHead"><div><small>Tarlaların</small><h2>Sahadaki işler</h2></div></div><div class="ec11-emptyFarm"><b>İlk tarlanı ekle</b><p>Bir gelir veya masraf kaydıyla tarla adını gir. EkinCep o tarlanın maliyetini, uydu konumunu ve sezon sonucunu tek yerde toplayacak.</p><button type="button" onclick="openTx('expense')">İlk kaydı ekle</button></div>`;return;}
  host.innerHTML=`<div class="ec11-sectionHead"><div><small>Tarlaların</small><h2>Sahadaki işler</h2></div><span>${fields.length} tarla / parsel</span></div><div class="ec11-rail">${fields.map(f=>`<article class="ec11-field"><img loading="lazy" decoding="async" src="${photoFor(f.crop)}" alt="${String(f.crop||'Tarla').replace(/[&<>"']/g,'')}"><div class="ec11-fieldCopy"><small>${f.crop||'Genel'}</small><b>${String(f.parcel).replace(/[&<>"']/g,'')}</b><span>${[f.category,f.date].filter(Boolean).join(' · ')}</span></div></article>`).join('')}</div><div class="ec11-photoSource">Gerçek tarım fotoğrafları · CC0 / Wikimedia Commons</div>`;
}
function collapseDeepSummary(){
  const p5=document.getElementById('p5Home');if(!p5||p5.closest('#ec11DeepSummary'))return;const d=document.createElement('details');d.id='ec11DeepSummary';d.innerHTML='<summary>Detaylı çiftlik özeti</summary>';p5.parentNode.insertBefore(d,p5);d.appendChild(p5);
}
function nav(){
  const map=[['nHome',SVG.home,'Ana sayfa'],['nTx',SVG.add,'Kayıt'],['nLedger',SVG.book,'Defter'],['nDebts',SVG.wallet,'Borçlar'],['nMore',SVG.grid,'Diğer']];for(const [id,icon,label] of map){const b=document.getElementById(id);if(!b||b.dataset.ec11)return;b.dataset.ec11='1';b.innerHTML=`${icon}<span class="ec11-navText">${label}</span>`;b.setAttribute('aria-label',label);}
}
function polishCards(){
  const home=document.getElementById('home');if(!home)return;for(const card of home.querySelectorAll(':scope>.card'))card.classList.add('ec11-sectionCard');
}
function cleanSourceLabels(){
  const root=document.getElementById('ec10Command');if(!root)return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const node of nodes){const before=node.nodeValue||'';const after=before.replace('TOBB günlük borsa verisi bağlanıyor.','Resmî borsa verisi bağlanıyor.');if(before!==after)node.nodeValue=after;}
}
function run(){topIdentity();hero();renderFarmRail();collapseDeepSummary();nav();polishCards();cleanSourceLabels();}
run();
let scheduled=false;const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;run();});});observer.observe(document.body,{childList:true,subtree:true});
})();