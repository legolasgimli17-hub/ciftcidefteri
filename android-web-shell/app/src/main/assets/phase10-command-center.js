(function(){
'use strict';
if(window.__EKINCEP_PHASE10_COMMAND_CENTER__)return;
window.__EKINCEP_PHASE10_COMMAND_CENTER__=true;

const P5=window.CiftciPhase5Core;
const P4=window.CiftciPhase4Core;
const H=value=>String(value??'').replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[ch]));
const TL=kurus=>new Intl.NumberFormat('tr-TR',{
  style:'currency',currency:'TRY',maximumFractionDigits:0
}).format((Number(kurus)||0)/100);
const N=value=>new Intl.NumberFormat('tr-TR',{maximumFractionDigits:1}).format(Number(value)||0);

const style=document.createElement('style');
style.textContent=`
/* EkinCep identity — bazalt / pamuk / tarla çizgileri */
#home>.hero,#home>.actions,#home>#p5Home,#home>#p4WeatherCard,#home>.card,#ec10FieldHero,#ec10Tools{display:none!important}
#home{padding-bottom:10px}.ec10-canvas{display:block}.ec10-canvas *{box-sizing:border-box}
.ec10-financeHero{position:relative;overflow:hidden;min-height:244px;background:#fff;border:1px solid var(--ec-line);border-left:6px solid var(--ec-basalt);padding:22px 20px 0;margin-bottom:0;isolation:isolate}
.ec10-financeHero:after{content:'';position:absolute;left:20px;right:20px;bottom:71px;height:1px;background:var(--ec-line-soft);z-index:-1}.ec10-heroCopy{position:relative;z-index:2;max-width:68%}.ec10-heroLabel{font-size:13px;font-weight:800;color:var(--ec-muted);margin-bottom:7px}.ec10-heroValue{font-family:Georgia,"Times New Roman",serif;font-size:47px;line-height:.98;letter-spacing:-2px;font-weight:700;color:var(--ec-basalt);font-variant-numeric:tabular-nums}.ec10-heroValue.negative{color:var(--ec-dry)}.ec10-heroNote{margin-top:8px;font-size:12.5px;line-height:1.45;color:var(--ec-muted);font-weight:650}.ec10-cropArt{position:absolute;right:-14px;top:22px;width:150px;height:150px;opacity:.92;z-index:1}.ec10-cropArt svg{width:100%;height:100%;fill:none;stroke:var(--ec-leaf);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.ec10-cropArt .accent{stroke:var(--ec-wheat)}.ec10-cropArt .cotton{fill:#fff;stroke:var(--ec-basalt);stroke-width:1.4}
.ec10-financeRail{position:absolute;left:20px;right:20px;bottom:0;height:71px;display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--ec-line-soft)}.ec10-financeCell{padding:12px 12px 10px;border-left:1px solid var(--ec-line-soft);min-width:0}.ec10-financeCell:first-child{border-left:0;padding-left:0}.ec10-financeCell span{display:block;font-size:11px;color:var(--ec-muted);font-weight:750}.ec10-financeCell b{display:block;margin-top:4px;font-size:15px;color:var(--ec-basalt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ec10-financeCell.income b{color:var(--ec-leaf)}.ec10-financeCell.debt b{color:var(--ec-dry)}
.ec10-today{border-bottom:1px solid var(--ec-line);padding:18px 0 0}.ec10-sectionHead{display:flex;align-items:end;justify-content:space-between;gap:12px;margin:0 2px 10px}.ec10-sectionHead h2{font-size:22px;line-height:1.1;letter-spacing:-.5px;margin:0;color:var(--ec-basalt)}.ec10-sectionHead span{font-size:11.5px;color:var(--ec-muted);font-weight:700;text-align:right}.ec10-todayRail{display:grid;grid-template-columns:1.15fr 1fr .8fr;border-top:1px solid var(--ec-line-soft)}.ec10-todayCell{min-height:82px;padding:13px 12px;border:0;border-left:1px solid var(--ec-line-soft);background:transparent;text-align:left;color:var(--ec-ink)}.ec10-todayCell:first-child{border-left:0;padding-left:2px}.ec10-todayCell span{display:block;font-size:10.5px;color:var(--ec-muted);font-weight:750}.ec10-todayCell b{display:block;margin-top:6px;font-size:14px;line-height:1.25;color:var(--ec-basalt)}.ec10-todayCell small{display:block;margin-top:3px;font-size:10.5px;color:var(--ec-muted);line-height:1.3}
.ec10-section{padding:23px 0 1px;border-bottom:1px solid var(--ec-line)}.ec10-cropLines{border-top:1px solid var(--ec-line-soft)}.ec10-cropRow{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:10px;align-items:center;min-height:68px;border-bottom:1px solid var(--ec-line-soft)}.ec10-cropRow:last-child{border-bottom:0}.ec10-cropGlyph{width:34px;height:34px;display:grid;place-items:center}.ec10-cropGlyph svg{width:30px;height:30px;fill:none;stroke:var(--ec-leaf);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.ec10-cropInfo{min-width:0}.ec10-cropInfo b{font-size:14px;color:var(--ec-basalt)}.ec10-cropInfo small{display:block;font-size:10.5px;color:var(--ec-muted);margin-top:2px}.ec10-lineTrack{height:5px;background:#E3E8E3;margin-top:7px;overflow:hidden}.ec10-lineFill{height:100%;background:var(--ec-leaf);min-width:4px}.ec10-lineFill.negative{background:var(--ec-dry)}.ec10-cropResult{font-family:Georgia,"Times New Roman",serif;font-size:15px;font-weight:700;color:var(--ec-leaf);white-space:nowrap}.ec10-cropResult.negative{color:var(--ec-dry)}
.ec10-fieldGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.ec10-field{position:relative;min-height:126px;padding:15px 15px 18px;border:1px solid #BFD0C2;background:#F7FAF7;color:var(--ec-ink);text-align:left;clip-path:polygon(0 0,100% 0,100% calc(100% - 17px),calc(100% - 17px) 100%,0 100%);overflow:hidden}.ec10-field:before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--ec-leaf)}.ec10-fieldTop{display:flex;align-items:center;gap:8px}.ec10-fieldTop .ec10-cropGlyph{width:30px;height:30px}.ec10-fieldName{font-size:15px;font-weight:900;color:var(--ec-basalt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ec10-fieldMeta{font-size:11px;color:var(--ec-muted);margin-top:7px;line-height:1.35}.ec10-fieldResult{font-family:Georgia,"Times New Roman",serif;font-size:18px;font-weight:700;color:var(--ec-leaf);margin-top:13px}.ec10-fieldResult.negative{color:var(--ec-dry)}
.ec10-dataRail{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid var(--ec-line);border-bottom:1px solid var(--ec-line)}.ec10-dataItem{min-height:105px;border:0;border-left:1px solid var(--ec-line-soft);background:transparent;padding:14px 11px;text-align:left;color:var(--ec-ink)}.ec10-dataItem:first-child{border-left:0;padding-left:2px}.ec10-dataMark{width:9px;height:9px;border-radius:50%;background:var(--ec-water);display:block;margin-bottom:11px}.ec10-dataItem.market .ec10-dataMark{background:var(--ec-wheat)}.ec10-dataItem.value .ec10-dataMark{background:var(--ec-leaf)}.ec10-dataItem span{display:block;font-size:10.5px;color:var(--ec-muted);font-weight:750}.ec10-dataItem b{display:block;margin-top:5px;font-size:14px;line-height:1.25;color:var(--ec-basalt)}.ec10-dataItem small{display:block;margin-top:4px;font-size:10px;line-height:1.3;color:var(--ec-muted)}
.ec10-toolChest{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--ec-line);background:#fff}.ec10-quick{min-height:72px;border:0;border-right:1px solid var(--ec-line-soft);border-bottom:1px solid var(--ec-line-soft);background:#fff;padding:13px 14px;text-align:left;color:var(--ec-basalt);font-weight:900;font-size:14px}.ec10-quick:nth-child(2n){border-right:0}.ec10-quick:nth-last-child(-n+2){border-bottom:0}.ec10-quick small{display:block;font-size:10.5px;color:var(--ec-muted);font-weight:650;margin-top:4px}.ec10-quick.expense{box-shadow:inset 4px 0 0 var(--ec-dry)}.ec10-quick.income{box-shadow:inset 4px 0 0 var(--ec-leaf)}.ec10-quick.market{box-shadow:inset 4px 0 0 var(--ec-wheat)}.ec10-quick.stock{box-shadow:inset 4px 0 0 var(--ec-water)}
.ec10-empty{padding:15px 2px 17px;color:var(--ec-muted);font-size:12.5px;line-height:1.45}.ec10-empty button{display:block;min-height:48px;margin-top:10px;border:1px solid var(--ec-line);background:#fff;color:var(--ec-basalt);border-radius:7px;padding:10px 13px;font-weight:850}
@media(max-width:520px){.ec10-financeHero{min-height:232px;padding:19px 16px 0}.ec10-heroCopy{max-width:72%}.ec10-heroValue{font-size:39px;letter-spacing:-1.5px}.ec10-cropArt{width:122px;height:122px;right:-10px;top:28px}.ec10-financeRail{left:16px;right:16px;height:70px}.ec10-financeCell{padding-left:8px;padding-right:8px}.ec10-financeCell:first-child{padding-left:0}.ec10-financeCell b{font-size:13px}.ec10-todayRail{grid-template-columns:1.1fr 1fr .8fr}.ec10-todayCell{padding-left:8px;padding-right:8px}.ec10-fieldGrid{grid-template-columns:1fr 1fr}.ec10-field{min-height:120px;padding:13px 12px 17px}.ec10-dataItem{padding-left:8px;padding-right:8px}.ec10-dataItem b{font-size:12.5px}.ec10-sectionHead h2{font-size:20px}}
@media(max-width:360px){.ec10-heroCopy{max-width:78%}.ec10-cropArt{opacity:.55}.ec10-heroValue{font-size:35px}.ec10-fieldGrid{grid-template-columns:1fr}.ec10-dataRail{grid-template-columns:1fr}.ec10-dataItem{min-height:76px;border-left:0;border-top:1px solid var(--ec-line-soft);padding-left:2px}.ec10-dataItem:first-child{border-top:0}.ec10-dataMark{display:inline-block;margin:0 7px 0 0;vertical-align:middle}.ec10-dataItem span{display:inline}.ec10-dataItem b{font-size:14px}.ec10-todayRail{grid-template-columns:1fr}.ec10-todayCell{min-height:62px;border-left:0;border-top:1px solid var(--ec-line-soft);padding-left:2px}.ec10-todayCell:first-child{border-top:0}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
`;
document.head.appendChild(style);

function effective(t){
  if(typeof window.eff==='function')return Number(window.eff(t))||0;
  if(typeof window.effective==='function')return Number(window.effective(t))||0;
  return t&&t.ownership==='partnership'?Math.round((Number(t.amount)||0)*(Number(t.share)||0)/100):Number(t?.amount)||0;
}

function seasonRows(){
  const year=String(new Date().getFullYear());
  return (app.transactions||[]).filter(t=>String(t.date||'').startsWith(year));
}

function openDebtTotal(){
  return (app.debts||[]).filter(d=>d.type==='owe').reduce((sum,d)=>sum+Math.max(0,(Number(d.amount)||0)-(Number(d.paid)||0)),0);
}

function totals(rows){
  const income=rows.filter(t=>t.type==='income').reduce((s,t)=>s+effective(t),0);
  const expense=rows.filter(t=>t.type==='expense').reduce((s,t)=>s+effective(t),0);
  return {income,expense,result:income-expense,debt:openDebtTotal()};
}

function dominantCrop(rows){
  const counts=new Map();
  for(const t of rows){
    const crop=String(t.crop||'').trim();
    if(!crop||crop==='Genel')continue;
    counts.set(crop,(counts.get(crop)||0)+1);
  }
  return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'Tarla';
}

function cropKind(crop){
  const s=String(crop||'').toLocaleLowerCase('tr');
  if(s.includes('pamuk'))return 'cotton';
  if(s.includes('mısır')||s.includes('misir'))return 'corn';
  if(s.includes('buğday')||s.includes('bugday')||s.includes('arpa'))return 'wheat';
  return 'field';
}

function cropSvg(crop,large=false){
  const kind=cropKind(crop);
  const cls=large?'ec10-cropArt':'ec10-cropGlyph';
  const body=kind==='cotton'
    ? `<path d="M24 42V22M24 29l-9-7M24 32l10-8M15 22c-4 1-6 4-6 8 5 0 8-2 10-6M34 24c4 1 6 4 6 8-5 0-8-2-10-6" class="accent"/><circle class="cotton" cx="24" cy="14" r="6"/><circle class="cotton" cx="17" cy="17" r="5"/><circle class="cotton" cx="31" cy="17" r="5"/>`
    : kind==='corn'
    ? `<path d="M24 43V8M24 28c-8-1-12-5-14-11 8 0 12 4 14 9M24 34c8-1 12-5 14-11-8 0-12 4-14 9"/><path class="accent" d="M25 15c7 1 10 6 8 14-6 0-9-5-8-14Z"/><path class="accent" d="M28 17l4 9M27 21l5-1M28 24l5-1"/>`
    : kind==='wheat'
    ? `<path d="M16 43V12M24 43V8M32 43V14"/><path class="accent" d="M24 10l-5 4 5 2 5-4-5-2Zm0 7-5 4 5 2 5-4-5-2Zm-8-3-4 3 4 2 4-3-4-2Zm16 2-4 3 4 2 4-3-4-2Zm0 7-4 3 4 2 4-3-4-2Z"/>`
    : `<path d="M7 37c9-8 20-12 34-11M7 43c10-7 21-9 34-7M10 31c7-7 15-11 25-13"/><circle class="accent" cx="36" cy="12" r="4"/>`;
  return `<span class="${cls}" aria-hidden="true"><svg viewBox="0 0 48 48">${body}</svg></span>`;
}

function friendlyDate(){
  try{return new Intl.DateTimeFormat('tr-TR',{weekday:'long',day:'numeric',month:'long'}).format(new Date());}
  catch{return 'Bugün';}
}

function latestActivity(){
  const row=(app.transactions||[])[0];
  if(!row)return {main:'Henüz kayıt yok',sub:'İlk gelir veya masrafını ekleyebilirsin.'};
  const place=String(row.parcel||'').trim();
  return {main:String(row.category||'Son kayıt'),sub:[place,row.crop].filter(Boolean).join(' · ')||'Son hareket'};
}

function weatherSnapshot(){
  const location=String(app.weatherLocation||'').trim();
  const cache=app.weatherCache;
  const forecast=cache&&cache.data&&cache.data.forecast;
  const current=forecast&&forecast.current;
  if(current){
    const temp=Number(current.temperature_2m);
    const label=P4&&typeof P4.weatherLabel==='function'?P4.weatherLabel(current.weather_code):'Güncel tahmin';
    return {main:Number.isFinite(temp)?Math.round(temp)+'°':(cache.data.name||location||'Hava'),sub:String(label||'Güncel tahmin'),location:cache.data.name||location||''};
  }
  if(location)return {main:location,sub:'Tahmini yenile',location};
  return {main:'Konum seçilmedi',sub:'İl veya ilçeni ekle',location:''};
}

function cropSummaries(rows){
  const map=new Map();
  for(const t of rows){
    const crop=String(t.crop||'Genel').trim()||'Genel';
    if(!map.has(crop))map.set(crop,{crop,income:0,expense:0,count:0});
    const x=map.get(crop);x.count++;
    if(t.type==='income')x.income+=effective(t);else x.expense+=effective(t);
  }
  return [...map.values()].map(x=>({...x,result:x.income-x.expense})).sort((a,b)=>Math.abs(b.result)-Math.abs(a.result));
}

function parcelSummaries(rows){
  if(P5&&typeof P5.parcelSummaries==='function')return P5.parcelSummaries(rows,effective);
  const map=new Map();
  for(const t of rows){
    const parcel=String(t.parcel||'').trim();if(!parcel)continue;
    if(!map.has(parcel))map.set(parcel,{parcel,crop:t.crop||'Genel',income:0,expense:0,count:0,lastCategory:''});
    const p=map.get(parcel);p.crop=t.crop||p.crop;p.count++;p.lastCategory=t.category||p.lastCategory;
    if(t.type==='income')p.income+=effective(t);else p.expense+=effective(t);
  }
  return [...map.values()].map(p=>({...p,result:p.income-p.expense}));
}

function marketSnapshot(crop){
  if(!P5||typeof P5.marketFor!=='function')return {main:'Piyasa tablosu',sub:'Kaynaklı referanslar'};
  const entry=P5.marketFor(crop);
  if(!entry)return {main:'Piyasa tablosu',sub:'Kaynaklı referanslar'};
  let main='Referans yok';
  if(Number.isFinite(entry.ref))main=`${N(entry.ref)} TL/kg`;
  else if(Number.isFinite(entry.low)&&Number.isFinite(entry.high))main=`${N(entry.low)}–${N(entry.high)} TL/kg`;
  const date=entry.date?entry.date.split('-').reverse().join('.'):'';
  return {main,sub:[crop,date].filter(Boolean).join(' · ')};
}

function holdingsTotal(){
  if(!P5||typeof P5.productValue!=='function')return 0;
  let tl=0;
  for(const [crop,qty] of Object.entries(app.productHoldings||{})){
    try{
      const value=P5.productValue(qty,P5.marketFor(crop),(app.marketOverrides||{})[crop]);
      if(value)tl+=Number(value.mid)||0;
    }catch{}
  }
  return Math.round(tl*100);
}

function renderCropLines(rows){
  const data=cropSummaries(rows).slice(0,4);
  if(!data.length)return `<div class="ec10-empty">Bu sezon için henüz ürün kaydı yok.<button type="button" onclick="openTx('expense')">İlk masrafı ekle</button></div>`;
  const max=Math.max(1,...data.map(x=>Math.abs(x.result)));
  return `<div class="ec10-cropLines">${data.map(x=>{
    const width=Math.max(5,Math.round(Math.abs(x.result)/max*100));
    const neg=x.result<0?' negative':'';
    return `<div class="ec10-cropRow">${cropSvg(x.crop)}<div class="ec10-cropInfo"><b>${H(x.crop)}</b><small>${x.count} kayıt · gelir ${TL(x.income)} · masraf ${TL(x.expense)}</small><div class="ec10-lineTrack"><div class="ec10-lineFill${neg}" style="width:${width}%"></div></div></div><div class="ec10-cropResult${neg}">${H(TL(x.result))}</div></div>`;
  }).join('')}</div>`;
}

function renderFields(rows){
  const fields=parcelSummaries(rows).slice(0,4);
  if(!fields.length)return `<div class="ec10-empty">Tarla adı yazılmış bir kayıt gelince parseller burada ayrı görünür.<button type="button" onclick="openTx('expense')">Tarla kaydı ekle</button></div>`;
  return `<div class="ec10-fieldGrid">${fields.map(p=>{
    const neg=p.result<0?' negative':'';
    return `<button class="ec10-field" type="button" data-parcel="${H(p.parcel)}" onclick="ec10OpenParcel(this.dataset.parcel)"><div class="ec10-fieldTop">${cropSvg(p.crop)}<span class="ec10-fieldName">${H(p.parcel)}</span></div><div class="ec10-fieldMeta">${H(p.crop||'Genel')} · ${p.count} kayıt<br>${H(p.lastCategory||'Son hareket yok')}</div><div class="ec10-fieldResult${neg}">${H(TL(p.result))}</div></button>`;
  }).join('')}</div>`;
}

function canvasMarkup(){
  const rows=seasonRows();
  const sum=totals(rows);
  const crop=dominantCrop(rows);
  const recent=latestActivity();
  const weather=weatherSnapshot();
  const market=marketSnapshot(crop);
  const stockValue=holdingsTotal();
  const resultClass=sum.result<0?' negative':'';
  const resultNote=sum.result>=0?'Gelirden masraf çıktıktan sonra kalan':'Masraf, sezon gelirinin üzerinde';
  return `
    <section class="ec10-financeHero" aria-labelledby="ec10ResultTitle">
      <div class="ec10-heroCopy"><div class="ec10-heroLabel" id="ec10ResultTitle">Bu sezon cebinde kalan</div><div class="ec10-heroValue${resultClass}">${H(TL(sum.result))}</div><div class="ec10-heroNote">${H(resultNote)} · ${H(crop)}</div></div>
      ${cropSvg(crop,true)}
      <div class="ec10-financeRail"><div class="ec10-financeCell income"><span>Sezon geliri</span><b>${H(TL(sum.income))}</b></div><div class="ec10-financeCell"><span>Sezon masrafı</span><b>${H(TL(sum.expense))}</b></div><div class="ec10-financeCell debt"><span>Açık borç</span><b>${H(TL(sum.debt))}</b></div></div>
    </section>

    <section class="ec10-today" aria-labelledby="ec10TodayTitle">
      <div class="ec10-sectionHead"><h2 id="ec10TodayTitle">Bugün</h2><span>${H(friendlyDate())}</span></div>
      <div class="ec10-todayRail">
        <button class="ec10-todayCell" type="button" onclick="showPage('ledger')"><span>Son hareket</span><b>${H(recent.main)}</b><small>${H(recent.sub)}</small></button>
        <button class="ec10-todayCell" type="button" onclick="ec10OpenWeather()"><span>Tarla havası</span><b>${H(weather.main)}</b><small>${H(weather.sub)}</small></button>
        <button class="ec10-todayCell" type="button" onclick="showPage('ledger')"><span>Sezon kaydı</span><b>${rows.length}</b><small>${new Date().getFullYear()} yılı</small></button>
      </div>
    </section>

    <section class="ec10-section" aria-labelledby="ec10SeasonTitle"><div class="ec10-sectionHead"><h2 id="ec10SeasonTitle">Bu sezon</h2><span>Ürünler birbirine karışmaz</span></div>${renderCropLines(rows)}</section>

    <section class="ec10-section" aria-labelledby="ec10FieldsTitle"><div class="ec10-sectionHead"><h2 id="ec10FieldsTitle">Tarlalar</h2><span>Parsel parsel hesap</span></div>${renderFields(rows)}</section>

    <section class="ec10-section" aria-labelledby="ec10LiveTitle"><div class="ec10-sectionHead"><h2 id="ec10LiveTitle">Canlı veriler</h2><span>Kaynağı belli olan veri</span></div>
      <div class="ec10-dataRail">
        <button class="ec10-dataItem" type="button" onclick="ec10OpenWeather()"><i class="ec10-dataMark"></i><span>Hava</span><b>${H(weather.main)}</b><small>${H(weather.location||weather.sub)}</small></button>
        <button class="ec10-dataItem market" type="button" onclick="ec10OpenMarket()"><i class="ec10-dataMark"></i><span>Piyasa</span><b>${H(market.main)}</b><small>${H(market.sub)}</small></button>
        <button class="ec10-dataItem value" type="button" onclick="ec10OpenMarket()"><i class="ec10-dataMark"></i><span>Ürün değeri</span><b>${H(TL(stockValue))}</b><small>Elindeki ürünlere göre</small></button>
      </div>
    </section>

    <section class="ec10-section" aria-labelledby="ec10QuickTitle"><div class="ec10-sectionHead"><h2 id="ec10QuickTitle">Hızlı işler</h2><span>Sık kullanılanlar</span></div>
      <div class="ec10-toolChest">
        <button class="ec10-quick expense" type="button" onclick="openTx('expense')">Masraf ekle<small>Tarlaya çıkan para</small></button>
        <button class="ec10-quick income" type="button" onclick="openTx('income')">Gelir ekle<small>Satış ve tahsilat</small></button>
        <button class="ec10-quick market" type="button" onclick="ec10OpenMarket()">Piyasaya bak<small>Ürün fiyatı ve değer</small></button>
        <button class="ec10-quick stock" type="button" onclick="ec10OpenStock()">Elindekiler<small>Stok ve ürün miktarı</small></button>
      </div>
    </section>`;
}

function renderCanvas(){
  const home=document.getElementById('home');if(!home)return;
  document.getElementById('ec10FieldHero')?.remove();
  document.getElementById('ec10Tools')?.remove();
  let canvas=document.getElementById('ec10Canvas');
  if(!canvas){
    canvas=document.createElement('div');canvas.id='ec10Canvas';canvas.className='ec10-canvas';
    home.insertBefore(canvas,home.firstChild);
  }
  const markup=canvasMarkup();
  if(canvas.innerHTML!==markup)canvas.innerHTML=markup;
}

window.ec10OpenMarket=function(){
  const button=document.getElementById('p5MarketBtn');
  if(button){button.click();return;}
  if(document.getElementById('market'))showPage('market');
};
window.ec10OpenStock=function(){showPage('more');showSub('inventory');};
window.ec10OpenWeather=function(){
  if(!app.weatherLocation){showPage('more');showSub('weather');return;}
  if(typeof window.requestP4Weather==='function'){
    window.requestP4Weather(true);
    try{toast('Hava tahmini yenileniyor.');}catch{}
  }else{showPage('more');showSub('weather');}
};
window.ec10OpenParcel=function(parcel){
  showPage('ledger');
  requestAnimationFrame(()=>{
    const search=document.getElementById('p5LedgerSearch');
    if(search){
      search.value=parcel;
      search.dispatchEvent(new Event('input',{bubbles:true}));
      search.focus();
    }
  });
};

const previousRender=window.render;
if(typeof previousRender==='function')window.render=function(){previousRender();renderCanvas();};
const previousRenderAll=window.renderAll;
if(typeof previousRenderAll==='function'&&previousRenderAll!==previousRender)window.renderAll=function(){previousRenderAll();renderCanvas();};

renderCanvas();
let queued=false;
const observer=new MutationObserver(()=>{
  if(queued)return;queued=true;
  requestAnimationFrame(()=>{queued=false;renderCanvas();});
});
observer.observe(document.getElementById('home')||document.body,{childList:true,subtree:true});
})();
