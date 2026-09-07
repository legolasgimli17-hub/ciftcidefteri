declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");

import { buildProfileFromOnboarding, toggleCrop } from "../src/application/onboardingDraft";

test("ürün seçimi tekrar dokununca ürünü kaldırır", () => {
  assert.deepEqual(toggleCrop(["cotton"], "corn"), ["cotton", "corn"]);
  assert.deepEqual(toggleCrop(["cotton", "corn"], "cotton"), ["corn"]);
});

test("onboarding taslağı gereksiz telefon verisi toplamadan domain profil doğrulamasından geçer", () => {
  const profile = buildProfileFromOnboarding({
    id: "profile-1234",
    draft: {
      name: "Mehmet Kaya",
      province: "Diyarbakır",
      district: "Bismil",
      village: "Örnek",
      areaText: "12,5",
      areaUnit: "decare",
      cropCodes: ["cotton"],
      isCksRegistered: true
    }
  });
  assert.equal("phone" in profile, false);
  assert.equal(profile.totalAreaSquareMeters, 12_500);
  assert.deepEqual(profile.cropCodes, ["cotton"]);
});
