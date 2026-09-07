declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");

import { createHistoryPageNavigation } from "../src/application/historyPageNavigation";
import { type TransactionHistoryCursor } from "../src/application/transactionHistory";

const CURSOR_1: TransactionHistoryCursor = {
  occurredOn: "2026-09-07",
  createdAt: "2026-09-07T10:01:00.000Z",
  id: "txn-history-page-0001"
};
const CURSOR_2: TransactionHistoryCursor = {
  occurredOn: "2026-09-06",
  createdAt: "2026-09-07T10:02:00.000Z",
  id: "txn-history-page-0002"
};

test("geçmiş gezintisi yalnız mevcut sayfa başlangıçlarını tutar ve yeni/eski arasında döner", () => {
  const navigation = createHistoryPageNavigation();
  assert.equal(navigation.currentStart(), undefined);
  assert.equal(navigation.canGoNewer(), false);

  navigation.moveOlder(CURSOR_1);
  assert.deepEqual(navigation.currentStart(), CURSOR_1);
  assert.equal(navigation.canGoNewer(), true);

  navigation.moveOlder(CURSOR_2);
  assert.deepEqual(navigation.currentStart(), CURSOR_2);

  navigation.moveNewer();
  assert.deepEqual(navigation.currentStart(), CURSOR_1);
  navigation.moveNewer();
  assert.equal(navigation.currentStart(), undefined);
  assert.equal(navigation.canGoNewer(), false);
});

test("ilk sayfada daha yeniye gitmek gezinti durumunu bozmaz", () => {
  const navigation = createHistoryPageNavigation();
  navigation.moveNewer();
  assert.equal(navigation.currentStart(), undefined);
  assert.equal(navigation.canGoNewer(), false);
});

test("reset geçmiş sayfa zincirini temizler", () => {
  const navigation = createHistoryPageNavigation();
  navigation.moveOlder(CURSOR_1);
  navigation.moveOlder(CURSOR_2);
  navigation.reset();

  assert.equal(navigation.currentStart(), undefined);
  assert.equal(navigation.canGoNewer(), false);
});
