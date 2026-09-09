(function(){
'use strict';
if(window.__EKINCEP_PHASE10_COMMAND_CENTER__)return;
window.__EKINCEP_PHASE10_COMMAND_CENTER__=true;

const H=value=>String(value??'').replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[ch]));
const TL=kurus=>new Intl.NumberFormat('tr-TR',{
  style:'currency',currency:'TRY',maximumFractionDigits:0
}).format((Number(kurus)||0)/100);

const icons={
  field:'<path d="M4 19c4-4 9-6 16-6M4 14c4-4 9-6 16-6M7 20l10-12"/>',
  market:'<path d="M4 19V9M10 19v-5M16 19V6M3 19h18"/><path d="m5 11 4-3 4 2 6-6"/>',
  stock:'<path d="m4 8 8-4 8 4-8 4-8-4Z"/><path d="M4 8v8l8 4 8-4V8M12 12v8"/>',
  weather:'<path d="M7 17h10.5a3.5 3.5 0 0 0 .2-7A5.5 5.5 0 0 0 7.2 9.2 4 4 0 0 0 7 17Z"/><path d="M8 20h.01M12 20h.01M16 20h.01"/>',
  income:'<path d="M12 4v16M5 11l7-7 7 7"/>',
  expense:'<path d="M12 4v16M5 13l7 7 7-7"/>'
};
function icon(name){return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.field}</svg>`;}

const style=document.createElement('style');
style.textContent=`
:root{--ec10-forest:#153f31;--ec10-forest2:#225d46;--ec10-moss:#62866b;--ec10-sand:#f3eee3;--ec10-paper:#fbfaf6;--ec10-clay:#c8733d;--ec10-ink:#17211c;--ec10-muted:#5f6b64;--ec10-line:#d8ddd5}
html,body{background:linear-gradient(180deg,#f4f0e7 0,#f7f6f1 42%,#efeee8 100%)!important}
.wrap{max-width:900px!important;padding-top:10px!important}.top{min-height:64px!important;background:rgba(251,250,246,.96)!important;color:var(--ec10-ink)!important;border:1px solid #ddd9cf!important;box-shadow:0 8px 26px rgba(28,43,34,.07)!important}.ec-brandName{color:var(--ec10-ink)!important}.tp-subtitle{color:var(--ec10-muted)!important}.status,.ec-fieldBadge{color:#245b43!important;background:#e7f1e9!important;border-color:#b9d0bf!important}.status:before,.ec-fieldBadge:before{background:#33825c!important}
#home{padding-bottom:8px}.ec10-fieldHero{position:relative;min-height:246px;border-radius:26px;overflow:hidden;background:#244b39 url('field-hero.webp') center 54%/cover no-repeat;box-shadow:0 20px 46px rgba(26,55,39,.19);isolation:isolate;margin-bottom:12px}.ec10-fieldHero:before{content:'';position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,rgba(9,30,22,.88) 0%,rgba(9,30,22,.68) 46%,rgba(9,30,22,.24) 75%,rgba(9,30,22,.12) 100%),linear-gradient(0deg,rgba(5,18,13,.52),transparent 58%)}.ec10-fieldHero:after{content:'';position:absolute;inset:0;z-index:-1;border:1px solid rgba(255,255,255,.18);border-radius:inherit;pointer-events:none}.ec10-fieldBody{min-height:246px;display:flex;flex-direction:column;justify-content:space-between;padding:21px;color:#fff;max-width:520px}.ec10-kicker{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;color:#d8e9da}.ec10-kicker:before{content:'';width:9px;height:9px;border-radius:50%;background:#91d29f;box-shadow:0 0 0 5px rgba(145,210,159,.14)}.ec10-fieldHero h1{font-size:29px;line-height:1.06;letter-spacing:-.8px;margin:10px 0 8px;max-width:400px}.ec10-fieldHero p{font-size:13px;line-height:1.5;color:#e1e9e2;margin:0;max-width:390px}.ec10-fieldMeta{display:flex;gap:7px;flex-wrap:wrap;margin-top:18px}.ec10-chip{display:inline-flex;align-items:center;min-height:34px;padding:7px 10px;border-radius:999px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(8px);color:#fff;font-size:11.5px;font-weight:800}.ec10-fieldAction{position:absolute;right:18px;bottom:18px;min-height:52px!important;border:1px solid rgba(255,255,255,.24);border-radius:13px;background:rgba(251,250,246,.94);color:#173d2f;font-size:12px;font-weight:900;padding:10px 14px;box-shadow:0 9px 22px rgba(7,20,14,.2)}
#home>.hero{background:linear-gradient(145deg,#183f32,#102e25)!important;border-color:rgba(255,255,255,.09)!important;box-shadow:0 13px 34px rgba(19,54,40,.17)!important;border-radius:21px!important}.hero .big{font-size:35px!important;letter-spacing:-1px!important}.hero .metric{background:rgba(255,255,255,.07)!important;border-color:rgba(255,255,255,.1)!important}.hero .metric:first-child b{color:#b8e2c2!important}
.actions{padding:6px;background:#e8e5dc;border:1px solid #d8d4c9;border-radius:18px;gap:6px!important;margin-top:10px!important}.action{min-height:58px!important;border-radius:13px!important}.income{background:linear-gradient(135deg,#2c7355,#205d44)!important}.expense{border-color:#dfc7bd!important;background:#fffaf6!important;color:#a04d32!important}
.ec10-tools{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:12px 0 4px}.ec10-tool{min-height:92px!important;border:1px solid var(--ec10-line);border-radius:17px;background:linear-gradient(180deg,#fff,#f8f6ef);color:var(--ec10-ink);padding:13px;text-align:left;box-shadow:0 7px 19px rgba(28,43,34,.05)}.ec10-toolIcon{width:34px;height:34px;display:grid;place-items:center;border-radius:11px;background:#e4efe6;color:#285f46}.ec10-toolIcon svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.ec10-tool b{display:block;font-size:13px;margin-top:10px}.ec10-tool small{display:block;color:var(--ec10-muted);font-size:10.5px;line-height:1.3;margin-top:3px}
#p4WeatherCard{order:0!important;margin-top:13px!important;border-radius:20px!important;background:linear-gradient(145deg,#f8fbf8,#edf4ee)!important;border-color:#ceddd1!important;box-shadow:0 9px 25px rgba(42,77,56,.07)!important}.p4-weather-title{color:#214d3b!important}.p4-weather-desc{color:#315d47!important}.p4-day{border-color:#d4e1d7!important;background:rgba(255,255,255,.84)!important}
.p5-sectionTitle{margin:22px 3px 10px!important}.p5-sectionTitle h2{font-size:22px!important}.p5-eyebrow{color:#7d684f!important}.p5-stat{background:linear-gradient(180deg,#fff,#f7f4ec)!important;border-color:#dcd8cd!important}.p5-stat b{font-size:19px!important}.p5-farmCard{position:relative;overflow:hidden;border-radius:20px!important;background:linear-gradient(145deg,#fff,#eef4ed)!important;border-color:#cad9cd!important}.p5-farmCard:before{content:'';position:absolute;width:86px;height:86px;border-radius:50%;right:-34px;bottom:-42px;background:rgba(70,120,87,.09)}.p5-barFill{background:linear-gradient(90deg,#315f48,#c87842)!important}
.ec10-dataLabel{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:22px 3px 9px}.ec10-dataLabel h2{font-size:22px;margin:0;letter-spacing:-.4px}.ec10-dataLabel span{font-size:11px;color:var(--ec10-muted);font-weight:750}.ec10-supportCard{border-radius:20px!important}.ec10-supportCard>h2{font-size:19px!important}.ec10-supportCard .empty{background:#f5f3ec!important}
.bottom{background:rgba(251,250,246,.97)!important;border-color:#d8d5cc!important;box-shadow:0 -9px 28px rgba(28,43,34,.1)!important}.nav button{color:#667069!important}.nav button.active{background:#e1ece2!important;color:#1f5a41!important}.nav #nTx{background:linear-gradient(135deg,#cf7c45,#b96132)!important;color:#fff!important;box-shadow:0 7px 17px rgba(159,78,39,.22)!important}
@media(max-width:520px){.ec10-fieldHero,.ec10-fieldBody{min-height:232px}.ec10-fieldBody{padding:18px;padding-right:18px}.ec10-fieldHero h1{font-size:26px;max-width:300px}.ec10-fieldHero p{max-width:300px}.ec10-fieldAction{position:static;align-self:flex-start;margin-top:13px}.ec10-fieldMeta{margin-top:13px}.ec10-tools{grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.ec10-tool{padding:11px;min-height:96px!important}.ec10-tool small{font-size:10px}.hero .big{font-size:31px!important}}
@media(max-width:360px){.ec10-tools{grid-template-columns:1fr}.ec10-tool{min-height:64px!important;display:grid;grid-template-columns:36px 1fr;column-gap:10px;align-items:center}.ec10-tool b,.ec10-tool small{grid-column:2;margin:0}.ec10-tool b{align-self:end}.ec10-tool small{align-self:start}.ec10-fieldHero h1{font-size:24px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
`;
document.head.appendChild(style);

function effective(t){
  if(typeof window.eff==='function')return window.eff(t);
  if(typeof window.effective==='function')return window.effective(t);
  return t.ownership==='partnership'?Math.round(t.amount*(Number(t.share)||0)/100):Number(t.amount)||0;
}

function seasonRows(){
  const year=String(new Date().getFullYear());
  return (app.transactions||[]).filter(t=>String(t.date||'').startsWith(year));
}

function uniqueParcels(){
  const names=[];
  for(const t of app.transactions||[]){
    const name=String(t.parcel||'').trim();
    if(name&&!names.includes(name))names.push(name);
  }
  return names;
}

function friendlyDate(){
  try{return new Intl.DateTimeFormat('tr-TR',{weekday:'long',day:'numeric',month:'long'}).format(new Date());}
  catch{return 'Bugünün özeti';}
}

function latestActivity(){
  const row=(app.transactions||[])[0];
  if(!row)return 'İlk gelir veya masraf kaydını ekleyerek başla.';
  const place=String(row.parcel||'').trim();
  return `${row.category||'Son kayıt'}${place?' · '+place:''}`;
}

function ensureFieldHero(){
  const home=document.getElementById('home');
  if(!home)return;
  let hero=document.getElementById('ec10FieldHero');
  if(!hero){
    hero=document.createElement('section');
    hero.id='ec10FieldHero';
    hero.className='ec10-fieldHero';
    hero.setAttribute('aria-labelledby','ec10FieldTitle');
    home.insertBefore(hero,home.firstChild);
  }
  const rows=seasonRows();
  const parcels=uniqueParcels();
  const markup=`<div class="ec10-fieldBody">
    <div><div class="ec10-kicker">${H(friendlyDate())}</div><h1 id="ec10FieldTitle">Çiftliğinin bugünkü görünümü</h1><p>${H(latestActivity())}</p></div>
    <div class="ec10-fieldMeta"><span class="ec10-chip">${parcels.length} kayıtlı tarla</span><span class="ec10-chip">${rows.length} sezon kaydı</span><span class="ec10-chip">Çevrimdışı hazır</span></div>
    <button class="ec10-fieldAction" type="button" onclick="ec10ShowFields()">Tarlaları gör</button>
  </div>`;
  if(hero.innerHTML!==markup)hero.innerHTML=markup;
}

function polishFinanceHero(){
  const label=document.querySelector('#home>.hero>small');
  if(label&&label.textContent!=='BU SEZON CEBİNDE KALAN')label.textContent='BU SEZON CEBİNDE KALAN';
  const metrics=document.querySelectorAll('#home>.hero .metric small');
  const labels=['SEZON GELİRİ','SEZON MASRAFI','AÇIK BORÇ'];
  metrics.forEach((node,index)=>{if(labels[index]&&node.textContent!==labels[index])node.textContent=labels[index];});
}

function ensureTools(){
  const actions=document.querySelector('#home>.actions');
  if(!actions)return;
  let tools=document.getElementById('ec10Tools');
  if(!tools){
    tools=document.createElement('div');tools.id='ec10Tools';tools.className='ec10-tools';
    actions.insertAdjacentElement('afterend',tools);
  }
  const markup=`
    <button class="ec10-tool" type="button" onclick="ec10OpenMarket()"><span class="ec10-toolIcon">${icon('market')}</span><b>Piyasa</b><small>Kaynaklı ürün fiyatları</small></button>
    <button class="ec10-tool" type="button" onclick="ec10OpenStock()"><span class="ec10-toolIcon">${icon('stock')}</span><b>Elindekiler</b><small>Stok ve ürün miktarı</small></button>
    <button class="ec10-tool" type="button" onclick="ec10OpenWeather()"><span class="ec10-toolIcon">${icon('weather')}</span><b>Tarla havası</b><small>Konuma göre tahmin</small></button>`;
  if(tools.innerHTML!==markup)tools.innerHTML=markup;
}

function organizeHome(){
  const actions=document.querySelector('#home>.actions');
  const weather=document.getElementById('p4WeatherCard');
  const tools=document.getElementById('ec10Tools');
  const phase5=document.getElementById('p5Home');
  if(actions&&tools&&tools.previousElementSibling!==actions)actions.insertAdjacentElement('afterend',tools);
  if(tools&&weather&&weather.previousElementSibling!==tools)tools.insertAdjacentElement('afterend',weather);
  if(weather&&phase5&&phase5.previousElementSibling!==weather)weather.insertAdjacentElement('afterend',phase5);
  else if(tools&&phase5&&!weather&&phase5.previousElementSibling!==tools)tools.insertAdjacentElement('afterend',phase5);
  const cards=document.querySelectorAll('#home>.card');
  cards.forEach(card=>card.classList.add('ec10-supportCard'));
  const cropTitle=document.querySelector('#home>.card #cropProfit')?.parentElement?.querySelector('h2');
  if(cropTitle&&cropTitle.textContent!=='Ürünlerin sonucu')cropTitle.textContent='Ürünlerin sonucu';
  const recentTitle=document.querySelector('#home>.card #recent')?.parentElement?.querySelector('h2');
  if(recentTitle&&recentTitle.textContent!=='Son hareketler')recentTitle.textContent='Son hareketler';
}

window.ec10ShowFields=function(){
  const target=document.querySelector('#p5Home .p5-farmCard')||document.getElementById('p5Home');
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(target)target.scrollIntoView({behavior:reduced?'auto':'smooth',block:'start'});
};
window.ec10OpenMarket=function(){document.getElementById('p5MarketBtn')?.click();};
window.ec10OpenStock=function(){showPage('more');showSub('inventory');};
window.ec10OpenWeather=function(){
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(app.weatherLocation){document.getElementById('p4WeatherCard')?.scrollIntoView({behavior:reduced?'auto':'smooth',block:'center'});return;}
  showPage('more');showSub('weather');
};

function run(){ensureFieldHero();polishFinanceHero();ensureTools();organizeHome();}
const previousRender=window.render;
if(typeof previousRender==='function')window.render=function(){previousRender();run();};
const previousRenderAll=window.renderAll;
if(typeof previousRenderAll==='function'&&previousRenderAll!==previousRender)window.renderAll=function(){previousRenderAll();run();};
run();
let queued=false;
const observer=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;run();});});
observer.observe(document.getElementById('home')||document.body,{childList:true,subtree:true});
})();
