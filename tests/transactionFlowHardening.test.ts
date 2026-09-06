declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");

import { transactionAmountFromInput, transactionKindFromRoute } from "../src/application/transactionFlow";

test("transaction route yalnız income veya expense kabul eder", () => {
  assert.equal(transactionKindFromRoute("income"), "income");
  assert.equal(transactionKindFromRoute("expense"), "expense");
  assert.equal(transactionKindFromRoute("other"), null);
  assert.equal(transactionKindFromRoute(undefined), null);
});

test("işlem tutarı kategori adımına geçmeden önce pozitif olmalı", () => {
  assert.equal(transactionAmountFromInput("1.234,56"), 123456);
  assert.throws(() => transactionAmountFromInput("0"), /sıfırdan büyük/);
  assert.throws(() => transactionAmountFromInput("abc"), /rakam/);
});
