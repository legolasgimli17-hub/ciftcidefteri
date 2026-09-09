(function(){
'use strict';
if(window.__EKINCEP_PHASE8__)return;
window.__EKINCEP_PHASE8__=true;

const BRAND='EkinCep';
const TAGLINE='Tarlan, paran, hava ve ürün değeri tek yerde';
document.title=BRAND;

function brandMark(sizeClass=''){
  return `<span class="ec-logo ${sizeClass}" aria-hidden="true"><svg viewBox="0 0 48 48" role="img"><defs><linearGradient id="ecg" x1="7" y1="5" x2="41" y2="43" gradientUnits="userSpaceOnUse"><stop stop-color="#17202a"/><stop offset="1" stop-color="#0b1118"/></linearGradient></defs><rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="url(#ecg)"/><circle cx="34" cy="14" r="4.2" fill="#f0a158"/><path d="M9 31c8-7 17-10 30-9" stroke="#7fc7ff" stroke-width="2.6" stroke-linecap="round" fill="none"/><path d="M9 37c9-6 18-8 30-7" stroke="#77c6a3" stroke-width="2.6" stroke-linecap="round" fill="none"/><path d="M11 25c5-5 10-8 17-10" stroke="#dce5ea" stroke-opacity=".88" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg></span>`;
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
  --ec-bg:#f3f2ed;--ec-surface:#fff;--ec-surface2:#f8f7f2;--ec-ink:#111820;--ec-muted:#69737f;
  --ec-line:#dfe2df;--ec-line-strong:#cfd4d1;--ec-charcoal:#0d131a;--ec-charcoal2:#171e27;
  --ec-copper:#e79a53;--ec-copper2:#ffc37c;--ec-ice:#79c7ff;--ec-green:#2d7a59;--ec-green-soft:#e8f2ec;
  --ec-danger:#b54e4e;--ec-shadow:0 18px 48px rgba(14,22,30,.08);--ec-shadow-soft:0 7px 20px rgba(14,22,30,.055)
}
html,body{background:
  radial-gradient(circle at 92% 0%,rgba(231,154,83,.08),transparent 24%),
  radial-gradient(circle at 8% 16%,rgba(121,199,255,.08),transparent 24%),
  linear-gradient(180deg,#f7f6f1 0%,var(--ec-bg) 100%)!important;color:var(--ec-ink)!important}
body{padding-bottom:98px!important}
.wrap{max-width:860px!important;padding:16px 14px 38px!important}
.top{min-height:72px!important;margin:0 0 15px!important;padding:12px 13px!important;border-radius:18px!important;background:linear-gradient(145deg,var(--ec-charcoal2),var(--ec-charcoal))!important;border:1px solid rgba(255,255,255,.05)!important;box-shadow:0 16px 40px rgba(10,15,20,.14)!important;color:#fff!important;gap:10px!important}
.tp-topCopy{min-width:0!important;gap:2px!important}.brand{font-size:inherit!important;gap:10px!important;color:#fff!important}.brand:before,.brand:after{content:none!important;display:none!important}.ec-brandName{font-size:22px;font-weight:900;letter-spacing:-.45px;color:#f4efe6;white-space:nowrap}.tp-subtitle{margin:1px 0 0 0!important;padding-left:48px!important;color:#9faab7!important;font-size:10.8px!important;font-weight:650!important;max-width:390px!important}.ec-logo{width:38px;height:38px;display:inline-grid;place-items:center;flex:0 0 38px}.ec-logo svg{width:100%;height:100%;display:block}.ec-logo.large{width:58px;height:58px;flex-basis:58px}
.status{background:rgba(121,199,255,.08)!important;border:1px solid rgba(121,199,255,.2)!important;color:#b9ddf7!important;box-shadow:none!important;font-size:10px!important;white-space:nowrap!important;padding:7px 9px!important}
.hero{border-radius:20px!important;padding:21px!important;background:
  radial-gradient(circle at 88% 4%,rgba(231,154,83,.16),transparent 28%),
  radial-gradient(circle at 12% 92%,rgba(121,199,255,.09),transparent 28%),
  linear-gradient(145deg,#161e28,#0c1118)!important;border:1px solid rgba(255,255,255,.06)!important;box-shadow:0 20px 54px rgba(10,15,20,.2)!important}
.hero:after{display:none!important}.hero small{color:#99a5b2!important;opacity:1!important;letter-spacing:.12em!important}.big{color:#f6efe5!important;font-size:33px!important}.metric{background:rgba(255,255,255,.045)!important;border:1px solid rgba(255,255,255,.06)!important;border-radius:11px!important;padding:10px!important;backdrop-filter:none!important}.metric b{color:#edf1f4!important}.metric:first-child b{color:#9cd7bd!important}
.card{border:1px solid var(--ec-line)!important;background:rgba(255,255,255,.94)!important;border-radius:17px!important;padding:17px!important;box-shadow:var(--ec-shadow-soft)!important}.card h2{font-size:20px!important;letter-spacing:-.35px!important;color:var(--ec-ink)!important}
.actions{gap:9px!important}.action{min-height:56px!important;border-radius:13px!important;box-shadow:none!important}.income{background:linear-gradient(135deg,#347f5e,#286c4f)!important;border:1px solid #2f7958!important}.expense{background:#fff!important;border:1px solid #e6cfcf!important;color:#a84a4a!important}
input,select,textarea{min-height:51px!important;border-radius:11px!important;border:1px solid var(--ec-line-strong)!important;background:#fff!important;color:var(--ec-ink)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.5)!important}input:focus,select:focus,textarea:focus{border-color:rgba(231,154,83,.75)!important;box-shadow:0 0 0 3px rgba(231,154,83,.10)!important}.primary{min-height:53px!important;border-radius:12px!important;background:linear-gradient(135deg,#efaa68,#d98742)!important;color:#17120d!important;box-shadow:0 9px 22px rgba(217,135,66,.16)!important;font-weight:900!important}
.segment,.p3-segment{background:#eceeea!important;border-radius:12px!important}.segment button.on,.p3-segment button.on{background:#fff!important;color:var(--ec-ink)!important;box-shadow:0 3px 10px rgba(14,22,30,.07)!important}
.p5-sectionTitle{margin-top:19px!important}.p5-sectionTitle h2{font-size:20px!important}.p5-eyebrow{color:#ad703c!important;letter-spacing:.11em!important}.p5-stat{border-radius:14px!important;background:linear-gradient(180deg,#fff,#faf9f6)!important;border:1px solid var(--ec-line)!important;box-shadow:var(--ec-shadow-soft)!important}.p5-stat span{color:var(--ec-muted)!important}.p5-farmCard{border-radius:16px!important;border:1px solid var(--ec-line)!important;background:linear-gradient(155deg,#fff,#f7f8f5)!important;box-shadow:var(--ec-shadow-soft)!important}.p5-group{border-radius:14px!important;border-color:var(--ec-line)!important;box-shadow:var(--ec-shadow-soft)!important}.p5-groupHead{background:#f5f5f1!important;border-bottom-color:var(--ec-line)!important}.p5-record{border-color:var(--ec-line)!important}.p5-edit{border-radius:9px!important;background:#f7f8f6!important;border-color:#ccd4cf!important;color:#245f46!important}.tp-delete{border-radius:9px!important}.p5-marketHero{border-radius:18px!important;background:radial-gradient(circle at 90% 0%,rgba(231,154,83,.18),transparent 30%),linear-gradient(145deg,#161f29,#0d131a)!important;border:1px solid rgba(255,255,255,.06)!important;box-shadow:0 18px 44px rgba(10,15,20,.18)!important}.p5-marketHero .big{color:#f6efe5!important}.p5-marketRow{border-color:var(--ec-line)!important}.p5-price{color:#9b6233!important}.p5-calcShell{border-radius:20px!important;background:linear-gradient(180deg,#151c24,#0c1117)!important;border:1px solid rgba(255,255,255,.06)!important;box-shadow:0 18px 46px rgba(10,15,20,.19)!important}.p5-key{border-radius:14px!important;background:#222b34!important}.p5-key.op{background:#c97a38!important;color:#fff!important}.p5-key.util{background:#414c57!important}.p5-key.zero{border-radius:14px!important}
.p4-weather{background:linear-gradient(145deg,#f5f9fc,#eef4f6)!important;border-color:#d8e2e7!important}.p4-weather-title,.p4-weather-desc{color:#315e72!important}.p4-alert{border-radius:8px!important}.p4-ghost{border-radius:10px!important}
.menuGrid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}.menuBtn{min-height:138px!important;padding:15px!important;border-radius:15px!important;background:linear-gradient(180deg,#fff,#fafaf7)!important;border:1px solid var(--ec-line)!important;box-shadow:var(--ec-shadow-soft)!important;display:grid!important;grid-template-columns:auto 1fr auto!important;grid-template-rows:auto 1fr!important;column-gap:11px!important;row-gap:12px!important;align-items:start!important;overflow:hidden!important}.menuBtn:after{content:none!important;display:none!important}.ec-toolIcon{grid-column:1;grid-row:1;width:38px;height:38px;border-radius:10px;background:linear-gradient(145deg,#1b242e,#0f151c);display:grid;place-items:center;border:1px solid rgba(255,255,255,.05);box-shadow:0 7px 17px rgba(10,15,20,.13)}.ec-toolIcon svg{width:21px;height:21px;fill:none;stroke:var(--ec-copper2);stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.ec-toolCopy{grid-column:1/4;grid-row:2;display:block!important;min-width:0}.ec-toolCopy strong{display:block!important;font-size:17px!important;line-height:1.15!important;letter-spacing:-.2px!important;color:var(--ec-ink)!important}.ec-toolCopy small{display:block!important;margin-top:7px!important;font-size:12.5px!important;line-height:1.38!important;color:var(--ec-muted)!important;font-weight:650!important}.ec-chevron{grid-column:3;grid-row:1;font-size:20px;color:#9aa3a0;line-height:38px}.menuBtn .p4-menu-icon{display:none!important}
.bottom{background:rgba(13,19,26,.97)!important;border-top:1px solid rgba(255,255,255,.05)!important;box-shadow:0 -12px 34px rgba(10,15,20,.13)!important;backdrop-filter:blur(16px)!important;padding:7px 6px calc(8px + env(safe-area-inset-bottom))!important}.nav button{min-height:58px!important;border-radius:11px!important;color:#8f9aa4!important;font-size:10.5px!important}.nav button.active{background:rgba(231,154,83,.11)!important;color:#f4b477!important}.nav button .tp-navIcon svg{stroke:currentColor!important}.nav #nTx{background:linear-gradient(135deg,#efaa68,#d98742)!important;color:#17120d!important;box-shadow:0 8px 18px rgba(217,135,66,.19)!important}.nav #nTx.active{background:linear-gradient(135deg,#efaa68,#d98742)!important;color:#17120d!important}
.empty{border-radius:12px!important;background:#f8f8f5!important;border-color:#d9ded9!important}.toast{border-radius:10px!important;background:#111820!important}.tp-undo{background:#111820!important;border:1px solid rgba(255,255,255,.06)!important;border-radius:12px!important}.tp-undo button{background:#f3b06f!important;color:#17120d!important;border-radius:8px!important}
.tp-lock{background:radial-gradient(circle at 85% 0%,rgba(231,154,83,.12),transparent 28%),radial-gradient(circle at 10% 80%,rgba(121,199,255,.08),transparent 30%),linear-gradient(180deg,#101720,#090e14)!important;color:#f4efe6!important}.tp-lockCard{background:linear-gradient(180deg,#181f28,#11171e)!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:20px!important;box-shadow:0 28px 80px rgba(0,0,0,.36)!important}.tp-lockLogo{width:auto!important;height:auto!important;border-radius:0!important;background:none!important;display:block!important;margin-bottom:15px!important}.tp-lock h1{color:#f4efe6!important}.tp-lock p{color:#9faab7!important}.tp-lockWarn{background:rgba(231,154,83,.075)!important;border-color:rgba(231,154,83,.2)!important;color:#e7bb91!important;border-radius:10px!important}.tp-lock input{background:#0d131a!important;border-color:rgba(255,255,255,.12)!important;color:#f4efe6!important;border-radius:10px!important}.tp-lock input:focus{border-color:rgba(231,154,83,.7)!important;box-shadow:0 0 0 3px rgba(231,154,83,.08)!important}.tp-lockBtn{background:linear-gradient(135deg,#efaa68,#d98742)!important;color:#17120d!important;border-radius:10px!important}.tp-lockError{color:#ff9797!important}.tp-modal{background:rgba(6,10,14,.62)!important}.tp-modalCard{border-radius:16px!important}.tp-modalActions button{border-radius:10px!important}
@media(max-width:420px){.wrap{padding-left:11px!important;padding-right:11px!important}.top{padding:10px 11px!important}.ec-brandName{font-size:20px!important}.tp-subtitle{font-size:10px!important;padding-left:48px!important}.status{font-size:9.5px!important}.menuBtn{min-height:132px!important;padding:13px!important}.ec-toolCopy strong{font-size:16px!important}.ec-toolCopy small{font-size:11.7px!important}.big{font-size:31px!important}.metric{padding:9px!important}.metric b{font-size:13.5px!important}}
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
  if(lockTitle&&/TarlaPusula|kilitli/i.test(lockTitle.textContent||''))lockTitle.textContent=BRAND+' kilitli';
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
    button.innerHTML=`<span class="ec-toolIcon">${iconSvg(info[0])}</span><span class="ec-chevron" aria-hidden="true">›</span><span class="ec-toolCopy"><strong>${info[1]}</strong><small>${info[2]}</small></span>`;
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
