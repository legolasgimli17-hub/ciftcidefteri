(function () {
  'use strict';
  if (typeof window.effective !== 'function' && typeof window.eff === 'function') {
    window.effective = window.eff;
  }

  function localNumber(id) {
    const el = document.getElementById(id);
    const raw = el ? el.value : '';
    const s = String(raw || '').trim().replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  function text(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }
  function formatNumber(n) {
    return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n);
  }
  function formatTL(n) {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }).format(n);
  }

  window.calcP4Quick = function () {
    try {
      const op = document.getElementById('p4CalcOp')?.value || '';
      const result = CiftciPhase4Core.quickCalculate(localNumber('p4CalcA'), localNumber('p4CalcB'), op);
      text('p4CalcQuickResult', formatNumber(result));
    } catch (error) {
      toast(error.message === 'divide_by_zero' ? 'Sıfıra bölme yapılamaz.' : 'Sayıları kontrol et.');
    }
  };
  window.calcP4Field = function () {
    try {
      text('p4FieldResult', formatTL(CiftciPhase4Core.fieldCost(localNumber('p4Area'), localNumber('p4AreaCost'))));
    } catch { toast('Dönüm ve tutarı kontrol et.'); }
  };
  window.calcP4Sale = function () {
    try {
      text('p4SaleResult', formatTL(CiftciPhase4Core.saleValue(localNumber('p4Kg'), localNumber('p4KgPrice'))));
    } catch { toast('Kg ve fiyatı kontrol et.'); }
  };
})();
