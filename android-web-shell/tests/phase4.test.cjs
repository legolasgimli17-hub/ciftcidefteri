const assert = require('node:assert/strict');
const Core = require('../app/src/main/assets/phase4-core.js');

assert.equal(Core.quickCalculate(2, 3, 'add'), 5);
assert.equal(Core.quickCalculate(10, 4, 'subtract'), 6);
assert.equal(Core.quickCalculate(6, 7, 'multiply'), 42);
assert.equal(Core.quickCalculate(9, 3, 'divide'), 3);
assert.throws(() => Core.quickCalculate(9, 0, 'divide'), /divide_by_zero/);
assert.equal(Core.fieldCost(18, 1250), 22500);
assert.equal(Core.saleValue(3500, 14.75), 51625);

const edited = Core.updateTransaction(
  { id: 'tx-1', createdAt: 100, amount: 10000, category: 'Mazot' },
  { amount: 12500, category: 'Gübre' },
  200
);
assert.equal(edited.id, 'tx-1');
assert.equal(edited.createdAt, 100);
assert.equal(edited.amount, 12500);
assert.equal(edited.category, 'Gübre');
assert.equal(edited.updatedAt, 200);

const warnings = Core.weatherWarnings({
  minTemp: -1,
  maxTemp: 39,
  precipitation: 24,
  precipitationProbability: 85,
  windGust: 68
}).map(x => x.type).sort();
assert.deepEqual(warnings, ['frost','heat','rain','wind']);
assert.equal(Core.weatherLabel(0), 'Açık');
assert.equal(Core.weatherLabel(95), 'Gök gürültülü');
assert.equal(Core.weatherIcon(61), '🌧️');

console.log('Phase 4 tests: 16 assertions passed');
