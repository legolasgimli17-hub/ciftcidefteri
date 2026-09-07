declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");

import { basisPointsFromUserInput, percentLabelFromBasisPoints } from "../src/domain/partnership";

test("ortaklık yüzdesi Türkçe virgül ve nokta girişini kesin basis pointe çevirir", () => {
  assert.equal(basisPointsFromUserInput("50"), 5000);
  assert.equal(basisPointsFromUserInput("50,5"), 5050);
  assert.equal(basisPointsFromUserInput("33.33"), 3333);
  assert.equal(basisPointsFromUserInput("0,25"), 25);
});

test("sıfır, yüzde yüz ve belirsiz yüzde biçimleri reddedilir", () => {
  assert.throws(() => basisPointsFromUserInput("0"), /0 ile 100/);
  assert.throws(() => basisPointsFromUserInput("100"), /yüzde/);
  assert.throws(() => basisPointsFromUserInput("50,555"), /yüzde/);
  assert.throws(() => basisPointsFromUserInput("elli"), /yüzde/);
});

test("basis point kullanıcıya Türkçe yüzde etiketi olarak gösterilir", () => {
  assert.equal(percentLabelFromBasisPoints(5000), "%50");
  assert.equal(percentLabelFromBasisPoints(5050), "%50,5");
  assert.equal(percentLabelFromBasisPoints(5005), "%50,05");
});
