(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CiftciPhase3Core = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function localDateISO(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) throw new Error('invalid_date');
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function shiftLocalDaysISO(date, days) {
    const d = date instanceof Date ? new Date(date.getTime()) : new Date(date);
    if (Number.isNaN(d.getTime()) || !Number.isInteger(days)) throw new Error('invalid_date_shift');
    d.setDate(d.getDate() + days);
    return localDateISO(d);
  }

  function forecastRevenueKurus(areaDonum, yieldKgPerDonum, priceKurusPerKg) {
    const area = Number(areaDonum);
    const yieldKg = Number(yieldKgPerDonum);
    const price = Number(priceKurusPerKg);
    if (!Number.isFinite(area) || area <= 0) throw new Error('invalid_area');
    if (!Number.isFinite(yieldKg) || yieldKg <= 0) throw new Error('invalid_yield');
    if (!Number.isSafeInteger(price) || price <= 0) throw new Error('invalid_price');
    const result = Math.round(area * yieldKg * price);
    if (!Number.isSafeInteger(result) || result <= 0) throw new Error('forecast_out_of_range');
    return result;
  }

  function groupByCategory(transactions, effectiveAmount) {
    const groups = new Map();
    for (const tx of Array.isArray(transactions) ? transactions : []) {
      if (!tx || typeof tx.category !== 'string') continue;
      const amount = Number(effectiveAmount(tx));
      if (!Number.isSafeInteger(amount) || amount < 0) continue;
      if (!groups.has(tx.category)) groups.set(tx.category, { category: tx.category, total: 0, transactions: [] });
      const group = groups.get(tx.category);
      group.total += amount;
      group.transactions.push(tx);
    }
    return [...groups.values()].sort((a, b) => b.total - a.total || a.category.localeCompare(b.category, 'tr'));
  }

  function actualExpenseKurus(transactions, crop, parcel, effectiveAmount) {
    return (Array.isArray(transactions) ? transactions : []).reduce((sum, tx) => {
      if (!tx || tx.type !== 'expense' || tx.crop !== crop) return sum;
      if (parcel && tx.parcel !== parcel) return sum;
      const amount = Number(effectiveAmount(tx));
      return Number.isSafeInteger(amount) && amount >= 0 ? sum + amount : sum;
    }, 0);
  }

  return { localDateISO, shiftLocalDaysISO, forecastRevenueKurus, groupByCategory, actualExpenseKurus };
});