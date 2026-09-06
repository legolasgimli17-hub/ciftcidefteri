declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");

import {
  PUBLIC_AGRICULTURAL_SUPPORT_CATEGORY,
  commonIncomeCategories,
  isTaxExemptPublicAgriculturalSupport
} from "../src/domain/categories";

test("kamu tarım desteği gelirde vergi istisnası olarak işaretlenir", () => {
  assert.equal(commonIncomeCategories.includes(PUBLIC_AGRICULTURAL_SUPPORT_CATEGORY), true);
  assert.equal(
    isTaxExemptPublicAgriculturalSupport("income", PUBLIC_AGRICULTURAL_SUPPORT_CATEGORY),
    true
  );
});

test("genel veya gider destek kategorileri otomatik vergi istisnası sayılmaz", () => {
  assert.equal(isTaxExemptPublicAgriculturalSupport("income", "Destekleme"), false);
  assert.equal(
    isTaxExemptPublicAgriculturalSupport("expense", PUBLIC_AGRICULTURAL_SUPPORT_CATEGORY),
    false
  );
  assert.equal(isTaxExemptPublicAgriculturalSupport("income", "Kooperatif desteği"), false);
});
