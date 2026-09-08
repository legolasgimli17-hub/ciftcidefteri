(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CiftciPhase4Core = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function finite(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  }

  function quickCalculate(a, b, op) {
    a = finite(a); b = finite(b);
    if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error('invalid_number');
    if (op === 'add') return a + b;
    if (op === 'subtract') return a - b;
    if (op === 'multiply') return a * b;
    if (op === 'divide') {
      if (b === 0) throw new Error('divide_by_zero');
      return a / b;
    }
    throw new Error('invalid_operation');
  }

  function fieldCost(areaDonum, costPerDonum) {
    const area = finite(areaDonum), cost = finite(costPerDonum);
    if (!(area >= 0) || !(cost >= 0)) throw new Error('invalid_number');
    return area * cost;
  }

  function saleValue(kilograms, pricePerKg) {
    const kg = finite(kilograms), price = finite(pricePerKg);
    if (!(kg >= 0) || !(price >= 0)) throw new Error('invalid_number');
    return kg * price;
  }

  function weatherWarnings(day) {
    if (!day || typeof day !== 'object') return [];
    const warnings = [];
    const min = finite(day.minTemp);
    const max = finite(day.maxTemp);
    const precipitation = finite(day.precipitation);
    const probability = finite(day.precipitationProbability);
    const gust = finite(day.windGust);
    if (Number.isFinite(min) && min <= 0) warnings.push({ type: 'frost', label: 'Don riski' });
    if (Number.isFinite(max) && max >= 38) warnings.push({ type: 'heat', label: 'Aşırı sıcak' });
    if ((Number.isFinite(precipitation) && precipitation >= 20) || (Number.isFinite(probability) && probability >= 80)) warnings.push({ type: 'rain', label: 'Yoğun yağış ihtimali' });
    if (Number.isFinite(gust) && gust >= 60) warnings.push({ type: 'wind', label: 'Kuvvetli rüzgâr' });
    return warnings;
  }

  function weatherLabel(code) {
    code = Number(code);
    if (code === 0) return 'Açık';
    if ([1,2].includes(code)) return 'Az bulutlu';
    if (code === 3) return 'Kapalı';
    if ([45,48].includes(code)) return 'Sisli';
    if ([51,53,55,56,57].includes(code)) return 'Çisenti';
    if ([61,63,65,66,67,80,81,82].includes(code)) return 'Yağmurlu';
    if ([71,73,75,77,85,86].includes(code)) return 'Karlı';
    if ([95,96,99].includes(code)) return 'Gök gürültülü';
    return 'Değişken';
  }

  function weatherIcon(code) {
    code = Number(code);
    if (code === 0) return '☀️';
    if ([1,2].includes(code)) return '🌤️';
    if (code === 3) return '☁️';
    if ([45,48].includes(code)) return '🌫️';
    if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) return '🌧️';
    if ([71,73,75,77,85,86].includes(code)) return '❄️';
    if ([95,96,99].includes(code)) return '⛈️';
    return '🌥️';
  }

  return { quickCalculate, fieldCost, saleValue, weatherWarnings, weatherLabel, weatherIcon };
});
