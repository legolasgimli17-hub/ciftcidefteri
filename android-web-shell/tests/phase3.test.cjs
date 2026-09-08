'use strict';
const assert = require('node:assert/strict');
const core = require('../app/src/main/assets/phase3-core.js');

const local = new Date(2026, 8, 9, 1, 17, 0);
assert.equal(core.localDateISO(local), '2026-09-09');
assert.equal(core.shiftLocalDaysISO(local, -1), '2026-09-08');
assert.equal(core.forecastRevenueKurus(10, 500, 3500), 17_500_000);

const tx = [
  { id: '1', type: 'expense', category: 'Mazot', crop: 'Pamuk', parcel: 'A', amount: 10000 },
  { id: '2', type: 'expense', category: 'Mazot', crop: 'Pamuk', parcel: 'A', amount: 25000 },
  { id: '3', type: 'expense', category: 'Gübre', crop: 'Pamuk', parcel: 'B', amount: 40000 },
  { id: '4', type: 'income', category: 'Ürün satışı', crop: 'Pamuk', parcel: 'A', amount: 90000 }
];
const groups = core.groupByCategory(tx, x => x.amount);
assert.equal(groups.find(g => g.category === 'Mazot').total, 35000);
assert.equal(core.actualExpenseKurus(tx, 'Pamuk', 'A', x => x.amount), 35000);
assert.equal(core.actualExpenseKurus(tx, 'Pamuk', '', x => x.amount), 75000);
console.log('phase3 tests: 7 assertions passed');
