declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");

import { expenseSuggestionsFor } from "../src/domain/crops";
import { assertIsoCalendarDate } from "../src/domain/date";
import { squareMetersFromUserInput } from "../src/domain/landArea";
import { moneyFromLira, moneyFromUserInput } from "../src/domain/money";
import { createFarmerProfile } from "../src/domain/profile";
import { summarizeProfitLoss } from "../src/domain/profitLoss";
import { createFarmTransaction } from "../src/domain/transaction";

test("para ondalık kayan nokta yerine kuruş olarak saklanır", () => {
  assert.equal(moneyFromLira(0.1 + 0.2), 30);
});

test("Türkçe para girişi float kullanmadan doğru kuruşa çevrilir", () => {
  assert.equal(moneyFromUserInput("1.234,50"), 123_450);
  assert.equal(moneyFromUserInput("12,5"), 1_250);
  assert.equal(moneyFromUserInput("1 234,50 TL"), 123_450);
  assert.equal(moneyFromUserInput("12.50"), 1_250);
  assert.equal(moneyFromUserInput("1.234"), 123_400);
});

test("bozuk para girişleri reddedilir", () => {
  assert.throws(() => moneyFromUserInput("-10"));
  assert.throws(() => moneyFromUserInput("12,345"));
  assert.throws(() => moneyFromUserInput("1.23.45"));
  assert.throws(() => moneyFromUserInput("abc"));
});

test("pamuk çırçır masrafını önerir, fındık önermez", () => {
  assert.equal(expenseSuggestionsFor("cotton").includes("Çırçır masrafı"), true);
  assert.equal(expenseSuggestionsFor("hazelnut").includes("Çırçır masrafı"), false);
  assert.equal(expenseSuggestionsFor("hazelnut").includes("Budama işçiliği"), true);
});

test("takvim tarihi gerçekten doğrulanır", () => {
  assert.doesNotThrow(() => assertIsoCalendarDate("2028-02-29"));
  assert.throws(() => assertIsoCalendarDate("2026-02-29"));
  assert.throws(() => assertIsoCalendarDate("2026-99-99"));
  assert.throws(() => assertIsoCalendarDate("1999-12-31"));
});

test("dönüm ve dekar aynı m² tabanına güvenli çevrilir", () => {
  assert.equal(squareMetersFromUserInput("25,5", "decare"), 25_500);
  assert.equal(squareMetersFromUserInput("25.5", "donum"), 25_500);
  assert.equal(squareMetersFromUserInput("0,001", "decare"), 1);
});

test("çiftçi profili normalize edilir ve gereksiz telefon alanı içermez", () => {
  const profile = createFarmerProfile({
    id: "profile-0001",
    name: "  Mehmet   Kaya ",
    province: " Diyarbakır ",
    district: " Bismil ",
    village: " Örnek Köy ",
    totalAreaSquareMeters: squareMetersFromUserInput("120", "decare"),
    cropCodes: ["cotton", "corn", "cotton"],
    isCksRegistered: true
  });

  assert.equal(profile.name, "Mehmet Kaya");
  assert.equal("phone" in profile, false);
  assert.deepEqual(profile.cropCodes, ["cotton", "corn"]);
});

test("gelir-gider özeti kuruş bazında doğru hesaplanır", () => {
  const rows = [
    createFarmTransaction({
      id: "txn-income-001",
      kind: "income",
      amountKurus: 125_050,
      occurredOn: "2026-09-06",
      category: "Ürün satışı",
      cropCode: "cotton"
    }),
    createFarmTransaction({
      id: "txn-expense-001",
      kind: "expense",
      amountKurus: 25_025,
      occurredOn: "2026-09-06",
      category: "Mazot",
      cropCode: "cotton"
    })
  ];

  const result = summarizeProfitLoss(rows);
  assert.equal(result.income, 125_050);
  assert.equal(result.expense, 25_025);
  assert.equal(result.net, 100_025);
});

test("destekleme istisnası gider kaydına uygulanamaz", () => {
  assert.throws(() =>
    createFarmTransaction({
      id: "txn-invalid-001",
      kind: "expense",
      amountKurus: 1_000,
      occurredOn: "2026-09-06",
      category: "Hatalı",
      isTaxExemptSupport: true
    })
  );
});

test("sıfır veya negatif işlem reddedilir", () => {
  assert.throws(() =>
    createFarmTransaction({
      id: "txn-invalid-002",
      kind: "expense",
      amountKurus: 0,
      occurredOn: "2026-09-06",
      category: "Mazot"
    })
  );
});

import { buildTransactionFromDraft } from "../src/application/transactionDraft";

test("UI taslağındaki Türkçe tutar güvenli domain işlemine çevrilir", () => {
  const tx = buildTransactionFromDraft(
    {
      kind: "expense",
      amountText: "1.250,75 TL",
      occurredOn: "2026-09-06",
      category: "Gübre",
      cropCode: "cotton"
    },
    { nextTransactionId: () => "txn-draft-0001" }
  );
  assert.equal(tx.amountKurus, 125_075);
  assert.equal(tx.cropCode, "cotton");
});
