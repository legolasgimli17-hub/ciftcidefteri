declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");

import {
  PUBLIC_AGRICULTURAL_SUPPORT_CATEGORY,
  commonExpenseCategories,
  commonIncomeCategories,
  expenseGroupForCategory,
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

test("çiftçinin temel gider kalemleri hızlı seçimde bulunur", () => {
  for (const expected of [
    "Amele / işçilik",
    "Gübre",
    "İlaç",
    "Mazot",
    "Sulama / elektrik",
    "Biçer / hasat",
    "İcar / kira",
    "Tohum / fide",
    "Nakliye",
    "Tamir / bakım"
  ]) {
    assert.equal(commonExpenseCategories.includes(expected as never), true, expected);
  }
});

test("detaylı çiftçi dili raporda sabit gider grubuna iner", () => {
  assert.equal(expenseGroupForCategory("Azotlu gübre"), "fertilizer");
  assert.equal(expenseGroupForCategory("Çapa işçiliği"), "labor");
  assert.equal(expenseGroupForCategory("Biçerdöver kirası"), "harvest");
  assert.equal(expenseGroupForCategory("Elektrik"), "irrigation_energy");
  assert.equal(expenseGroupForCategory("Tarla kirası"), "rent");
  assert.equal(expenseGroupForCategory("Bilinmeyen özel masraf"), "other");
});
