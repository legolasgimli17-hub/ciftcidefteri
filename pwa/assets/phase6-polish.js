(function(){
'use strict';
if(window.__TARLAPUSULA_PHASE6__) return;
window.__TARLAPUSULA_PHASE6__=true;

const BRAND='TarlaPusula';
document.title=BRAND;

const style=document.createElement('style');
style.textContent=`
:root{
 --bg:#f4f7f2;--card:#ffffff;--ink:#142119;--muted:#66726a;--green:#176744;--green2:#0f4e33;
 --accent:#dff1e6;--red:#b34242;--line:#dde6df;--soft:#eef5f0;--gold:#b88a2d;
 --shadow:0 12px 34px rgba(20,65,39,.08);--shadow2:0 5px 16px rgba(20,65,39,.06)
}
html,body{background:linear-gradient(180deg,#f8faf7 0,#f3f6f1 60%,#eef3ee 100%)!important;color:var(--ink)!important}
body{padding-bottom:96px!important}
.wrap{max-width:860px!important;padding:18px 15px 34px!important}
.top{margin:2px 0 18px!important;align-items:center!important;gap:10px!important}
.tp-topCopy{display:flex;flex-direction:column;gap:0;min-width:0;flex:1}
.brand{font-size:0!important;display:flex!important;align-items:center!important;gap:11px!important;min-width:0}
.brand:before{content:'';width:42px;height:42px;flex:0 0 42px;border-radius:15px;background:linear-gradient(145deg,#1f7c53,#0f4e33);box-shadow:0 8px 20px rgba(23,103,68,.24);display:inline-block;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath d='M14 42c13-2 22-11 28-27 8 13 10 25 1 34-8 8-21 7-29-7Z' fill='none' stroke='white' stroke-width='5' stroke-linecap='round'/%3E%3Cpath d='M20 43c8-3 14-8 20-18' stroke='white' stroke-width='5' stroke-linecap='round'/%3E%3C/svg%3E")!important;background-size:28px 28px!important;background-position:center!important;background-repeat:no-repeat!important}
.brand:after{content:'${BRAND}';font-size:25px;font-weight:950;letter-spacing:-.6px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.status{flex:0 0 auto;background:#e7f3eb!important;color:#176744!important;border:1px solid #cce4d5!important;padding:7px 10px!important}
.hero{position:relative;overflow:hidden;border-radius:27px!important;padding:23px!important;background:linear-gradient(145deg,#1e7650,#0f4d34)!important;box-shadow:0 18px 45px rgba(19,79,52,.22)!important}
.hero:after{content:'';position:absolute;width:180px;height:180px;border-radius:50%;right:-60px;top:-80px;background:rgba(255,255,255,.08)}
.hero small{letter-spacing:.07em!important}
.big{letter-spacing:-1px!important}
.metrics{position:relative;z-index:1!important}
.metric{background:rgba(255,255,255,.12)!important;border:1px solid rgba(255,255,255,.12)!important;backdrop-filter:blur(5px)}
.card,.p5-stat,.p5-farmCard,.p5-group,.p5-quickCalc{border-color:var(--line)!important;box-shadow:var(--shadow2)!important}
.card{border-radius:22px!important;padding:18px!important}
.card h2{font-size:19px!important;letter-spacing:-.25px!important}
.actions{gap:11px!important;margin:14px 0!important}
.action{min-height:58px!important;border-radius:18px!important;box-shadow:var(--shadow2)!important;transition:transform .15s ease,box-shadow .15s ease!important}
.action:active,.primary:active,.menuBtn:active,.small:active{transform:scale(.985)}
.income{background:linear-gradient(145deg,#1f7751,#176744)!important}
.expense{background:#fff!important;border:1.5px solid #ead7d7!important;color:#a43d3d!important}
input,select,textarea{border-radius:15px!important;border:1.4px solid #cfdad2!important;background:#fff!important;min-height:52px!important;transition:border-color .15s,box-shadow .15s}
input:focus,select:focus,textarea:focus{border-color:#74ad8c!important;box-shadow:0 0 0 4px rgba(23,103,68,.09)!important}
label{font-size:13px!important;color:#5e6c63!important;margin-top:15px!important}
.primary{border-radius:16px!important;background:linear-gradient(145deg,#1f7751,#176744)!important;min-height:56px!important;box-shadow:0 10px 23px rgba(23,103,68,.18)!important}
.segment{background:#e9efeb!important;border-radius:15px!important;padding:5px!important}
.segment button.on{box-shadow:0 3px 9px rgba(25,60,40,.08)!important}
.menuGrid{gap:11px!important}
.menuBtn{min-height:92px!important;border-radius:19px!important;padding:16px!important;background:linear-gradient(180deg,#fff,#fbfcfb)!important;box-shadow:var(--shadow2)!important;position:relative!important;overflow:hidden!important}
.menuBtn:after{content:'›';position:absolute;right:14px;top:13px;color:#98a69d;font-size:22px;font-weight:700}
.menuBtn span{padding-right:15px!important;line-height:1.35!important}
.empty{background:#fafcf9!important;border:1px dashed #d7e2da!important;border-radius:17px!important;padding:24px 14px!important;margin:6px 0!important}
.p5-sectionTitle{margin-top:22px!important}
.p5-sectionTitle h2{font-size:21px!important;letter-spacing:-.35px!important}
.p5-stat{border-radius:20px!important;background:linear-gradient(180deg,#fff,#fbfdfb)!important;min-height:92px!important}
.p5-stat b{letter-spacing:-.4px!important}
.p5-farmCard{border-radius:22px!important;background:linear-gradient(155deg,#fff,#f7fbf8)!important}
.p5-group{border-radius:20px!important}
.p5-groupHead{background:#f5f9f6!important;padding:15px 16px!important}
.p5-record{padding:14px 16px!important}
.p5-edit{border-radius:12px!important;min-height:42px!important;padding:9px 12px!important;background:#f2f8f4!important}
.p5-ledgerTools{gap:9px!important;margin:12px 0 14px!important}
.p5-marketHero{border-radius:25px!important;background:linear-gradient(145deg,#123d2d,#1d7350)!important;box-shadow:0 17px 42px rgba(18,61,45,.21)!important}
.p5-marketRow{padding:14px 0!important}
.p5-calcShell{border-radius:29px!important;background:linear-gradient(180deg,#141b17,#0e1411)!important;box-shadow:0 20px 50px rgba(0,0,0,.2)!important}
.p5-key{box-shadow:inset 0 1px 0 rgba(255,255,255,.05)!important;transition:transform .08s ease,filter .08s ease!important}
.p5-key:active{transform:scale(.94);filter:brightness(1.1)}
.bottom{background:rgba(255,255,255,.95)!important;backdrop-filter:blur(14px)!important;border-top:1px solid #dce5df!important;padding:7px 6px calc(8px + env(safe-area-inset-bottom))!important;box-shadow:0 -10px 30px rgba(20,55,35,.06)!important}
.nav{gap:4px!important}
.nav button{min-height:60px!important;border-radius:15px!important;font-size:10.5px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:4px!important;padding:6px 2px!important}
.nav button.active{background:#e8f3ec!important;color:#176744!important}
.tp-navIcon{width:20px;height:20px;display:block}
.tp-navIcon svg{width:20px;height:20px;display:block;stroke:currentColor;fill:none;stroke-width:2.1;stroke-linecap:round;stroke-linejoin:round}
#nTx{background:linear-gradient(145deg,#1f7751,#176744)!important;color:#fff!important;box-shadow:0 8px 18px rgba(23,103,68,.22)!important}
#nTx.active{background:linear-gradient(145deg,#1f7751,#176744)!important;color:#fff!important}
.tp-subtitle{font-size:11.5px;color:var(--muted);font-weight:700;margin:2px 0 0 53px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tp-sectionLead{font-size:13px;color:var(--muted);line-height:1.45;margin:-4px 0 11px}
.toast{border-radius:14px!important;box-shadow:0 12px 30px rgba(0,0,0,.18)!important}
@media(max-width:420px){.wrap{padding-left:12px!important;padding-right:12px!important}.brand:after{font-size:22px}.brand:before{width:39px;height:39px;flex-basis:39px;border-radius:14px}.tp-subtitle{margin-left:50px;font-size:10.5px}.status{font-size:10px!important;padding:6px 8px!important}.metric b{font-size:14px!important}.p5-grid{gap:8px!important}.p5-stat{padding:13px!important}.p5-stat b{font-size:17px!important}}
`;
document.head.appendChild(style);

function icon(path){return `<span class="tp-navIcon"><svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg></span>`;}
const icons={
 home:icon('<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/>'),
 add:icon('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'),
 ledger:icon('<path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>'),
 debt:icon('<path d="M4 7h16v12H4z"/><path d="M4 10h16"/><path d="M8 15h3"/>'),
 more:icon('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>')
};

function polishBrand(){
 const top=document.querySelector('.top');
 const brand=document.querySelector('.brand');
 if(brand){brand.textContent='';brand.setAttribute('aria-label',BRAND);}
 const status=document.getElementById('storageStatus');
 if(status) status.textContent='İnternetsiz hazır';
 if(top&&brand&&!document.querySelector('.tp-topCopy')){
   const wrap=document.createElement('div');wrap.className='tp-topCopy';
   top.insertBefore(wrap,brand);wrap.appendChild(brand);
   const copy=document.createElement('div');copy.className='tp-subtitle';copy.id='tpSubtitle';copy.textContent='Tarlanın parası, hava durumu ve ürün değeri tek yerde';wrap.appendChild(copy);
 }
}

function polishNav(){
 const defs=[['nHome',icons.home,'Ana Sayfa'],['nTx',icons.add,'Yeni Kayıt'],['nLedger',icons.ledger,'Defter'],['nDebts',icons.debt,'Borçlar'],['nMore',icons.more,'Daha']];
 defs.forEach(([id,ico,label])=>{const b=document.getElementById(id);if(b&&!b.dataset.tp){b.dataset.tp='1';b.innerHTML=ico+`<span>${label}</span>`;}});
}

function polishCopy(){
 const heroLabels=document.querySelectorAll('#home .hero small');
 if(heroLabels[0]) heroLabels[0].textContent='NET DURUM';
 if(heroLabels[1]) heroLabels[1].textContent='GELİR';
 if(heroLabels[2]) heroLabels[2].textContent='MASRAF';
 const incomeButton=document.querySelector('#home .action.income');if(incomeButton) incomeButton.textContent='+ Gelir ekle';
 const expenseButton=document.querySelector('#home .action.expense');if(expenseButton) expenseButton.textContent='− Masraf ekle';
 const ledgerCard=document.querySelector('#ledger .card');
 if(ledgerCard&&!ledgerCard.querySelector('.tp-sectionLead')){
   ledgerCard.querySelector('h2')?.insertAdjacentHTML('afterend','<div class="tp-sectionLead">Masraflar kategori kategori gösterilir. Her kaydı silmeden düzenleyebilirsin.</div>');
 }
 const moreTitle=document.querySelector('#more .card h2');if(moreTitle) moreTitle.textContent='Araçlar ve Ayarlar';
 const debtsTitle=document.querySelector('#debts .card h2');if(debtsTitle) debtsTitle.textContent='Borç / Alacak';
}

function polishMenus(){
 document.querySelectorAll('.menuBtn').forEach((b)=>{
   const text=(b.textContent||'').trim().toLocaleLowerCase('tr');
   if(b.dataset.tpIcon)return;
   b.dataset.tpIcon='1';
   let glyph='◼';
   if(text.includes('hava'))glyph='☁'; else if(text.includes('hesap'))glyph='⌗'; else if(text.includes('piyasa')||text.includes('ürün'))glyph='₺'; else if(text.includes('yedek'))glyph='↥'; else if(text.includes('ortak'))glyph='◎'; else if(text.includes('stok')||text.includes('elindekiler'))glyph='▦';
   b.insertAdjacentHTML('afterbegin',`<div style="font-size:22px;color:var(--green);margin-bottom:8px;font-weight:900">${glyph}</div>`);
 });
}

function run(){polishBrand();polishNav();polishCopy();polishMenus();}
run();
const observer=new MutationObserver(()=>{polishMenus();polishNav();});
observer.observe(document.body,{childList:true,subtree:true});
})();