declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");

import { buildHomeSummary } from "../src/application/homeSummary";
import { moneyFromKurus } from "../src/domain/money";

test("ana ekran kârı teknik terim kullanmadan anlatır", () => {
  assert.deepEqual(buildHomeSummary({
    income: moneyFromKurus(50_000),
    expense: moneyFromKurus(20_000),
    net: moneyFromKurus(30_000),
    taxExemptSupportIncome: moneyFromKurus(0)
  }), {
    headline: "Elinde kalan",
    tone: "positive",
    netKurus: 30_000
  });
});

test("ana ekran zararı kısa ve anlaşılır anlatır", () => {
  assert.deepEqual(buildHomeSummary({
    income: moneyFromKurus(10_000),
    expense: moneyFromKurus(20_000),
    net: moneyFromKurus(-10_000),
    taxExemptSupportIncome: moneyFromKurus(0)
  }), {
    headline: "Şu an açık",
    tone: "negative",
    netKurus: -10_000
  });
});
