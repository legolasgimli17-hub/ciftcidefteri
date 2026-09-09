(function(){
'use strict';
if(window.__EKINCEP_PHASE8__)return;
window.__EKINCEP_PHASE8__=true;

const BRAND='EkinCep';
const TAGLINE='Tarlan, paran, hava ve ürün değeri tek yerde';
document.title=BRAND;

function brandMark(sizeClass=''){
  return `<span class="ec-logo ${sizeClass}" aria-hidden="true"><svg viewBox="0 0 48 48" role="img"><rect x="2" y="2" width="44" height="44" rx="10" fill="#202521"/><path d="M8.5 31c7.8-6 16.8-8.7 30.5-8" stroke="#F5F7F2" stroke-width="2.5" stroke-linecap="round" fill="none"/><path d="M8.5 37c8.6-5.4 18.2-7 30.5-5.8" stroke="#376B43" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M12 25c4.4-4.4 9.5-7.1 15.6-8.6" stroke="#24717A" stroke-width="2.3" stroke-linecap="round" fill="none"/><circle cx="35" cy="13" r="3.7" fill="#C79B35"/></svg></span>`;
}

function iconSvg(name){
  const paths={
    calculator:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"/>',
    market:'<path d="M4 19V8M10 19V12M16 19V5M3 19h18"/><path d="m5 11 4-3 4 2 6-6"/>',
    stock:'<path d="M4 8 12 4l8 4-8 4-8-4Z"/><path d="M4 8v8l8 4 8-4V8M12 12v8"/>',
    partners:'<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M3 19c.8-3.1 2.6-4.7 5-4.7S12.2 15.9 13 19M11 19c.7-2.8 2.4-4.3 5-4.3 2.4 0 4.1 1.4 5 4.3"/>',
    backup:'<path d="M12 4v11M8 8l4-4 4 4"/><path d="M5 14v5h14v-5"/>',
    weather:'<path d="M7 17h10.5a3.5 3.5 0 0 0 .2-7A5.5 5.5 0 0 0 7.2 9.2 4 4 0 0 0 7 17Z"/><path d="M8 20h.01M12 20h.01M16 20h.01"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]||paths.stock}</svg>`;
}

const style=document.createElement('style');
style.textContent=`
:root{
  --ec-basalt:#202521;--ec-cotton:#F5F7F2;--ec-leaf:#376B43;--ec-water:#24717A;
  --ec-wheat:#C79B35;--ec-dry:#A64538;--ec-paper:#FFFFFF;--ec-ink:#182019;--ec-muted:#56615A;
  --ec-line:#CBD2CC;--ec-line-soft:#E3E8E3;--ec-field-soft:#EEF4EF;--ec-water-soft:#EAF3F4;
}
html,body{background:var(--ec-cotton)!important;color:var(--ec-ink)!important}
body{padding-bottom:96px!important;font-family:"Segoe UI",Roboto,Arial,sans-serif!important}
.wrap{max-width:900px!important;padding:12px 14px 36px!important}
.top{min-height:70px!important;margin:0 0 14px!important;padding:9px 2px 14px!important;border:0!important;border-bottom:1px solid var(--ec-line)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;color:var(--ec-ink)!important;gap:10px!important}
.tp-topCopy{min-width:0!important;gap:2px!important}.brand{font-size:inherit!important;gap:10px!important;color:var(--ec-ink)!important}.brand:before,.brand:after{content:none!important;display:none!important}
.ec-brandName{font-size:23px;font-weight:900;letter-spacing:-.6px;color:var(--ec-basalt);white-space:nowrap}.tp-subtitle{margin:1px 0 0!important;padding-left:48px!important;color:var(--ec-muted)!important;font-size:11px!important;font-weight:650!important;max-width:430px!important}
.ec-logo{width:38px;height:38px;display:inline-grid;place-items:center;flex:0 0 38px}.ec-logo svg{width:100%;height:100%;display:block}.ec-logo.large{width:60px;height:60px;flex-basis:60px}
.status,.ec-fieldBadge{min-height:36px!important;display:inline-flex!important;align-items:center!important;background:var(--ec-field-soft)!important;border:1px solid #B8CDBD!important;color:#264E36!important;box-shadow:none!important;font-size:10.5px!important;white-space:nowrap!important;padding:7px 10px!important;border-radius:999px!important}
.hero{border:0!important;border-bottom:1px solid var(--ec-line)!important;border-radius:0!important;padding:23px 2px 21px!important;background:transparent!important;box-shadow:none!important;color:var(--ec-ink)!important}
.hero:after{display:none!important}.hero small{color:var(--ec-muted)!important;opacity:1!important;letter-spacing:0!important;text-transform:none!important;font-weight:750!important}
.big{font-family:Georgia,"Times New Roman",serif!important;color:var(--ec-basalt)!important;font-size:38px!important;line-height:1!important;letter-spacing:-1.4px!important;font-variant-numeric:tabular-nums!important}
.metrics{border-top:1px solid var(--ec-line-soft)!important;gap:0!important}.metric{background:transparent!important;border:0!important;border-left:1px solid var(--ec-line-soft)!important;border-radius:0!important;padding:11px 12px!important;backdrop-filter:none!important}.metric:first-child{border-left:0!important;padding-left:0!important}.metric b{color:var(--ec-basalt)!important}.metric:first-child b{color:var(--ec-leaf)!important}
.card{border:1px solid var(--ec-line)!important;background:var(--ec-paper)!important;border-radius:10px!important;padding:17px!important;box-shadow:none!important}.card h2{font-size:20px!important;letter-spacing:-.35px!important;color:var(--ec-basalt)!important}
.actions{gap:8px!important}.action{min-height:56px!important;border-radius:8px!important;box-shadow:none!important}.income{background:var(--ec-leaf)!important;border:1px solid var(--ec-leaf)!important;color:#fff!important}.expense{background:#fff!important;border:1.5px solid #D4AAA5!important;color:#8E382F!important}
input,select,textarea{min-height:54px!important;border-radius:8px!important;border:1.5px solid #AEB8B1!important;background:#fff!important;color:var(--ec-ink)!important;box-shadow:none!important;font-size:16px!important}input:focus,select:focus,textarea:focus{border-color:var(--ec-water)!important;box-shadow:0 0 0 3px rgba(36,113,122,.15)!important}
.primary{min-height:54px!important;border-radius:8px!important;background:var(--ec-basalt)!important;color:#fff!important;box-shadow:none!important;font-weight:900!important}
.segment,.p3-segment{background:#E9EDE9!important;border-radius:8px!important}.segment button,.p3-segment button{min-height:48px!important}.segment button.on,.p3-segment button.on{background:#fff!important;color:var(--ec-basalt)!important;box-shadow:inset 0 0 0 1px var(--ec-line)!important}
.p5-eyebrow{display:none!important}.p5-sectionTitle{margin:22px 2px 9px!important}.p5-sectionTitle h2{font-size:21px!important;color:var(--ec-basalt)!important}
.p5-grid{gap:0!important;border-top:1px solid var(--ec-line)!important;border-bottom:1px solid var(--ec-line)!important}.p5-stat{border:0!important;border-right:1px solid var(--ec-line-soft)!important;border-bottom:1px solid var(--ec-line-soft)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;padding:14px 12px!important}.p5-stat:nth-child(2n){border-right:0!important}.p5-stat:nth-last-child(-n+2){border-bottom:0!important}.p5-stat span{color:var(--ec-muted)!important}.p5-stat b{color:var(--ec-basalt)!important}
.p5-farmCard{position:relative!important;border:1px solid #BFD0C2!important;border-radius:8px 8px 0 8px!important;background:#F7FAF7!important;box-shadow:none!important;clip-path:polygon(0 0,100% 0,100% calc(100% - 16px),calc(100% - 16px) 100%,0 100%)!important}.p5-farmName{color:var(--ec-basalt)!important}.p5-mini{color:var(--ec-muted)!important}
.p5-barTrack{height:6px!important;background:#E5EAE5!important;border-radius:0!important}.p5-barFill{background:var(--ec-leaf)!important;border-radius:0!important}
.p5-group{border-radius:8px!important;border-color:var(--ec-line)!important;box-shadow:none!important}.p5-groupHead{background:#F6F8F6!important;border-bottom-color:var(--ec-line)!important}.p5-record{border-color:var(--ec-line-soft)!important}.p5-edit{min-height:48px!important;border-radius:7px!important;background:#F2F7F3!important;border-color:#B8CDBD!important;color:#28563B!important}.tp-delete{min-height:48px!important;border-radius:7px!important}
.p5-marketHero{border-radius:0!important;background:var(--ec-basalt)!important;border:0!important;border-left:5px solid var(--ec-wheat)!important;box-shadow:none!important}.p5-marketHero .big{color:#fff!important}.p5-marketRow{border-color:var(--ec-line-soft)!important}.p5-price{color:#755B17!important}
.p5-calcShell{border-radius:10px!important;background:var(--ec-basalt)!important;border:0!important;box-shadow:none!important}.p5-key{min-height:52px!important;border-radius:8px!important;background:#333A35!important}.p5-key.op{background:var(--ec-wheat)!important;color:#1F231F!important}.p5-key.util{background:#59615B!important}.p5-key.zero{border-radius:8px!important}
.p4-weather{background:var(--ec-water-soft)!important;border:0!important;border-left:4px solid var(--ec-water)!important;border-radius:0 10px 10px 0!important;box-shadow:none!important}.p4-weather-title,.p4-weather-desc{color:#18565D!important}.p4-day{border-radius:7px!important;border-color:#C9DBDD!important}.p4-alert{border-radius:6px!important}.p4-ghost{min-height:48px!important;border-radius:7px!important}
.menuGrid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:0!important;border:1px solid var(--ec-line)!important;border-radius:9px!important;overflow:hidden!important;background:#fff!important}.menuBtn{min-height:112px!important;padding:15px!important;border:0!important;border-right:1px solid var(--ec-line-soft)!important;border-bottom:1px solid var(--ec-line-soft)!important;border-radius:0!important;background:#fff!important;box-shadow:none!important;display:grid!important;grid-template-columns:auto 1fr!important;grid-template-rows:auto 1fr!important;column-gap:11px!important;row-gap:10px!important;align-items:start!important}.menuBtn:nth-child(2n){border-right:0!important}.menuBtn:after{content:none!important;display:none!important}.ec-toolIcon{grid-column:1;grid-row:1;width:38px;height:38px;border-radius:8px;background:var(--ec-field-soft);display:grid;place-items:center;border:1px solid #CAD9CC}.ec-toolIcon svg{width:21px;height:21px;fill:none;stroke:var(--ec-leaf);stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.ec-toolIcon.weather{background:var(--ec-water-soft);border-color:#C7DADD}.ec-toolIcon.weather svg{stroke:var(--ec-water)}.ec-toolIcon.market{background:#F7F1E1;border-color:#DED0A5}.ec-toolIcon.market svg{stroke:#8B6C19}.ec-toolCopy{grid-column:1/3;grid-row:2;display:block!important;min-width:0}.ec-toolCopy strong{display:block!important;font-size:16.5px!important;line-height:1.15!important;letter-spacing:-.2px!important;color:var(--ec-basalt)!important}.ec-toolCopy small{display:block!important;margin-top:6px!important;font-size:12px!important;line-height:1.38!important;color:var(--ec-muted)!important;font-weight:650!important}.menuBtn .p4-menu-icon{display:none!important}
.bottom{background:rgba(245,247,242,.98)!important;border-top:1px solid var(--ec-line)!important;box-shadow:none!important;backdrop-filter:blur(12px)!important;padding:7px 6px calc(8px + env(safe-area-inset-bottom))!important}.nav button{min-height:58px!important;border-radius:7px!important;color:#5B665F!important;font-size:10.5px!important}.nav button.active{background:#E5ECE6!important;color:#214E34!important}.nav button .tp-navIcon svg{stroke:currentColor!important}.nav #nTx{background:var(--ec-basalt)!important;color:#fff!important;box-shadow:none!important}.nav #nTx.active{background:var(--ec-basalt)!important;color:#fff!important}
.empty{border-radius:7px!important;background:#F7F9F7!important;border-color:var(--ec-line)!important}.toast{border-radius:7px!important;background:var(--ec-basalt)!important}.tp-undo{background:var(--ec-basalt)!important;border:0!important;border-radius:8px!important}.tp-undo button{background:var(--ec-wheat)!important;color:#1D211E!important;border-radius:6px!important}
.tp-lock{background:var(--ec-basalt)!important;color:var(--ec-cotton)!important}.tp-lockCard{background:#292F2A!important;border:1px solid #465048!important;border-radius:12px!important;box-shadow:none!important}.tp-lockLogo{width:auto!important;height:auto!important;border-radius:0!important;background:none!important;display:block!important;margin-bottom:15px!important}.tp-lock h1{color:#fff!important}.tp-lock p{color:#D3DBD5!important}.tp-lockWarn{background:#343A35!important;border-color:#586159!important;color:#F1DCA3!important;border-radius:7px!important}.tp-lock input{background:#1B201C!important;border-color:#687169!important;color:#fff!important;border-radius:7px!important}.tp-lock input:focus{border-color:#76AAB0!important;box-shadow:0 0 0 3px rgba(36,113,122,.2)!important}.tp-lockBtn{background:var(--ec-cotton)!important;color:var(--ec-basalt)!important;border-radius:7px!important}.tp-lockError{color:#FFB3AB!important}.tp-modal{background:rgba(16,20,17,.62)!important}.tp-modalCard{border-radius:10px!important}.tp-modalActions button{border-radius:7px!important}
button,.small,.menuBtn,.p5-edit,.tp-delete,.p4-ghost,.p5-key,.nav button{touch-action:manipulation}
button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid var(--ec-water)!important;outline-offset:2px!important}
@media(max-width:420px){.wrap{padding-left:11px!important;padding-right:11px!important}.top{padding-left:0!important;padding-right:0!important}.ec-brandName{font-size:21px!important}.tp-subtitle{font-size:10px!important;padding-left:48px!important}.status{font-size:9.5px!important}.menuBtn{min-height:108px!important;padding:13px!important}.ec-toolCopy strong{font-size:16px!important}.ec-toolCopy small{font-size:11.5px!important}.big{font-size:34px!important}.metric{padding:10px 8px!important}}
@media(prefers-contrast:more){.card,.menuGrid,.p5-farmCard,.p5-group{border-width:2px!important}.sub,.hint,label,.ec-toolCopy small,.p5-stat span{color:#374139!important}}
`;
document.head.appendChild(style);

function polishBrand(){
  const brand=document.querySelector('.brand');
  if(brand){
    brand.innerHTML=`${brandMark()}<span class="ec-brandName">${BRAND}</span>`;
    brand.setAttribute('aria-label',BRAND);
  }
  const subtitle=document.getElementById('tpSubtitle')||document.querySelector('.tp-subtitle');
  if(subtitle)subtitle.textContent=TAGLINE;
  const lockLogo=document.querySelector('.tp-lockLogo');
  if(lockLogo)lockLogo.innerHTML=brandMark('large');
  const lockTitle=document.querySelector('.tp-lockCard h1');
  if(lockTitle&&/TarlaPusula|Çiftçi Defteri|kilitli/i.test(lockTitle.textContent||''))lockTitle.textContent=BRAND+' kilitli';
}

function toolInfo(button){
  const text=(button.textContent||'').toLocaleLowerCase('tr');
  if(text.includes('hesap'))return ['calculator','Hesap Makinesi','Telefon tipi ve tarla hesapları'];
  if(text.includes('piyasa')||text.includes('ürün değeri'))return ['market','Piyasa & Ürün Değeri','Referans fiyatlar ve elindeki ürün'];
  if(text.includes('elindekiler')||text.includes('stok'))return ['stock','Elindekiler','Gübre, ilaç, mazot ve ürün stoğu'];
  if(text.includes('ortak'))return ['partners','Ortaklık','Pay oranları ve ortak hesapları'];
  if(text.includes('yedek'))return ['backup','Yedek','PIN korumalı indir ve geri yükle'];
  if(text.includes('hava'))return ['weather','Hava durumu','İl / ilçe tahmini ve tarla uyarıları'];
  return null;
}

function polishTools(){
  document.querySelectorAll('.menuBtn').forEach(button=>{
    const info=toolInfo(button);if(!info)return;
    const signature=info.join('|');
    if(button.dataset.ecTool===signature)return;
    button.dataset.ecTool=signature;
    button.innerHTML=`<span class="ec-toolIcon ${info[0]}">${iconSvg(info[0])}</span><span class="ec-toolCopy"><strong>${info[1]}</strong><small>${info[2]}</small></span>`;
  });
}

function polishHeadings(){
  const moreTitle=document.querySelector('#more .card h2');if(moreTitle)moreTitle.textContent='Araçlar ve Ayarlar';
  const ledgerLead=document.querySelector('#ledger .tp-sectionLead');if(ledgerLead)ledgerLead.textContent='Kayıtların kategori bazında düzenli görünür; düzenleme ve güvenli silme burada yapılır.';
}

function run(){polishBrand();polishTools();polishHeadings();}
run();
const observer=new MutationObserver(()=>run());
observer.observe(document.body,{childList:true,subtree:true});
})();
