const assert = require('node:assert/strict');
const Core = require('../app/src/main/assets/phase4-core.js');

assert.equal(Core.quickCalculate(2, 3, 'add'), 5);
assert.equal(Core.quickCalculate(10, 4, 'subtract'), 6);
assert.equal(Core.quickCalculate(6, 7, 'multiply'), 42);
assert.equal(Core.quickCalculate(9, 3, 'divide'), 3);
assert.throws(() => Core.quickCalculate(9, 0, 'divide'), /divide_by_zero/);
assert.equal(Core.fieldCost(18, 1250), 22500);
assert.equal(Core.saleValue(3500, 14.75), 51625);

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

console.log('Phase 4 tests: 11 assertions passed');
