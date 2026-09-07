import test from "node:test";
import assert from "node:assert/strict";
import { createExclusiveActionGate } from "../src/application/exclusiveActionGate";

test("exclusive action gate aynı anda yalnız bir işlem başlatır", () => {
  const gate = createExclusiveActionGate();

  assert.equal(gate.tryStart("delete:tx-1"), true);
  assert.equal(gate.isBusy(), true);
  assert.equal(gate.tryStart("restore:tx-2"), false);
});

test("yanlış anahtar çalışan işlemin kilidini açamaz", () => {
  const gate = createExclusiveActionGate();

  assert.equal(gate.tryStart("delete:tx-1"), true);
  gate.finish("delete:tx-2");

  assert.equal(gate.isBusy(), true);
  assert.equal(gate.tryStart("restore:tx-1"), false);
});

test("işlem bittiğinde gate yeni kullanıcı aksiyonuna izin verir", () => {
  const gate = createExclusiveActionGate();

  assert.equal(gate.tryStart("delete:tx-1"), true);
  gate.finish("delete:tx-1");

  assert.equal(gate.isBusy(), false);
  assert.equal(gate.tryStart("restore:tx-1"), true);
});

test("boş işlem anahtarı kabul edilmez", () => {
  const gate = createExclusiveActionGate();

  assert.equal(gate.tryStart("   "), false);
  assert.equal(gate.isBusy(), false);
});
