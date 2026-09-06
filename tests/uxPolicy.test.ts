declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");

import { stepAfterAmount } from "../src/application/transactionFlow";
import { uxPolicy } from "../src/ui/policy";

test("ana dokunma alanları firstprompt 48px sınırının altına düşmez", () => {
  assert.ok(uxPolicy.standardControlHeightPx >= uxPolicy.minimumTouchTargetPx);
  assert.ok(uxPolicy.primaryActionHeightPx >= uxPolicy.minimumTouchTargetPx);
});

test("tek ürünlü çiftçi gelir-gider kaydında gereksiz ürün adımı görmez", () => {
  assert.equal(stepAfterAmount(1), "category");
  assert.equal(stepAfterAmount(2), "crop");
});
