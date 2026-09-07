declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");

import {
  previousCreateTransactionStep,
  previousEditTransactionStep,
  previousOnboardingStep
} from "../src/application/wizardBack";

test("onboarding Android geri tuşu wizard içinde önceki adıma döner", () => {
  assert.equal(previousOnboardingStep("welcome"), "exit");
  assert.equal(previousOnboardingStep("name"), "welcome");
  assert.equal(previousOnboardingStep("phone"), "name");
  assert.equal(previousOnboardingStep("place"), "phone");
  assert.equal(previousOnboardingStep("area"), "place");
  assert.equal(previousOnboardingStep("crops"), "area");
});

test("yeni kayıt Android geri tuşu wizard içinde önceki adıma döner", () => {
  assert.equal(previousCreateTransactionStep("amount", 1), "exit");
  assert.equal(previousCreateTransactionStep("crop", 2), "amount");
  assert.equal(previousCreateTransactionStep("category", 1), "amount");
  assert.equal(previousCreateTransactionStep("category", 2), "crop");
  assert.equal(previousCreateTransactionStep("done", 2), "home");
});

test("kayıt düzeltme Android geri tuşu wizard içinde önceki adıma döner", () => {
  assert.equal(previousEditTransactionStep("details"), "exit");
  assert.equal(previousEditTransactionStep("scope"), "details");
  assert.equal(previousEditTransactionStep("category"), "scope");
  assert.equal(previousEditTransactionStep("done"), "home");
});
