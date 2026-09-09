(function () {
  'use strict';
  if (window.__CDF_PHASE5__) return;
  window.__CDF_PHASE5__ = true;

  const Core = window.CiftciPhase5Core;
  if (!Core) throw new Error('phase5_core_missing');

  const getEff = (t) => {
    if (typeof window.eff === 'function') return window.eff(t);
    if (typeof window.effective === 'function') return window.effective(t);
    return t.ownership === 'partnership'
      ? Math.round(t.amount * (Number(t.share) || 0) / 100)
      : t.amount;
  };

  const H = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  const tl = (kurus) => typeof window.money === 'function'
    ? window.money(kurus)
    : new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format((Number(kurus) || 0) / 100);

  const formatTL = (amount) => new Intl.NumberFormat('tr-TR', {
    style: 'currency', currency: 'TRY', maximumFractionDigits: 0
  }).format(Number(amount) || 0);

  function ensurePhase5State() {
    if (!app.productHoldings || typeof app.productHoldings !== 'object') app.productHoldings = {};
    if (!app.marketOverrides || typeof app.marketOverrides !== 'object') app.marketOverrides = {};
  }
  ensurePhase5State();

  const style = document.createElement('style');
  style.textContent = `
    .p5-sectionTitle{display:flex;justify-content:space-between;align-items:end;gap:10px;margin:20px 2px 9px}
    .p5-sectionTitle h2{margin:0;font-size:21px}
    .p5-eyebrow{font-size:11px;font-weight:900;letter-spacing:.08em;color:var(--muted);text-transform:uppercase}
    .p5-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .p5-stat{background:#fff;border:1px solid var(--line);border-radius:18px;padding:15px;box-shadow:var(--shadow)}
    .p5-stat span{display:block;color:var(--muted);font-size:12px;font-weight:800}
    .p5-stat b{display:block;margin-top:5px;font-size:20px}
    .p5-farmCard{background:linear-gradient(160deg,#fff,#f7fbf8);border:1px solid #dbe8df;border-radius:20px;padding:16px;margin-top:10px}
    .p5-farmTop{display:flex;justify-content:space-between;gap:10px}
    .p5-farmName{font-size:17px;font-weight:950}
    .p5-mini{font-size:12px;color:var(--muted);margin-top:4px}
    .p5-bars{margin-top:12px}
    .p5-barRow{margin-top:12px}
    .p5-barRow:first-child{margin-top:0}
    .p5-barHead{display:flex;justify-content:space-between;font-size:12px;font-weight:850;gap:8px}
    .p5-barTrack{height:7px;background:#e9efeb;border-radius:999px;margin-top:5px;overflow:hidden}
    .p5-barFill{height:100%;background:var(--green);border-radius:999px}
    .p5-ledgerTools{display:grid;grid-template-columns:1fr 140px;gap:8px;margin-bottom:12px}
    .p5-ledgerTools input,.p5-ledgerTools select{margin:0}
    .p5-group{border:1px solid var(--line);border-radius:18px;overflow:hidden;margin-top:11px;background:#fff}
    .p5-groupHead{display:flex;justify-content:space-between;align-items:center;padding:14px 15px;background:#f7faf8;border-bottom:1px solid var(--line);gap:10px}
    .p5-groupTitle{font-weight:950}
    .p5-groupMeta{font-size:12px;color:var(--muted);margin-top:2px}
    .p5-record{display:grid;grid-template-columns:1fr auto;gap:10px;padding:13px 15px;border-bottom:1px solid var(--line)}
    .p5-record:last-child{border-bottom:0}
    .p5-edit{border:1px solid #b8d2c2;color:var(--green);background:#f5faf7;border-radius:11px;padding:8px 10px;font-weight:900}
    .p5-editBanner{background:#fff7e6;border:1px solid #ecd8aa;color:#76500e;padding:11px;border-radius:12px;margin-bottom:12px;font-weight:800}
    .p5-cancelEdit{width:100%;min-height:50px;margin-top:8px;border:1px solid var(--line);background:#fff;border-radius:14px;font-weight:850}
    .p5-marketHero{background:linear-gradient(145deg,#123d2d,#1f6b4d);color:#fff;border-radius:22px;padding:18px;margin-bottom:12px;box-shadow:0 14px 38px rgba(18,61,45,.18)}
    .p5-marketHero .big{font-size:28px;margin:3px 0}
    .p5-marketRow{display:grid;grid-template-columns:1.05fr .95fr;gap:10px;padding:13px 0;border-bottom:1px solid var(--line)}
    .p5-marketRow:last-child{border-bottom:0}
    .p5-price{font-weight:950;text-align:right}
    .p5-source{font-size:11px;color:var(--muted);line-height:1.35;margin-top:3px}
    .p5-holdingRow{display:grid;grid-template-columns:1fr auto;gap:10px;padding:12px 0;border-bottom:1px solid var(--line)}
    .p5-holdingRow:last-child{border-bottom:0}
    .p5-note{padding:11px 12px;background:#f6f8f6;border-radius:12px;color:var(--muted);font-size:12px;line-height:1.45;margin-bottom:8px}
    .p5-calcShell{background:#101612;border-radius:26px;padding:17px;color:#fff;box-shadow:0 16px 45px rgba(0,0,0,.16)}
    .p5-calcDisplay{height:100px;display:flex;align-items:end;justify-content:end;padding:10px 6px;font-size:42px;font-weight:500;overflow:hidden;word-break:break-all}
    .p5-calcTop{display:flex;justify-content:flex-end;margin-bottom:8px}
    .p5-backspace{border:0;background:transparent;color:#bfc8c2;font-size:20px;padding:6px 10px}
    .p5-keypad{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}
    .p5-key{aspect-ratio:1;border:0;border-radius:999px;background:#29302c;color:#fff;font-size:21px;font-weight:800}
    .p5-key.op{background:#2f7a58}
    .p5-key.util{background:#68716b}
    .p5-key.zero{grid-column:span 2;aspect-ratio:auto;border-radius:999px;text-align:left;padding-left:27px}
    .p5-quickCalc{margin-top:14px;border:1px solid var(--line);border-radius:18px;padding:15px;background:#fff}
    @media(max-width:420px){.p5-ledgerTools{grid-template-columns:1fr}.p5-calcDisplay{font-size:36px}.p5-marketRow{grid-template-columns:1fr auto}}
  `;
  document.head.appendChild(style);

  function allCrops() {
    const out = [];
    Object.values(crops || {}).forEach((list) => list.forEach((crop) => {
      if (!out.includes(crop)) out.push(crop);
    }));
    return out;
  }

  function seasonTransactions() {
    const year = String(new Date().getFullYear());
    return (app.transactions || []).filter((t) => String(t.date || '').startsWith(year));
  }

  function estimateHoldingsKurus() {
    ensurePhase5State();
    let totalTL = 0;
    for (const [crop, qty] of Object.entries(app.productHoldings)) {
      const value = Core.productValue(qty, Core.marketFor(crop), app.marketOverrides[crop]);
      if (value) totalTL += value.mid;
    }
    return Math.round(totalTL * 100);
  }

  function renderHomeEnhancements() {
    const home = document.getElementById('home');
    if (!home) return;
    let box = document.getElementById('p5Home');
    if (!box) {
      box = document.createElement('div');
      box.id = 'p5Home';
      const actions = home.querySelector('.actions');
      actions?.insertAdjacentElement('afterend', box);
    }

    const txs = seasonTransactions();
    const income = txs.filter((t) => t.type === 'income').reduce((sum, t) => sum + getEff(t), 0);
    const expense = txs.filter((t) => t.type === 'expense').reduce((sum, t) => sum + getEff(t), 0);
    const parcels = Core.parcelSummaries(txs, getEff);
    const top = Core.topExpenseCategories(txs, getEff, 3);
    const maxExpense = top.length ? top[0].total : 1;

    const parcelHtml = parcels.length
      ? `<div class="p5-sectionTitle"><div><div class="p5-eyebrow">Tarlalar</div><h2>Tarlalarım</h2></div></div>${parcels.slice(0, 4).map((p) => `
          <div class="p5-farmCard">
            <div class="p5-farmTop">
              <div><div class="p5-farmName">🌱 ${H(p.parcel)}</div><div class="p5-mini">${H(p.crop)} · ${p.count} kayıt · Son: ${H(p.lastCategory || '—')}</div></div>
              <b class="${p.result >= 0 ? 'in' : 'out'}">${tl(p.result)}</b>
            </div>
            <div class="p5-grid" style="margin-top:12px">
              <div><div class="p5-mini">Gelir</div><b>${tl(p.income)}</b></div>
              <div><div class="p5-mini">Masraf</div><b>${tl(p.expense)}</b></div>
            </div>
          </div>`).join('')}`
      : '';

    const topHtml = top.length
      ? `<div class="p5-sectionTitle"><div><div class="p5-eyebrow">Masraf dağılımı</div><h2>En çok nereye gidiyor?</h2></div></div>
         <div class="card p5-bars">${top.map((item) => `
           <div class="p5-barRow">
             <div class="p5-barHead"><span>${H(item.category)}</span><b>${tl(item.total)}</b></div>
             <div class="p5-barTrack"><div class="p5-barFill" style="width:${Math.max(6, Math.round(item.total / maxExpense * 100))}%"></div></div>
           </div>`).join('')}</div>`
      : '';

    box.innerHTML = `
      <div class="p5-sectionTitle"><div><div class="p5-eyebrow">${new Date().getFullYear()} sezonu</div><h2>Çiftliğin özeti</h2></div></div>
      <div class="p5-grid">
        <div class="p5-stat"><span>Sezon gideri</span><b class="out">${tl(expense)}</b></div>
        <div class="p5-stat"><span>Sezon sonucu</span><b class="${income - expense >= 0 ? 'in' : 'out'}">${tl(income - expense)}</b></div>
        <div class="p5-stat"><span>Kayıtlı tarla</span><b>${parcels.length}</b></div>
        <div class="p5-stat"><span>Ürün tahmini değer</span><b>${tl(estimateHoldingsKurus())}</b></div>
      </div>
      ${parcelHtml}
      ${topHtml}
    `;
  }

  let ledgerQuery = '';
  let ledgerCrop = 'all';

  function installLedger() {
    const rows = document.getElementById('ledgerRows');
    if (!rows) return;
    const oldSegment = document.getElementById('p3LedgerSegment');
    if (oldSegment) oldSegment.style.display = 'none';

    let tools = document.getElementById('p5LedgerTools');
    if (!tools) {
      tools = document.createElement('div');
      tools.id = 'p5LedgerTools';
      tools.className = 'p5-ledgerTools';
      tools.innerHTML = `
        <input id="p5LedgerSearch" placeholder="Kayıtlarda ara…">
        <select id="p5LedgerCrop"><option value="all">Tüm ürünler</option>${allCrops().map((crop) => `<option>${H(crop)}</option>`).join('')}</select>`;
      rows.insertAdjacentElement('beforebegin', tools);
      document.getElementById('p5LedgerSearch').addEventListener('input', (event) => {
        ledgerQuery = event.target.value.toLocaleLowerCase('tr');
        renderLedger();
      });
      document.getElementById('p5LedgerCrop').addEventListener('change', (event) => {
        ledgerCrop = event.target.value;
        renderLedger();
      });
    }
    renderLedger();
  }

  function filteredTransactions() {
    return (app.transactions || []).filter((t) => {
      if (ledgerCrop !== 'all' && t.crop !== ledgerCrop) return false;
      if (!ledgerQuery) return true;
      return [t.category, t.crop, t.parcel, t.note, t.date]
        .join(' ')
        .toLocaleLowerCase('tr')
        .includes(ledgerQuery);
    });
  }

  function recordRow(t) {
    return `<div class="p5-record">
      <div>
        <div class="title">${H(t.category)}</div>
        <div class="sub">${H([t.crop, t.parcel, fmtDate(t.date), t.note].filter(Boolean).join(' · '))}</div>
        <div class="amount ${t.type === 'income' ? 'in' : 'out'}" style="margin-top:5px">${t.type === 'income' ? '+' : '−'} ${tl(getEff(t))}</div>
      </div>
      <div><button class="p5-edit" type="button" data-id="${H(t.id)}" onclick="phase5EditTx(this.dataset.id)">Düzenle</button></div>
    </div>`;
  }

  function renderLedger() {
    const rows = document.getElementById('ledgerRows');
    if (!rows) return;
    const txs = filteredTransactions();
    if (!txs.length) {
      rows.innerHTML = '<div class="empty">Bu filtrede kayıt yok.</div>';
      return;
    }

    const expenseGroups = Core.groupExpenseSections(txs, getEff);
    const incomes = txs.filter((t) => t.type === 'income');
    const expensesHtml = expenseGroups.map((group) => `
      <section class="p5-group">
        <div class="p5-groupHead">
          <div><div class="p5-groupTitle">${H(group.category)}</div><div class="p5-groupMeta">${group.items.length} kayıt</div></div>
          <b class="out">${tl(group.total)}</b>
        </div>
        ${group.items.map(recordRow).join('')}
      </section>`).join('');

    const incomeHtml = incomes.length
      ? `<section class="p5-group">
          <div class="p5-groupHead">
            <div><div class="p5-groupTitle">Gelirler</div><div class="p5-groupMeta">${incomes.length} kayıt</div></div>
            <b class="in">${tl(incomes.reduce((sum, t) => sum + getEff(t), 0))}</b>
          </div>
          ${incomes.map(recordRow).join('')}
        </section>`
      : '';

    rows.innerHTML = expensesHtml + incomeHtml;
  }

  let editingId = null;

  function resetEditMode() {
    editingId = null;
    const saveButton = document.querySelector('#tx .primary');
    if (saveButton) {
      saveButton.textContent = 'Kaydet';
      saveButton.setAttribute('onclick', 'saveTx()');
    }
    document.getElementById('p5EditBanner')?.remove();
    document.getElementById('p5CancelEdit')?.remove();
  }

  window.phase5EditTx = function (txId) {
    const t = (app.transactions || []).find((item) => item.id === txId);
    if (!t) return;
    editingId = txId;
    showPage('tx');
    setTxType(t.type);

    document.getElementById('parcel').value = t.parcel || '';
    document.getElementById('cropGroup').value = t.cropGroup || 'Genel';
    fillCropItems();
    document.getElementById('cropItem').value = t.crop || document.getElementById('cropItem').value;
    document.getElementById('ownership').value = t.ownership || 'self';
    togglePartner();
    if (t.partnerId) document.getElementById('partnerSelect').value = t.partnerId;
    document.getElementById('txCategory').value = t.category || document.getElementById('txCategory').value;
    renderDetails();

    Object.entries(t.details || {}).forEach(([key, value]) => {
      const element = document.getElementById(key);
      if (element) element.value = value;
    });

    document.getElementById('txAmount').value = (t.amount / 100).toFixed(2).replace('.', ',');
    document.getElementById('txDate').value = t.date || today();
    document.getElementById('txStatus').value = t.status || 'paid';
    document.getElementById('txNote').value = t.note || '';

    const card = document.querySelector('#tx .card');
    if (card && !document.getElementById('p5EditBanner')) {
      const banner = document.createElement('div');
      banner.id = 'p5EditBanner';
      banner.className = 'p5-editBanner';
      banner.textContent = 'Bu kaydı düzenliyorsun. Kayıt kimliği ve geçmişi korunur.';
      card.insertBefore(banner, card.children[1] || null);
    }

    const saveButton = document.querySelector('#tx .primary');
    if (saveButton) {
      saveButton.textContent = 'Değişiklikleri kaydet';
      saveButton.setAttribute('onclick', 'phase5CommitEdit()');
      if (!document.getElementById('p5CancelEdit')) {
        const cancel = document.createElement('button');
        cancel.id = 'p5CancelEdit';
        cancel.type = 'button';
        cancel.className = 'p5-cancelEdit';
        cancel.textContent = 'Vazgeç';
        cancel.onclick = () => {
          resetEditMode();
          showPage('ledger');
        };
        saveButton.insertAdjacentElement('afterend', cancel);
      }
    }
    window.scrollTo(0, 0);
  };

  window.phase5CommitEdit = async function () {
    const t = (app.transactions || []).find((item) => item.id === editingId);
    if (!t) {
      toast('Kayıt bulunamadı');
      return;
    }

    let amount;
    try {
      amount = parseMoney(v('txAmount'));
    } catch (error) {
      toast(error.message);
      return;
    }

    let partnerId = null;
    let share = 100;
    if (v('ownership') === 'partnership') {
      partnerId = v('partnerSelect');
      const partner = app.partnerships.find((item) => item.id === partnerId);
      if (!partner) {
        toast('Ortaklık seç');
        return;
      }
      share = partner.share;
    }

    const detailValues = {};
    document.querySelectorAll('#txDetails input,#txDetails select').forEach((element) => {
      if (element.value !== '') detailValues[element.id] = element.value;
    });

    const selectedType = document.getElementById('segIn')?.classList.contains('on') ? 'income' : 'expense';
    Object.assign(t, {
      type: selectedType,
      amount,
      parcel: v('parcel').trim(),
      cropGroup: v('cropGroup'),
      crop: v('cropItem'),
      ownership: v('ownership'),
      partnerId,
      share,
      category: v('txCategory'),
      details: detailValues,
      status: v('txStatus'),
      date: v('txDate') || today(),
      note: v('txNote').trim(),
      updatedAt: Date.now()
    });

    await save();
    resetEditMode();
    render();
    renderLedger();
    showPage('ledger');
    toast('Kayıt güncellendi');
  };

  const originalOpenTx = window.openTx;
  if (typeof originalOpenTx === 'function') {
    window.openTx = function (type) {
      resetEditMode();
      return originalOpenTx(type);
    };
  }

  function installMoreTools() {
    const grid = document.querySelector('#more .menuGrid');
    if (!grid) return;

    [...grid.querySelectorAll('.menuBtn')].forEach((button) => {
      const text = button.textContent.trim();
      if (/^Banka/.test(text)) button.remove();
      if (button.id !== 'p5CalcBtn' && /Hesap makinesi/i.test(text)) button.remove();
      if (button.id !== 'p5MarketBtn' && /Piyasa|Ürün Değeri/i.test(text)) button.remove();
    });

    if (!document.getElementById('p5MarketBtn')) {
      const market = document.createElement('button');
      market.id = 'p5MarketBtn';
      market.className = 'menuBtn';
      market.innerHTML = '📈 Piyasa & Ürün Değeri<span>Referans fiyatlar ve elindeki ürün</span>';
      market.onclick = openMarket;
      grid.prepend(market);
    }

    if (!document.getElementById('p5CalcBtn')) {
      const calculator = document.createElement('button');
      calculator.id = 'p5CalcBtn';
      calculator.className = 'menuBtn';
      calculator.innerHTML = '🧮 Hesap Makinesi<span>Telefon tipi + tarla hesapları</span>';
      calculator.onclick = openCalculator;
      grid.prepend(calculator);
    }
  }

  const wrap = document.querySelector('.wrap');
  if (!document.getElementById('market')) {
    const marketPage = document.createElement('section');
    marketPage.id = 'market';
    marketPage.className = 'page';
    marketPage.innerHTML = '<div id="p5MarketBody"></div>';
    wrap.appendChild(marketPage);
  }
  if (!document.getElementById('calculator')) {
    const calculatorPage = document.createElement('section');
    calculatorPage.id = 'calculator';
    calculatorPage.className = 'page';
    calculatorPage.innerHTML = '<div id="p5CalcBody"></div>';
    wrap.appendChild(calculatorPage);
  }

  function priceText(entry) {
    if (!entry) return 'Referans yok';
    if (Number.isFinite(entry.ref)) return `${entry.ref.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} TL/${entry.unit}`;
    return `${entry.low.toLocaleString('tr-TR', { maximumFractionDigits: 3 })}–${entry.high.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} TL/${entry.unit}`;
  }

  function holdingValueText(crop, qty) {
    const value = Core.productValue(qty, Core.marketFor(crop), app.marketOverrides[crop]);
    if (!value) return 'Kendi fiyatını gir';
    if (Math.abs(value.low - value.high) < 0.001) return formatTL(value.mid);
    return `${formatTL(value.low)} – ${formatTL(value.high)}`;
  }

  function openMarket() {
    showPage('market');
    renderMarket();
  }

  function renderMarket() {
    ensurePhase5State();
    const body = document.getElementById('p5MarketBody');
    if (!body) return;

    let total = 0;
    for (const [crop, qty] of Object.entries(app.productHoldings)) {
      const value = Core.productValue(qty, Core.marketFor(crop), app.marketOverrides[crop]);
      if (value) total += value.mid;
    }
    const holdings = Object.entries(app.productHoldings).filter(([, qty]) => Number(qty) > 0);

    const holdingRows = holdings.length
      ? holdings.map(([crop, qty]) => {
          const reference = Core.marketFor(crop);
          const priceDescription = app.marketOverrides[crop]
            ? `Kendi fiyatın: ${Number(app.marketOverrides[crop]).toLocaleString('tr-TR')} TL/kg`
            : priceText(reference);
          return `<div class="p5-holdingRow">
            <div><div class="title">${H(crop)}</div><div class="sub">${Number(qty).toLocaleString('tr-TR')} kg · ${H(priceDescription)}</div></div>
            <div class="p5-price">${H(holdingValueText(crop, qty))}<br><button class="small" style="margin-top:6px" data-crop="${H(crop)}" onclick="phase5EditHolding(this.dataset.crop)">Düzenle</button></div>
          </div>`;
        }).join('')
      : '<div class="empty">Elindeki ürün miktarını ekleyince tahmini değeri burada görünür.</div>';

    const marketRows = Core.MARKET.map((entry) => `
      <div class="p5-marketRow">
        <div><div class="title">${H(entry.crop)}</div><div class="p5-source">${H(entry.kind)} · ${H(entry.source)} · ${H(entry.date.split('-').reverse().join('.'))}</div></div>
        <div class="p5-price">${H(priceText(entry))}</div>
      </div>`).join('');

    body.innerHTML = `
      <div class="p5-marketHero">
        <div class="p5-eyebrow" style="color:#cfe7d8">ELİNDEKİ ÜRÜNLER</div>
        <div class="big">${formatTL(total)}</div>
        <div style="opacity:.82;font-size:12px">Referans veya kendi fiyatına göre tahmini değer. Gerçek satış fiyatı ve muhasebe geliri değildir.</div>
      </div>
      <div class="card">
        <h2>Ürün miktarı ekle</h2>
        <label>Ürün</label>
        <select id="p5HoldCrop">${allCrops().map((crop) => `<option>${H(crop)}</option>`).join('')}</select>
        <div class="grid2">
          <div><label>Miktar (kg)</label><input id="p5HoldQty" inputmode="decimal" placeholder="Örn. 3500"></div>
          <div><label>Kendi tahmini fiyatın (TL/kg)</label><input id="p5HoldPrice" inputmode="decimal" placeholder="Boş bırakılabilir"></div>
        </div>
        <button class="primary" onclick="phase5SaveHolding()">Ürün değerine ekle</button>
      </div>
      <div class="card"><h2>Ürün değer tablosu</h2>${holdingRows}</div>
      <div class="card">
        <h2>Türkiye referans fiyatları</h2>
        <div class="p5-note">Fiyatlar bölge, kalite, çeşit ve teslim şekline göre değişebilir. Kaynak ve tarih her satırda gösterilir; satış garantisi değildir. Güncel güvenilir eşleşme olmayan üründe rakam uydurulmaz.</div>
        ${marketRows}
      </div>`;
  }

  window.phase5SaveHolding = async function () {
    ensurePhase5State();
    const crop = v('p5HoldCrop');
    const qty = Number(v('p5HoldQty').trim().replace(/\./g, '').replace(',', '.'));
    const priceRaw = v('p5HoldPrice').trim().replace(/\./g, '').replace(',', '.');
    const price = priceRaw ? Number(priceRaw) : null;
    if (!Number.isFinite(qty) || qty < 0) {
      toast('Geçerli miktar gir');
      return;
    }
    if (priceRaw && (!Number.isFinite(price) || price <= 0)) {
      toast('Fiyatı kontrol et');
      return;
    }
    app.productHoldings[crop] = qty;
    if (price) app.marketOverrides[crop] = price;
    else delete app.marketOverrides[crop];
    await save();
    renderMarket();
    renderHomeEnhancements();
    toast('Ürün değeri güncellendi');
  };

  window.phase5EditHolding = function (crop) {
    document.getElementById('p5HoldCrop').value = crop;
    document.getElementById('p5HoldQty').value = String(app.productHoldings[crop] ?? '').replace('.', ',');
    document.getElementById('p5HoldPrice').value = app.marketOverrides[crop]
      ? String(app.marketOverrides[crop]).replace('.', ',')
      : '';
    window.scrollTo(0, 0);
  };

  let calcState = Core.calcInitial();

  function parseLocalNumber(value) {
    const parsed = Number(String(value || '').trim().replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function openCalculator() {
    showPage('calculator');
    renderCalculator();
  }

  function renderCalculator() {
    const body = document.getElementById('p5CalcBody');
    if (!body) return;
    const keys = [
      ['C', 'util'], ['±', 'util'], ['%', 'util'], ['÷', 'op'],
      ['7', ''], ['8', ''], ['9', ''], ['×', 'op'],
      ['4', ''], ['5', ''], ['6', ''], ['−', 'op'],
      ['1', ''], ['2', ''], ['3', ''], ['+', 'op']
    ];
    const keyHtml = keys.map(([key, cls]) => `<button class="p5-key ${cls}" onclick="phase5CalcPress('${key}')">${key}</button>`).join('');

    body.innerHTML = `
      <div class="p5-calcShell">
        <div class="p5-calcTop"><button class="p5-backspace" onclick="phase5CalcPress('⌫')" aria-label="Son rakamı sil">⌫</button></div>
        <div id="p5CalcDisplay" class="p5-calcDisplay">${H(calcState.display)}</div>
        <div class="p5-keypad">
          ${keyHtml}
          <button class="p5-key zero" onclick="phase5CalcPress('0')">0</button>
          <button class="p5-key" onclick="phase5CalcPress(',')">,</button>
          <button class="p5-key op" onclick="phase5CalcPress('=')">=</button>
        </div>
      </div>
      <div class="p5-quickCalc">
        <h2>Tarla kısa hesapları</h2>
        <div class="grid2"><div><label>Dönüm</label><input id="p5Area" inputmode="decimal" placeholder="18"></div><div><label>TL / dönüm</label><input id="p5PerDa" inputmode="decimal" placeholder="1250"></div></div>
        <div id="p5AreaResult" class="calc">Toplam: ₺0,00</div>
        <div class="grid2"><div><label>Ürün (kg)</label><input id="p5Kg" inputmode="decimal" placeholder="3500"></div><div><label>TL / kg</label><input id="p5KgPrice" inputmode="decimal" placeholder="14,75"></div></div>
        <div id="p5SaleResult" class="calc">Satış: ₺0,00</div>
      </div>`;

    ['p5Area', 'p5PerDa'].forEach((id) => document.getElementById(id).addEventListener('input', () => {
      const total = parseLocalNumber(v('p5Area')) * parseLocalNumber(v('p5PerDa'));
      document.getElementById('p5AreaResult').textContent = `Toplam: ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(total || 0)}`;
    }));
    ['p5Kg', 'p5KgPrice'].forEach((id) => document.getElementById(id).addEventListener('input', () => {
      const total = parseLocalNumber(v('p5Kg')) * parseLocalNumber(v('p5KgPrice'));
      document.getElementById('p5SaleResult').textContent = `Satış: ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(total || 0)}`;
    }));
  }

  window.phase5CalcPress = function (key) {
    calcState = Core.calculatorPress(calcState, key);
    const display = document.getElementById('p5CalcDisplay');
    if (display) display.textContent = calcState.display;
  };

  const oldRender = window.render;
  if (typeof oldRender === 'function') {
    window.render = function () {
      oldRender();
      renderHomeEnhancements();
      installLedger();
      installMoreTools();
    };
  }

  const oldRenderAll = window.renderAll;
  if (typeof oldRenderAll === 'function' && oldRenderAll !== oldRender) {
    window.renderAll = function () {
      oldRenderAll();
      renderHomeEnhancements();
      installLedger();
      installMoreTools();
    };
  }

  installMoreTools();
  renderHomeEnhancements();
  installLedger();
})();
