(function () {
  'use strict';
  if (window.__CDF_PHASE4__) return;
  window.__CDF_PHASE4__ = true;

  const Core = window.CiftciPhase4Core;
  if (!Core) throw new Error('phase4_core_missing');

  const style = document.createElement('style');
  style.textContent = `
    :root{--p4-gold:#d8a928;--p4-sky:#dff0f4;--p4-blue:#316c7b;--p4-dark:#112019}
    body{background:radial-gradient(circle at 100% 0%,#e4efe7 0,transparent 32%),linear-gradient(180deg,#f5f7f2 0%,#eef2ec 100%)}
    .wrap{padding-top:14px}.top{margin-bottom:18px}.brand{display:flex;align-items:center;gap:11px;letter-spacing:-.7px}
    .p4-logo{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(145deg,#277857,var(--green2));box-shadow:0 9px 24px rgba(31,100,72,.22)}
    .p4-logo svg{width:25px;height:25px}.status{box-shadow:inset 0 0 0 1px rgba(31,100,72,.08)}
    .hero{position:relative;overflow:hidden;background:linear-gradient(140deg,#216a4c 0%,#154b37 72%);box-shadow:0 18px 40px rgba(24,75,54,.18)}
    .hero:after{content:'';position:absolute;width:180px;height:180px;border-radius:50%;right:-55px;top:-75px;background:rgba(255,255,255,.07)}
    .card{border-color:rgba(24,55,38,.09);box-shadow:0 12px 34px rgba(28,50,36,.065)}
    .card h2{letter-spacing:-.25px}.actions{gap:12px}.action{box-shadow:0 9px 24px rgba(24,55,38,.08);transition:transform .12s ease}.action:active{transform:scale(.985)}
    .p4-weather{background:linear-gradient(145deg,#f9fcfb,#edf7f8);border-color:#d5e7e9}.p4-weather-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.p4-weather-title{display:flex;align-items:center;gap:9px;font-size:18px;font-weight:950}.p4-weather-icon{font-size:29px}.p4-weather-main{display:flex;align-items:end;justify-content:space-between;gap:12px;margin:13px 0}.p4-temp{font-size:36px;font-weight:950;letter-spacing:-1px}.p4-weather-desc{font-weight:850;color:var(--p4-blue)}
    .p4-days{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.p4-day{background:#fff;border:1px solid #d9e7e8;border-radius:14px;padding:10px;text-align:center}.p4-day b{display:block;margin:4px 0}.p4-day small{color:var(--muted)}
    .p4-alerts{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.p4-alert{background:#fff1dd;color:#80520b;border:1px solid #f0d2a1;border-radius:999px;padding:7px 9px;font-size:12px;font-weight:900}
    .p4-ghost{border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:12px;padding:9px 11px;font-weight:850}.p4-link{border:0;background:transparent;color:var(--green);font-weight:900;padding:7px}
    .p4-row-actions{display:flex;gap:6px;justify-content:flex-end;margin-top:7px}.p4-edit{color:var(--green);background:var(--soft);border-color:#d6e8dc}.p4-cancel{width:100%;min-height:50px;margin-top:8px;border:1px solid var(--line);background:#fff;border-radius:15px;font-weight:850}
    .menuBtn{position:relative;min-height:118px;padding:16px;border-radius:18px;box-shadow:0 7px 20px rgba(25,50,34,.045);transition:transform .12s ease}.menuBtn:active{transform:scale(.985)}.p4-menu-icon{display:grid;place-items:center;width:39px;height:39px;border-radius:12px;background:var(--soft);font-size:20px;margin-bottom:10px}.menuBtn strong{font-size:16px}
    .p4-tool-card{background:linear-gradient(150deg,#fff,#f8faf7)}.p4-result-box{margin-top:12px;border-radius:16px;padding:15px;background:var(--soft);color:var(--green);font-size:22px;font-weight:950}.p4-tool-divider{height:1px;background:var(--line);margin:18px 0}
    .p4-empty-cta{margin-top:10px;border:0;background:var(--soft);color:var(--green);border-radius:12px;padding:10px 13px;font-weight:900}
    .p4-field-note{font-size:12px;color:var(--muted);margin-top:7px;line-height:1.4}
    @media(max-width:420px){.p4-days{grid-template-columns:1fr}.p4-weather-main{align-items:flex-start}.p4-temp{font-size:32px}.menuBtn{min-height:108px}}
  `;
  document.head.appendChild(style);

  const brand = document.querySelector('.brand');
  if (brand) brand.innerHTML = `<span class="p4-logo" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M5 18c6.8 0 11.5-4.6 13-12-7.6 1-12.3 5.5-13 12Z" stroke="white" stroke-width="2" stroke-linejoin="round"/><path d="M6 18c2.7-3.7 5.4-6.2 9.3-8.3" stroke="white" stroke-width="2" stroke-linecap="round"/></svg></span><span>Çiftçi Defteri</span>`;

  let editingTxId = null;
  let weatherInFlight = false;

  function formatInputMoney(kurus) {
    return (Number(kurus || 0) / 100).toFixed(2).replace('.', ',');
  }

  function enhanceMenu() {
    const grid = document.querySelector('.menuGrid');
    if (!grid) return;
    const icons = [
      ['Elindekiler','📦'],['Ortaklık','🤝'],['Yedek','🛡️']
    ];
    [...grid.querySelectorAll('.menuBtn')].forEach(btn => {
      if (btn.querySelector('.p4-menu-icon')) return;
      const text = btn.textContent.trim();
      const found = icons.find(([name]) => text.startsWith(name));
      if (!found) return;
      const first = btn.childNodes[0];
      const title = first && first.nodeType === Node.TEXT_NODE ? first.textContent.trim() : found[0];
      const span = btn.querySelector('span');
      const desc = span ? span.textContent : '';
      btn.innerHTML = `<span class="p4-menu-icon">${found[1]}</span><strong>${esc(title)}</strong><span>${esc(desc)}</span>`;
    });
    if (!document.getElementById('p4WeatherMenu')) {
      const weather = document.createElement('button');
      weather.id = 'p4WeatherMenu'; weather.className = 'menuBtn'; weather.type = 'button'; weather.onclick = () => showSub('weather');
      weather.innerHTML = '<span class="p4-menu-icon">🌦️</span><strong>Hava durumu</strong><span>İl / ilçe tahmini ve tarla uyarıları</span>';
      grid.appendChild(weather);
    }
    if (!document.getElementById('p4CalculatorMenu')) {
      const calc = document.createElement('button');
      calc.id = 'p4CalculatorMenu'; calc.className = 'menuBtn'; calc.type = 'button'; calc.onclick = () => showSub('calculator');
      calc.innerHTML = '<span class="p4-menu-icon">🧮</span><strong>Hesap makinesi</strong><span>Hızlı, tarla ve ürün hesabı</span>';
      grid.appendChild(calc);
    }
  }

  function installWeatherCard() {
    const home = document.getElementById('home');
    const actions = home && home.querySelector('.actions');
    if (!actions || document.getElementById('p4WeatherCard')) return;
    const card = document.createElement('div');
    card.id = 'p4WeatherCard'; card.className = 'card p4-weather';
    actions.insertAdjacentElement('afterend', card);
    renderWeatherCard();
  }

  function parseWeatherDays(cache) {
    const forecast = cache && cache.data && cache.data.forecast;
    const daily = forecast && forecast.daily;
    if (!daily || !Array.isArray(daily.time)) return [];
    return daily.time.slice(0,3).map((date, i) => ({
      date,
      code: daily.weather_code?.[i],
      minTemp: daily.temperature_2m_min?.[i],
      maxTemp: daily.temperature_2m_max?.[i],
      precipitation: daily.precipitation_sum?.[i],
      precipitationProbability: daily.precipitation_probability_max?.[i],
      windGust: daily.wind_gusts_10m_max?.[i]
    }));
  }

  function dayName(iso, index) {
    if (index === 0) return 'Bugün';
    if (index === 1) return 'Yarın';
    try { return new Intl.DateTimeFormat('tr-TR',{weekday:'short'}).format(new Date(iso+'T12:00:00')); } catch { return iso; }
  }

  function renderWeatherCard() {
    const card = document.getElementById('p4WeatherCard');
    if (!card) return;
    const location = app.weatherLocation || '';
    const cache = app.weatherCache;
    if (!location) {
      card.innerHTML = `<div class="p4-weather-head"><div class="p4-weather-title"><span class="p4-weather-icon">🌦️</span>Tarla havası</div></div><div class="hint" style="margin-top:8px">İl veya ilçeni bir kez seç; GPS izni istemeden hava tahmini gösterelim.</div><button class="p4-ghost" type="button" style="margin-top:12px" onclick="showPage('more');showSub('weather')">Konumu ayarla</button>`;
      return;
    }
    if (!cache || !cache.data) {
      card.innerHTML = `<div class="p4-weather-head"><div class="p4-weather-title"><span class="p4-weather-icon">🌦️</span>${esc(location)}</div><button class="p4-link" type="button" onclick="requestP4Weather(true)">Yenile</button></div><div class="hint" style="margin-top:10px">Tahmin yükleniyor…</div>`;
      return;
    }
    const forecast = cache.data.forecast || {};
    const current = forecast.current || {};
    const days = parseWeatherDays(cache);
    const first = days[0] || {};
    const warnings = days.flatMap(day => Core.weatherWarnings(day)).filter((w,i,a)=>a.findIndex(x=>x.type===w.type)===i);
    const place = cache.data.name || location;
    card.innerHTML = `<div class="p4-weather-head"><div class="p4-weather-title"><span class="p4-weather-icon">${Core.weatherIcon(current.weather_code ?? first.code)}</span>${esc(place)}</div><button class="p4-link" type="button" onclick="requestP4Weather(true)">Yenile</button></div>
      <div class="p4-weather-main"><div><div class="p4-temp">${Number.isFinite(Number(current.temperature_2m))?Math.round(Number(current.temperature_2m))+'°':'—'}</div><div class="p4-weather-desc">${esc(Core.weatherLabel(current.weather_code ?? first.code))}</div></div><div class="hint">Son tahmin<br>${cache.fetchedAt ? new Date(cache.fetchedAt).toLocaleString('tr-TR',{hour:'2-digit',minute:'2-digit'}) : ''}</div></div>
      <div class="p4-days">${days.map((d,i)=>`<div class="p4-day"><small>${dayName(d.date,i)}</small><b>${Core.weatherIcon(d.code)} ${Math.round(Number(d.maxTemp)||0)}° / ${Math.round(Number(d.minTemp)||0)}°</b><small>Yağış %${Math.round(Number(d.precipitationProbability)||0)}</small></div>`).join('')}</div>
      ${warnings.length?`<div class="p4-alerts">${warnings.map(w=>`<span class="p4-alert">⚠ ${esc(w.label)}</span>`).join('')}</div>`:'<div class="p4-field-note">Öne çıkan don, aşırı sıcak, kuvvetli rüzgâr veya yoğun yağış riski görünmüyor.</div>'}`;
  }

  window.requestP4Weather = function (force) {
    const location = app.weatherLocation || '';
    if (!location) { showPage('more'); showSub('weather'); return; }
    if (!force && app.weatherCache?.fetchedAt && Date.now()-app.weatherCache.fetchedAt < 30*60*1000) return;
    if (weatherInFlight) return;
    if (!window.AndroidBridge || typeof AndroidBridge.fetchWeather !== 'function') { toast('Hava durumu bu cihazda kullanılamıyor.'); return; }
    weatherInFlight = true;
    renderWeatherCard();
    AndroidBridge.fetchWeather(location);
  };

  window.onNativeWeather = async function (ok, payload) {
    weatherInFlight = false;
    if (!ok) {
      if (!app.weatherCache) toast('Hava tahmini alınamadı. İnternet bağlantını kontrol et.');
      renderWeatherCard();
      return;
    }
    try {
      const data = JSON.parse(payload);
      app.weatherCache = { data, fetchedAt: Date.now() };
      await save();
      renderWeatherCard();
      const rows = document.getElementById('p4WeatherSettingsResult');
      if (rows) rows.textContent = 'Hava durumu güncellendi.';
    } catch { toast('Hava tahmini okunamadı.'); }
  };

  function weatherSettings() {
    subContent.innerHTML = `<div class="card p4-tool-card"><h2>🌦️ Hava durumu</h2><div class="hint">GPS istemiyoruz. İl veya ilçeni yazman yeterli.</div><label>İl / ilçe</label><input id="p4WeatherLocation" placeholder="Örn. Bismil veya Diyarbakır" value="${esc(app.weatherLocation||'')}"><button class="primary" type="button" onclick="saveP4WeatherLocation()">Kaydet ve tahmini getir</button><div id="p4WeatherSettingsResult" class="p4-field-note">Open‑Meteo tahmini kullanılır. Dolu için doğrulanmamış alarm üretmeyiz.</div></div>`;
  }

  window.saveP4WeatherLocation = async function () {
    const value = document.getElementById('p4WeatherLocation')?.value.trim();
    if (!value || value.length < 2 || value.length > 80) { toast('İl veya ilçe adını kontrol et.'); return; }
    app.weatherLocation = value;
    app.weatherCache = null;
    await save();
    renderWeatherCard();
    requestP4Weather(true);
  };

  function calculator() {
    subContent.innerHTML = `<div class="card p4-tool-card"><h2>🧮 Hesap makinesi</h2>
      <h3>Hızlı hesap</h3><div class="grid2"><input id="p4CalcA" inputmode="decimal" placeholder="1. sayı"><input id="p4CalcB" inputmode="decimal" placeholder="2. sayı"></div><label>İşlem</label><select id="p4CalcOp"><option value="add">Topla (+)</option><option value="subtract">Çıkar (−)</option><option value="multiply">Çarp (×)</option><option value="divide">Böl (÷)</option></select><button class="primary" type="button" onclick="calcP4Quick()">Hesapla</button><div id="p4CalcQuickResult" class="p4-result-box">—</div>
      <div class="p4-tool-divider"></div><h3>Tarla masrafı</h3><div class="grid2"><div><label>Dönüm</label><input id="p4Area" inputmode="decimal" placeholder="18"></div><div><label>TL / dönüm</label><input id="p4AreaCost" inputmode="decimal" placeholder="1250"></div></div><button class="primary" type="button" onclick="calcP4Field()">Toplam masrafı bul</button><div id="p4FieldResult" class="p4-result-box">—</div>
      <div class="p4-tool-divider"></div><h3>Ürün satış hesabı</h3><div class="grid2"><div><label>Kilogram</label><input id="p4Kg" inputmode="decimal" placeholder="3500"></div><div><label>TL / kg</label><input id="p4KgPrice" inputmode="decimal" placeholder="14,75"></div></div><button class="primary" type="button" onclick="calcP4Sale()">Satış tutarını bul</button><div id="p4SaleResult" class="p4-result-box">—</div>
      <div class="p4-field-note">Bu hesaplar yardımcı araçtır; sonuçlar deftere otomatik kaydedilmez.</div></div>`;
  }

  function localNumber(raw) {
    const s = String(raw||'').trim().replace(/\s+/g,'').replace(/\./g,'').replace(',','.');
    const n = Number(s); return Number.isFinite(n) ? n : NaN;
  }
  function formatNumber(n) { return new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2}).format(n); }
  function formatTL(n) { return new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}).format(n); }
  window.calcP4Quick = function () { try { const r=Core.quickCalculate(localNumber(v('p4CalcA')),localNumber(v('p4CalcB')),v('p4CalcOp')); p4CalcQuickResult.textContent=formatNumber(r); } catch(e){ toast(e.message==='divide_by_zero'?'Sıfıra bölme yapılamaz.':'Sayıları kontrol et.'); } };
  window.calcP4Field = function () { try { p4FieldResult.textContent=formatTL(Core.fieldCost(localNumber(v('p4Area')),localNumber(v('p4AreaCost')))); } catch { toast('Dönüm ve tutarı kontrol et.'); } };
  window.calcP4Sale = function () { try { p4SaleResult.textContent=formatTL(Core.saleValue(localNumber(v('p4Kg')),localNumber(v('p4KgPrice')))); } catch { toast('Kg ve fiyatı kontrol et.'); } };

  const previousShowSub = window.showSub;
  window.showSub = function (kind) {
    if (kind === 'weather') { weatherSettings(); return; }
    if (kind === 'calculator') { calculator(); return; }
    const result = previousShowSub(kind);
    enhanceMenu();
    return result;
  };

  const saveButton = document.querySelector('#tx button.primary[onclick="saveTx()"]');
  let cancelEdit = document.getElementById('p4CancelEdit');
  if (saveButton && !cancelEdit) {
    cancelEdit = document.createElement('button');
    cancelEdit.id = 'p4CancelEdit'; cancelEdit.type = 'button'; cancelEdit.className = 'p4-cancel hidden'; cancelEdit.textContent = 'Düzenlemeyi iptal et';
    cancelEdit.onclick = () => { resetEdit(); showPage('ledger'); };
    saveButton.insertAdjacentElement('afterend', cancelEdit);
  }

  function resetEdit() {
    editingTxId = null;
    if (saveButton) saveButton.textContent = 'Kaydet';
    if (cancelEdit) cancelEdit.classList.add('hidden');
    txTitle.textContent = txType === 'income' ? 'Gelir ekle' : 'Masraf ekle';
  }

  const originalOpenTx = window.openTx;
  window.openTx = function (type) {
    resetEdit();
    txAmount.value=''; txNote.value=''; parcel.value='';
    txDate.value = typeof today === 'function' ? today() : txDate.value;
    return originalOpenTx(type);
  };

  window.txRow = function (t, del=false) {
    const e=eff(t), share=t.ownership==='partnership'?`<div class="sub">Toplam ${money(t.amount)} · Bana düşen ${money(e)}</div>`:'';
    return `<div class="row" data-tx-id="${esc(t.id)}"><div><div class="title">${esc(t.category)}</div><div class="sub">${esc(sub(t))}</div>${share}</div><div><div class="amount ${t.type==='income'?'in':'out'}">${t.type==='income'?'+':'−'} ${money(e)}</div>${del?`<div class="p4-row-actions"><button class="small p4-edit" onclick="editTx('${t.id}')">Düzenle</button><button class="small danger" onclick="delTx('${t.id}')">Sil</button></div>`:''}</div></div>`;
  };

  window.editTx = function (transactionId) {
    const t = app.transactions.find(x=>x.id===transactionId);
    if (!t) { toast('Kayıt bulunamadı.'); return; }
    editingTxId = transactionId;
    showPage('tx');
    setTxType(t.type);
    parcel.value=t.parcel||'';
    cropGroup.value=t.cropGroup||'Genel'; fillCropItems(); cropItem.value=t.crop||'Genel';
    ownership.value=t.ownership||'self'; togglePartner(); if(t.partnerId) partnerSelect.value=t.partnerId;
    txCategory.value=t.category; renderDetails();
    Object.entries(t.details||{}).forEach(([key,value])=>{const el=document.getElementById(key);if(el)el.value=value;});
    txAmount.value=formatInputMoney(t.amount); txDate.value=t.date||today(); txStatus.value=t.status||'paid'; txNote.value=t.note||'';
    txTitle.textContent = t.type==='income' ? 'Geliri düzenle' : 'Masrafı düzenle';
    if(saveButton)saveButton.textContent='Değişiklikleri kaydet'; if(cancelEdit)cancelEdit.classList.remove('hidden');
    window.scrollTo(0,0);
  };

  window.saveTx = async function () {
    let amount; try { amount=parseMoney(v('txAmount')); } catch(e){ toast(e.message); return; }
    let partnerId=null,share=100;
    if(v('ownership')==='partnership') { partnerId=v('partnerSelect'); const p=app.partnerships.find(x=>x.id===partnerId); if(!p){toast('Önce ortaklık oluştur');return;} share=p.share; }
    const common={type:txType,amount,parcel:v('parcel').trim(),cropGroup:v('cropGroup'),crop:v('cropItem'),ownership:v('ownership'),partnerId,share,category:v('txCategory'),details:details(),status:v('txStatus'),date:v('txDate')||today(),note:v('txNote').trim().slice(0,160)};
    if(editingTxId) {
      const index=app.transactions.findIndex(x=>x.id===editingTxId); if(index<0){toast('Kayıt bulunamadı.');resetEdit();return;}
      app.transactions[index]={...app.transactions[index],...common,updatedAt:Date.now()};
      await save(); resetEdit(); render(); showPage('ledger'); toast('Kayıt güncellendi');
    } else {
      app.transactions.unshift({id:id(),...common,createdAt:Date.now()});
      await save(); txAmount.value='';txNote.value='';render();showPage('home');toast('Kayıt eklendi');
    }
  };

  function decorateEmptyStates() {
    const recentEmpty = document.querySelector('#recent .empty');
    if (recentEmpty && !recentEmpty.querySelector('.p4-empty-cta')) recentEmpty.innerHTML = 'Henüz kayıt yok.<br><button class="p4-empty-cta" onclick="openTx(\'expense\')">İlk masrafı ekle</button>';
  }

  const originalRender = window.render;
  window.render = function () {
    const categoryWasOn = document.querySelector('#p3LedgerSegment button[data-mode="category"]')?.classList.contains('on');
    originalRender();
    enhanceMenu(); installWeatherCard(); renderWeatherCard(); decorateEmptyStates();
    if (categoryWasOn) document.querySelector('#p3LedgerSegment button[data-mode="category"]')?.click();
  };

  enhanceMenu(); installWeatherCard(); decorateEmptyStates();
  setTimeout(()=>{ try{ render(); requestP4Weather(false); }catch{} },120);
})();
