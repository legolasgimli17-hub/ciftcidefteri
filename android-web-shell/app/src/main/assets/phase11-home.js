(function(){
'use strict';
if(window.__EKINCEP_PHASE11_HOME__)return;
window.__EKINCEP_PHASE11_HOME__=true;

const WeatherCore=window.CiftciPhase4Core;
const MARKET_KEY='ekincep-live-market-v1';
const FUEL_KEY='ekincep-live-fuel-v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]||c));
const fmtKurus=k=>typeof money==='function'?money(Number(k)||0):new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format((Number(k)||0)/100);
const now=()=>Date.now();

function active(){
  if(typeof window.activeTransactions==='function')return window.activeTransactions();
  return (app.transactions||[]).filter(t=>!t.deletedAt);
}
function amount(t){
  if(typeof window.effective==='function')return Number(window.effective(t))||0;
  if(typeof window.eff==='function')return Number(window.eff(t))||0;
  return Number(t.amountKurus||t.amount||0)||0;
}
function parseCache(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
function ageMs(value){const n=Date.parse(value||'');return Number.isFinite(n)?Math.max(0,now()-n):Infinity;}
function freshness(value){const ms=ageMs(value);if(!Number.isFinite(ms))return 'tarih yok';const h=Math.floor(ms/3600000);if(h<1)return 'az önce';if(h<24)return `${h} saat önce`;return `${Math.floor(h/24)} gün önce`;}
function marketItem(payload){
  const items=payload?.items||[];
  const pref=['BUĞDAY','MISIR','ARPA','AYÇİÇEĞİ','PAMUK'];
  for(const p of pref){const x=items.find(i=>String(i.name||'').toLocaleUpperCase('tr').includes(p));if(x)return x;}
  return items[0]||null;
}
function fuelItem(payload){return (payload?.items||[]).find(i=>/motorin|dizel/i.test(i.name||''))||(payload?.items||[])[0]||null;}
function shortName(v){return String(v||'').replace(/\s*-\s*KG.*$/i,'').replace(/\s*\([^)]*\)/g,'').trim().slice(0,30);}
function tryPrice(n,unit){return `${new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}).format(Number(n)||0)}${unit==='Litre'?'/L':'/kg'}`;}

const style=document.createElement('style');
style.textContent=`
#home> :not(#ec11Home){display:none!important}
.ec11{display:grid;gap:12px;margin-top:2px}.ec11-block{border:1px solid #dce1df;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 9px 24px rgba(13,19,26,.055)}
.ec11-head{padding:15px 16px 10px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.ec11-kicker{font-size:10px;font-weight:950;letter-spacing:.13em;color:#a26735;text-transform:uppercase}.ec11-head h2{margin:3px 0 0;font-size:19px;letter-spacing:-.35px;color:#111820}.ec11-meta{font-size:10.5px;color:#6c7672;font-weight:750;text-align:right}
.ec11-today{padding:0 16px 15px}.ec11-weatherLine{display:flex;align-items:center;justify-content:space-between;gap:12px;background:linear-gradient(145deg,#f2f7f8,#f8faf8);border:1px solid #dce8e8;border-radius:14px;padding:13px}.ec11-temp{font-size:30px;font-weight:950;letter-spacing:-1px;color:#17242a}.ec11-weatherText{font-weight:900;color:#315e72}.ec11-alert{margin-top:8px;padding:10px 12px;border-radius:11px;background:#fff7e8;border:1px solid #ecd6aa;color:#6f5018;font-weight:800;font-size:12px;line-height:1.4}.ec11-good{margin-top:8px;color:#38624d;font-size:12px;font-weight:800}
.ec11-season{padding:0 16px 16px}.ec11-net{font-size:32px;font-weight:950;letter-spacing:-1px;color:#111820}.ec11-net.good{color:#286b50}.ec11-net.bad{color:#9d4848}.ec11-miniGrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.ec11-mini{border:1px solid #e0e4e1;background:#f8f8f5;border-radius:12px;padding:10px}.ec11-mini small{display:block;color:#6d7671;font-weight:800;font-size:10.5px}.ec11-mini b{display:block;margin-top:3px;font-size:15px}
.ec11-fields{padding:0 12px 12px;display:grid;gap:8px}.ec11-field{border:1px solid #dfe3e0;border-radius:14px;padding:12px;background:linear-gradient(145deg,#fff,#f8f9f6)}.ec11-fieldTop{display:flex;justify-content:space-between;gap:10px}.ec11-field b{font-size:15px}.ec11-field span{display:block;color:#66716d;font-size:11px;margin-top:4px;line-height:1.35}.ec11-satTag{align-self:start;white-space:nowrap;padding:5px 7px;border-radius:999px;background:#eef3ef;color:#38604a;font-size:9px!important;font-weight:900;margin:0!important}.ec11-empty{padding:0 16px 15px;color:#67716d;font-size:12px;line-height:1.5}
.ec11-liveGrid{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #e4e7e5}.ec11-live{padding:13px 16px;min-height:105px}.ec11-live+.ec11-live{border-left:1px solid #e4e7e5}.ec11-live small{font-size:10px;font-weight:950;color:#6b7570;letter-spacing:.06em}.ec11-live strong{display:block;margin-top:5px;font-size:17px;color:#111820}.ec11-live span{display:block;margin-top:5px;font-size:10.5px;color:#6b7570;line-height:1.35}.ec11-stale{color:#9b6233!important}.ec11-liveFoot{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:10px 14px 13px;border-top:1px solid #edf0ee;color:#6b7570;font-size:10.5px}.ec11-link{min-height:43px;border:1px solid #cfd6d2;background:#fff;border-radius:10px;padding:0 12px;font-weight:900;color:#1d2a24}
.ec11-quick{padding:0 12px 12px;display:grid;grid-template-columns:1fr 1fr;gap:8px}.ec11-q{min-height:58px;border-radius:12px;border:1px solid #d9deda;background:#fff;text-align:left;padding:10px 12px;font-weight:900;color:#17211c}.ec11-q.primary{background:linear-gradient(135deg,#efaa68,#d98742);border:0;color:#17120d;margin:0}.ec11-q small{display:block;font-size:10.5px;color:#707a75;margin-top:3px;font-weight:700}.ec11-q.primary small{color:#4c321d}
@media(max-width:420px){.ec11-liveGrid{grid-template-columns:1fr}.ec11-live+.ec11-live{border-left:0;border-top:1px solid #e4e7e5}.ec11-net{font-size:29px}.ec11-head h2{font-size:18px}}
`;
document.head.appendChild(style);

function weatherModel(){
  const cache=app.weatherCache;
  const forecast=cache?.data?.forecast||{};
  const current=forecast.current||{};
  const daily=forecast.daily||{};
  const first={
    code:daily.weather_code?.[0],minTemp:daily.temperature_2m_min?.[0],maxTemp:daily.temperature_2m_max?.[0],
    precipitation:daily.precipitation_sum?.[0],precipitationProbability:daily.precipitation_probability_max?.[0],windGust:daily.wind_gusts_10m_max?.[0]
  };
  const warnings=WeatherCore?.weatherWarnings?WeatherCore.weatherWarnings(first):[];
  return {place:cache?.data?.name||app.weatherLocation||'',temp:current.temperature_2m,code:current.weather_code??first.code,max:first.maxTemp,min:first.minTemp,rain:first.precipitationProbability,warnings,fetchedAt:cache?.fetchedAt};
}
function todayBlock(){
  const w=weatherModel();
  if(!w.place)return `<section class="ec11-block"><div class="ec11-head"><div><div class="ec11-kicker">Bugün</div><h2>Sahaya çıkmadan önce</h2></div></div><div class="ec11-empty">Hava konumu henüz ayarlanmadı.<br><button class="ec11-link" style="margin-top:10px" onclick="showPage('more');showSub('weather')">Konumu ayarla</button></div></section>`;
  const icon=WeatherCore?.weatherIcon?WeatherCore.weatherIcon(w.code):'🌦️';
  const label=WeatherCore?.weatherLabel?WeatherCore.weatherLabel(w.code):'Hava tahmini';
  return `<section class="ec11-block"><div class="ec11-head"><div><div class="ec11-kicker">Bugün</div><h2>${esc(w.place)}</h2></div><div class="ec11-meta">${w.fetchedAt?freshness(new Date(w.fetchedAt).toISOString()):''}</div></div><div class="ec11-today"><div class="ec11-weatherLine"><div><div class="ec11-temp">${icon} ${Number.isFinite(Number(w.temp))?Math.round(Number(w.temp))+'°':'—'}</div><div class="ec11-weatherText">${esc(label)}</div></div><div class="ec11-meta">${Number.isFinite(Number(w.max))?Math.round(Number(w.max))+'° / '+Math.round(Number(w.min))+'°':''}<br>${Number.isFinite(Number(w.rain))?'Yağış %'+Math.round(Number(w.rain)):''}</div></div>${w.warnings.length?`<div class="ec11-alert">⚠ ${w.warnings.map(x=>esc(x.label)).join(' · ')}</div>`:'<div class="ec11-good">Öne çıkan don, aşırı sıcak, kuvvetli rüzgâr veya yoğun yağış uyarısı yok.</div>'}</div></section>`;
}
function seasonBlock(){
  let income=0,expense=0;for(const t of active()){const v=amount(t);if(t.type==='income')income+=v;else if(t.type==='expense')expense+=v;}
  const net=income-expense;
  return `<section class="ec11-block"><div class="ec11-head"><div><div class="ec11-kicker">Bu sezon</div><h2>Çiftliğin para durumu</h2></div><div class="ec11-meta">${active().length} kayıt</div></div><div class="ec11-season"><div class="ec11-net ${net>=0?'good':'bad'}">${fmtKurus(net)}</div><div class="ec11-miniGrid"><div class="ec11-mini"><small>GELİR</small><b>${fmtKurus(income)}</b></div><div class="ec11-mini"><small>MASRAF</small><b>${fmtKurus(expense)}</b></div></div></div></section>`;
}
function parcelRows(){
  const map=new Map();for(const t of active()){
    const p=String(t.parcel||'').trim();if(!p)continue;
    const old=map.get(p);if(!old||String(t.date||'')>String(old.date||''))map.set(p,t);
  }
  return [...map.entries()].sort((a,b)=>String(b[1].date||'').localeCompare(String(a[1].date||'')));
}
function fieldsBlock(){
  const rows=parcelRows();
  const content=rows.length?rows.slice(0,4).map(([p,t])=>{const loc=app.fieldLocations?.[p];return `<div class="ec11-field"><div class="ec11-fieldTop"><div><b>${esc(p)}</b><span>${esc(t.crop||'Genel')} · Son işlem: ${esc(t.category||'Kayıt')}${t.date?' · '+esc(t.date):''}</span></div><span class="ec11-satTag">${loc?'Uydu konumu hazır':'Konum bekliyor'}</span></div></div>`;}).join(''):`<div class="ec11-empty">Henüz tarla/parsel kaydı yok. İlk masraf veya gelir kaydında tarla adını yazdığında burada görünür.</div>`;
  return `<section class="ec11-block"><div class="ec11-head"><div><div class="ec11-kicker">Tarlalar</div><h2>Parsellerin ve son işler</h2></div><button class="ec11-link" onclick="window.ec10OpenSatellite&&window.ec10OpenSatellite()">Uydu</button></div><div class="ec11-fields">${content}</div></section>`;
}
function liveBlock(){
  const m=parseCache(MARKET_KEY),f=parseCache(FUEL_KEY),mi=marketItem(m),fi=fuelItem(f);
  const marketStale=!m||ageMs(m.updatedAt)>36*3600000;
  const fuelStale=!f||ageMs(f.updatedAt)>8*86400000;
  return `<section class="ec11-block"><div class="ec11-head"><div><div class="ec11-kicker">Canlı veriler</div><h2>Kaynak ve tarih görünür</h2></div></div><div class="ec11-liveGrid"><div class="ec11-live"><small>ÜRÜN PİYASASI</small><strong>${mi?`${esc(shortName(mi.name))} · ${tryPrice(mi.avg??mi.price,'kg')}`:'Veri alınamadı'}</strong><span class="${marketStale?'ec11-stale':''}">${mi?`${esc(mi.exchange||m.source||'Resmî kaynak')} · ${esc(mi.date||'')} · ${marketStale?'ESKİ VERİ · ':''}${freshness(m.updatedAt)}`:'Kaynak bağlantısı başarısızsa eski veri güncel diye gösterilmez.'}</span></div><div class="ec11-live"><small>AKARYAKIT</small><strong>${fi?`${esc(fi.name)} · ${tryPrice(fi.price,'Litre')}`:'Veri alınamadı'}</strong><span class="${fuelStale?'ec11-stale':''}">${fi?`EPDK · ${esc(fi.date||f.reportDate||'')} · ${fuelStale?'ESKİ VERİ · ':''}${freshness(f.updatedAt)}`:'Türkiye geneli son resmî EPDK bülteni bekleniyor.'}</span></div></div><div class="ec11-liveFoot"><span>Fiyatlar satış teklifi değildir.</span><button class="ec11-link" onclick="window.ec10RefreshLive&&window.ec10RefreshLive()">Yenile</button></div></section>`;
}
function quickBlock(){return `<section class="ec11-block"><div class="ec11-head"><div><div class="ec11-kicker">Hızlı işler</div><h2>Tek dokunuşla kayıt</h2></div></div><div class="ec11-quick"><button class="ec11-q primary" onclick="openTx('expense')">+ Masraf<small>Yeni gider kaydı</small></button><button class="ec11-q" onclick="openTx('income')">+ Gelir<small>Satış veya diğer gelir</small></button><button class="ec11-q" onclick="showPage('debts')">Borç / Alacak<small>Açık hesap takibi</small></button><button class="ec11-q" onclick="showPage('more');showSub('calculator')">Hesap Makinesi<small>Normal ve tarla hesabı</small></button></div></section>`;}
function renderHome(){
  const home=document.getElementById('home');if(!home)return;
  let host=document.getElementById('ec11Home');if(!host){host=document.createElement('div');host.id='ec11Home';host.className='ec11';home.prepend(host);}
  host.innerHTML=todayBlock()+seasonBlock()+fieldsBlock()+liveBlock()+quickBlock();
}

const previousRender=window.render;
if(typeof previousRender==='function')window.render=function(){const out=previousRender.apply(this,arguments);renderHome();return out;};
const previousShowPage=window.showPage;
if(typeof previousShowPage==='function')window.showPage=function(name){const out=previousShowPage.apply(this,arguments);if(name==='home')renderHome();return out;};
window.addEventListener('online',renderHome);window.addEventListener('offline',renderHome);
renderHome();
})();
