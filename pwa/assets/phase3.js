(function () {
  'use strict';
  if (window.__CDF_PHASE3__) return;
  window.__CDF_PHASE3__ = true;

  const Core = window.CiftciPhase3Core;
  if (!Core) throw new Error('phase3_core_missing');

  const style = document.createElement('style');
  style.textContent = `
    .p3-date-shortcuts{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
    .p3-chip{border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:999px;padding:9px 13px;font-weight:850;font-size:13px}
    .p3-segment{display:grid;grid-template-columns:1fr 1fr;gap:5px;background:#edf0ec;padding:5px;border-radius:14px;margin-bottom:12px}
    .p3-segment button{border:0;background:transparent;padding:10px;border-radius:10px;font-weight:850;color:var(--muted)}
    .p3-segment button.on{background:#fff;color:var(--ink)}
    .p3-forecast-btn{width:100%;min-height:50px;margin-top:10px;border:1.5px solid var(--green);background:#fff;color:var(--green);border-radius:14px;font-weight:900}
    .p3-disclaimer{background:#fff7e6;color:#76500e;border:1px solid #ecd8aa;border-radius:13px;padding:11px;font-size:13px;line-height:1.45;margin:12px 0}
    .p3-result{font-size:29px;font-weight:950;color:var(--green);margin:8px 0 14px}
    .p3-step{font-size:12px;font-weight:900;color:var(--muted);margin-bottom:7px}
    .p3-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
    .p3-back{min-height:50px;border:1px solid var(--line);background:#fff;border-radius:14px;font-weight:850}
    .p3-category-head{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:14px 0 5px;border-bottom:2px solid var(--line)}
    .p3-category-total{font-weight:950}
  `;
  document.head.appendChild(style);

  const status = document.getElementById('storageStatus');
  if (status) status.textContent = 'İnternetsiz çalışır';
  [...document.querySelectorAll('label')].forEach(label => {
    if (label.textContent.trim() === 'Hesap') label.textContent = 'Kimin hesabı?';
  });

  window.today = function () { return Core.localDateISO(new Date()); };
  const localToday = Core.localDateISO(new Date());
  const txDate = document.getElementById('txDate');
  const debtDate = document.getElementById('debtDate');
  if (txDate) txDate.value = localToday;
  if (debtDate) debtDate.value = localToday;

  function installDateShortcuts(inputId) {
    const input = document.getElementById(inputId);
    if (!input || document.querySelector(`[data-p3-date-for="${inputId}"]`)) return;
    const row = document.createElement('div');
    row.className = 'p3-date-shortcuts';
    row.dataset.p3DateFor = inputId;
    const todayButton = document.createElement('button');
    todayButton.type = 'button';
    todayButton.className = 'p3-chip';
    todayButton.textContent = 'Bugün';
    todayButton.onclick = () => {
      input.value = Core.localDateISO(new Date());
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const yesterdayButton = document.createElement('button');
    yesterdayButton.type = 'button';
    yesterdayButton.className = 'p3-chip';
    yesterdayButton.textContent = 'Dün';
    yesterdayButton.onclick = () => {
      input.value = Core.shiftLocalDaysISO(new Date(), -1);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    row.append(todayButton, yesterdayButton);
    input.insertAdjacentElement('afterend', row);
  }
  installDateShortcuts('txDate');
  installDateShortcuts('debtDate');

  [...document.querySelectorAll('.menuBtn')].forEach(button => {
    if (button.textContent.trim().startsWith('Banka')) button.remove();
  });
  if (typeof window.showSub === 'function') {
    const originalShowSub = window.showSub;
    window.showSub = function (kind) {
      if (kind === 'bank') {
        toast('Banka bölümü bu sürümde kapalı.');
        return;
      }
      return originalShowSub(kind);
    };
  }

  let ledgerMode = 'date';
  const ledgerRows = document.getElementById('ledgerRows');
  if (ledgerRows && !document.getElementById('p3LedgerSegment')) {
    const segment = document.createElement('div');
    segment.id = 'p3LedgerSegment';
    segment.className = 'p3-segment';
    segment.innerHTML = '<button type="button" class="on" data-mode="date">Tarihe göre</button><button type="button" data-mode="category">Kategoriye göre</button>';
    ledgerRows.insertAdjacentElement('beforebegin', segment);
    segment.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
      ledgerMode = button.dataset.mode;
      segment.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === button));
      renderLedgerMode();
    }));
  }

  function renderLedgerMode() {
    const target = document.getElementById('ledgerRows');
    if (!target) return;
    if (ledgerMode === 'date') {
      target.innerHTML = app.transactions.length
        ? app.transactions.map(t => txRow(t, true)).join('')
        : '<div class="empty">Henüz kayıt yok.</div>';
      return;
    }
    const groups = Core.groupByCategory(app.transactions, effective);
    if (!groups.length) {
      target.innerHTML = '<div class="empty">Henüz kayıt yok.</div>';
      return;
    }
    target.innerHTML = groups.map(group => {
      const rows = group.transactions.map(t => txRow(t, true)).join('');
      return `<div class="p3-category-head"><div class="title">${escapeHtml(group.category)}</div><div class="p3-category-total">${money(group.total)}</div></div>${rows}`;
    }).join('');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  const cropProfit = document.getElementById('cropProfit');
  if (cropProfit && !document.getElementById('p3ForecastOpen')) {
    const button = document.createElement('button');
    button.id = 'p3ForecastOpen';
    button.className = 'p3-forecast-btn';
    button.type = 'button';
    button.textContent = 'Tahmini hasat gelirini hesapla';
    button.onclick = openForecast;
    cropProfit.insertAdjacentElement('afterend', button);
  }

  const wrap = document.querySelector('.wrap');
  const forecastPage = document.createElement('section');
  forecastPage.id = 'forecast';
  forecastPage.className = 'page';
  forecastPage.innerHTML = '<div class="card"><div id="p3ForecastBody"></div></div>';
  if (wrap) wrap.appendChild(forecastPage);

  const forecast = { step: 1, crop: '', parcel: '', area: 0, yieldKg: 0, priceKurus: 0 };

  function cropOptions() {
    const all = [];
    Object.values(crops).forEach(list => list.forEach(crop => {
      if (!all.includes(crop)) all.push(crop);
    }));
    return all;
  }

  function parcelOptions(crop) {
    const found = [];
    app.transactions.filter(t => t.crop === crop && t.parcel).forEach(t => {
      if (!found.includes(t.parcel)) found.push(t.parcel);
    });
    return found;
  }

  function parcelKey(crop, parcel) {
    return `${crop}::${parcel || ''}`;
  }

  function openForecast() {
    if (!app.parcelAreas || typeof app.parcelAreas !== 'object') app.parcelAreas = {};
    forecast.step = 1;
    forecast.crop = cropOptions()[0] || 'Genel';
    forecast.parcel = '';
    forecast.area = 0;
    forecast.yieldKg = 0;
    forecast.priceKurus = 0;
    showPage('forecast');
    renderForecast();
  }

  function renderForecast() {
    const body = document.getElementById('p3ForecastBody');
    if (!body) return;

    if (forecast.step === 1) {
      const cropList = cropOptions();
      body.innerHTML = `<div class="p3-step">1 / 4</div><h2>Hangi ürün için?</h2><label>Ürün</label><select id="p3Crop">${cropList.map(c => `<option ${c===forecast.crop?'selected':''}>${escapeHtml(c)}</option>`).join('')}</select><label>Parsel</label><select id="p3Parcel"></select><label>Arazi büyüklüğü (dönüm)</label><input id="p3Area" inputmode="decimal" placeholder="Örn. 18"><div class="p3-actions"><button class="p3-back" type="button" id="p3Cancel">Vazgeç</button><button class="primary" type="button" id="p3Next" style="margin-top:0">Devam</button></div>`;
      const cropSelect = document.getElementById('p3Crop');
      const parcelSelect = document.getElementById('p3Parcel');
      const areaInput = document.getElementById('p3Area');

      function refreshParcels() {
        forecast.crop = cropSelect.value;
        const parcels = parcelOptions(forecast.crop);
        parcelSelect.innerHTML = '<option value="">Genel / parsel seçme</option>' + parcels.map(p => `<option>${escapeHtml(p)}</option>`).join('');
        if (parcels.includes(forecast.parcel)) parcelSelect.value = forecast.parcel;
        const saved = app.parcelAreas[parcelKey(forecast.crop, parcelSelect.value)];
        areaInput.value = saved ? String(saved).replace('.', ',') : '';
      }

      cropSelect.onchange = refreshParcels;
      parcelSelect.onchange = () => {
        forecast.parcel = parcelSelect.value;
        const saved = app.parcelAreas[parcelKey(cropSelect.value, forecast.parcel)];
        areaInput.value = saved ? String(saved).replace('.', ',') : '';
      };
      refreshParcels();
      document.getElementById('p3Cancel').onclick = () => showPage('home');
      document.getElementById('p3Next').onclick = () => {
        const area = parseLocalNumber(areaInput.value);
        if (!(area > 0)) {
          toast('Arazi büyüklüğünü gir.');
          return;
        }
        forecast.crop = cropSelect.value;
        forecast.parcel = parcelSelect.value;
        forecast.area = area;
        forecast.step = 2;
        renderForecast();
      };
      return;
    }

    if (forecast.step === 2) {
      body.innerHTML = `<div class="p3-step">2 / 4</div><h2>Dönüme tahmini verim?</h2><div class="hint">${escapeHtml(forecast.crop)}${forecast.parcel ? ' · '+escapeHtml(forecast.parcel) : ''}</div><label>kg / dönüm</label><input id="p3Yield" inputmode="decimal" placeholder="Örn. 500"><div class="p3-actions"><button class="p3-back" type="button" id="p3Prev">Geri</button><button class="primary" type="button" id="p3Next" style="margin-top:0">Devam</button></div>`;
      document.getElementById('p3Prev').onclick = () => {
        forecast.step = 1;
        renderForecast();
      };
      document.getElementById('p3Next').onclick = () => {
        const value = parseLocalNumber(document.getElementById('p3Yield').value);
        if (!(value > 0)) {
          toast('Tahmini verimi gir.');
          return;
        }
        forecast.yieldKg = value;
        forecast.step = 3;
        renderForecast();
      };
      return;
    }

    if (forecast.step === 3) {
      body.innerHTML = `<div class="p3-step">3 / 4</div><h2>Kilo başına tahmini fiyat?</h2><label>TL / kg</label><input id="p3Price" inputmode="decimal" placeholder="Örn. 35"><div class="p3-actions"><button class="p3-back" type="button" id="p3Prev">Geri</button><button class="primary" type="button" id="p3Next" style="margin-top:0">Hesapla</button></div>`;
      document.getElementById('p3Prev').onclick = () => {
        forecast.step = 2;
        renderForecast();
      };
      document.getElementById('p3Next').onclick = async () => {
        let price;
        try {
          price = parseMoney(document.getElementById('p3Price').value);
        } catch (error) {
          toast(error.message || 'Fiyatı kontrol et.');
          return;
        }
        forecast.priceKurus = price;
        app.parcelAreas[parcelKey(forecast.crop, forecast.parcel)] = forecast.area;
        await save();
        forecast.step = 4;
        renderForecast();
      };
      return;
    }

    let revenue;
    try {
      revenue = Core.forecastRevenueKurus(forecast.area, forecast.yieldKg, forecast.priceKurus);
    } catch {
      toast('Tahmin hesaplanamadı.');
      forecast.step = 3;
      renderForecast();
      return;
    }
    const expenses = Core.actualExpenseKurus(app.transactions, forecast.crop, forecast.parcel, effective);
    const profit = revenue - expenses;
    body.innerHTML = `<div class="p3-step">4 / 4</div><h2>Tahmini hasat geliri</h2><div class="p3-result">${money(revenue)}</div><div class="kpi"><span>Şu ana kadarki gerçek gider</span><b>${money(expenses)}</b></div><div class="kpi"><span>Tahmini kâr</span><b class="${profit>=0?'in':'out'}">${money(profit)}</b></div><div class="p3-disclaimer"><b>Bu bir tahmindir.</b> Deftere gelir olarak eklenmez ve gerçek kâr/zarar toplamını değiştirmez.</div><div class="p3-actions"><button class="p3-back" type="button" id="p3Again">Yeniden hesapla</button><button class="primary" type="button" id="p3Done" style="margin-top:0">Ana sayfa</button></div>`;
    document.getElementById('p3Again').onclick = () => {
      forecast.step = 1;
      renderForecast();
    };
    document.getElementById('p3Done').onclick = () => showPage('home');
  }

  function parseLocalNumber(raw) {
    const normalized = String(raw || '').trim().replace(/\s+/g, '').replace(',', '.');
    const value = Number(normalized);
    return Number.isFinite(value) ? value : NaN;
  }

  const originalRenderAll = window.renderAll;
  if (typeof originalRenderAll === 'function') {
    window.renderAll = function () {
      originalRenderAll();
      if (ledgerMode === 'category') renderLedgerMode();
      const currentStatus = document.getElementById('storageStatus');
      if (currentStatus) currentStatus.textContent = 'İnternetsiz çalışır';
    };
  }

  renderLedgerMode();
})();