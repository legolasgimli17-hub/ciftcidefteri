declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");

import { transactionKindFromRoute } from "../src/application/transactionFlow";

test("transaction route yalnız income veya expense kabul eder", () => {
  assert.equal(transactionKindFromRoute("income"), "income");
  assert.equal(transactionKindFromRoute("expense"), "expense");
  assert.equal(transactionKindFromRoute("other"), null);
  assert.equal(transactionKindFromRoute(undefined), null);
});
