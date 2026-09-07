declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");

import { MAX_SAFE_KURUS } from "../src/domain/money";
import { createFarmPartner } from "../src/domain/partner";
import {
  basisPointsFromPercent,
  createTransactionPartnership,
  ownerPartnerBalanceImpact,
  splitPartnershipAmount
} from "../src/domain/partnership";

test("50/50 ortaklık tek kuruş farkta bile işlem toplamını korur", () => {
  const split = splitPartnershipAmount(10_001, 5_000);
  assert.equal(split.ownerAmountKurus, 5_001);
  assert.equal(split.partnerAmountKurus, 5_000);
  assert.equal(split.ownerAmountKurus + split.partnerAmountKurus, 10_001);
});

test("ortaklık bölüşümü büyük güvenli tutarlarda kayan nokta kullanmadan çalışır", () => {
  const split = splitPartnershipAmount(MAX_SAFE_KURUS, 3_333);
  assert.equal(split.ownerAmountKurus + split.partnerAmountKurus, MAX_SAFE_KURUS);
  assert.equal(Number.isSafeInteger(split.ownerAmountKurus), true);
  assert.equal(Number.isSafeInteger(split.partnerAmountKurus), true);
});

test("gideri ben ödediysem ortağın payı alacağım olur", () => {
  const impact = ownerPartnerBalanceImpact({
    kind: "expense",
    amountKurus: 20_000,
    partnership: createTransactionPartnership({
      partnerId: "partner-0001",
      ownerShareBasisPoints: 5_000,
      cashActor: "owner"
    })
  });
  assert.equal(impact.receivableKurus, 10_000);
  assert.equal(impact.payableKurus, 0);
  assert.equal(impact.netKurus, 10_000);
});

test("gideri ortak ödediyse benim payım borcum olur", () => {
  const impact = ownerPartnerBalanceImpact({
    kind: "expense",
    amountKurus: 20_000,
    partnership: createTransactionPartnership({
      partnerId: "partner-0001",
      ownerShareBasisPoints: 7_000,
      cashActor: "partner"
    })
  });
  assert.equal(impact.receivableKurus, 0);
  assert.equal(impact.payableKurus, 14_000);
  assert.equal(impact.netKurus, -14_000);
});

test("gelir bana geldiyse ortağın payı ortağa borcum olur", () => {
  const impact = ownerPartnerBalanceImpact({
    kind: "income",
    amountKurus: 30_000,
    partnership: createTransactionPartnership({
      partnerId: "partner-0001",
      ownerShareBasisPoints: 6_000,
      cashActor: "owner"
    })
  });
  assert.equal(impact.receivableKurus, 0);
  assert.equal(impact.payableKurus, 12_000);
  assert.equal(impact.netKurus, -12_000);
});

test("gelir ortağa geldiyse benim payım ortaktan alacağım olur", () => {
  const impact = ownerPartnerBalanceImpact({
    kind: "income",
    amountKurus: 30_000,
    partnership: createTransactionPartnership({
      partnerId: "partner-0001",
      ownerShareBasisPoints: 6_000,
      cashActor: "partner"
    })
  });
  assert.equal(impact.receivableKurus, 18_000);
  assert.equal(impact.payableKurus, 0);
  assert.equal(impact.netKurus, 18_000);
});

test("yüzde girişi tam baz puana çevrilir", () => {
  assert.equal(basisPointsFromPercent(50), 5_000);
  assert.equal(basisPointsFromPercent(33.33), 3_333);
  assert.throws(() => basisPointsFromPercent(0), /0 ile 100/);
  assert.throws(() => basisPointsFromPercent(100), /0 ile 100/);
});

test("ortak adı sadeleştirilir ve gereksiz PII istemez", () => {
  assert.deepEqual(
    createFarmPartner({ id: "partner-0001", name: "  Mehmet   Kaya  " }),
    { id: "partner-0001", name: "Mehmet Kaya" }
  );
});
