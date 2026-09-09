declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");

import { assessMarketFreshness } from "../src/application/marketFreshness";
import { parseMarketFeed, parseMarketObservation } from "../src/domain/market";

const validObservation = {
  id: "gtb-wheat-2026-09-09",
  category: "crop",
  productCode: "wheat",
  productName: "Ekmeklik buğday",
  variant: "1. grup",
  price: {
    unit: "TRY_KG",
    minKurus: 1720,
    maxKurus: 1750,
    averageKurus: 1735
  },
  source: {
    id: "GTB",
    name: "Gaziantep Ticaret Borsası",
    official: true,
    observationDate: "2026-09-09",
    fetchedAt: "2026-09-09T17:00:00Z"
  },
  location: {
    city: "Gaziantep",
    market: "Gaziantep Ticaret Borsası"
  }
};

test("piyasa sözleşmesi fiyatı kuruş olarak doğrular", () => {
  const parsed = parseMarketObservation(validObservation);
  assert.equal(parsed.price.averageKurus, 1735);
  assert.equal(parsed.source.observationDate, "2026-09-09");
});

test("kaynak ve zaman bilgisi olmayan piyasa kaydı reddedilir", () => {
  const { source: _source, ...withoutSource } = validObservation;
  assert.throws(
    () => parseMarketObservation(withoutSource),
    /Kaynak bilgisi nesne olmalı/
  );
});

test("ondalıklı kuruş değeri reddedilir", () => {
  assert.throws(
    () => parseMarketObservation({
      ...validObservation,
      price: { ...validObservation.price, averageKurus: 1735.5 }
    }),
    /tam sayı/
  );
});

test("minimum fiyat maksimumdan büyükse kayıt reddedilir", () => {
  assert.throws(
    () => parseMarketObservation({
      ...validObservation,
      price: { ...validObservation.price, minKurus: 1800, maxKurus: 1700 }
    }),
    /En düşük fiyat en yüksek fiyattan büyük olamaz/
  );
});

test("bilinmeyen birim fail-closed davranır", () => {
  assert.throws(
    () => parseMarketObservation({
      ...validObservation,
      price: { ...validObservation.price, unit: "TL_PER_KG" }
    }),
    /Tanınmayan piyasa fiyat birimi/
  );
});

test("feed sözleşmesi sürüm numarasıyla doğrulanır", () => {
  const feed = parseMarketFeed({ schemaVersion: 1, items: [validObservation] });
  assert.equal(feed.schemaVersion, 1);
  assert.equal(feed.items.length, 1);

  assert.throws(
    () => parseMarketFeed({ schemaVersion: 2, items: [validObservation] }),
    /Desteklenmeyen piyasa veri sürümü/
  );
});

test("aynı gün alınan güncel veri stale değildir", () => {
  const observation = parseMarketObservation(validObservation);
  assert.deepEqual(
    assessMarketFreshness(
      observation,
      { maxObservationAgeDays: 1, maxFetchAgeMinutes: 360 },
      { today: "2026-09-09", nowUtc: "2026-09-09T19:00:00Z" }
    ),
    {
      stale: false,
      observationAgeDays: 0,
      fetchAgeMinutes: 120,
      reasons: []
    }
  );
});

test("kaynak verisi yaşlıysa stale işaretlenir", () => {
  const observation = parseMarketObservation({
    ...validObservation,
    source: {
      ...validObservation.source,
      observationDate: "2026-09-06"
    }
  });

  const freshness = assessMarketFreshness(
    observation,
    { maxObservationAgeDays: 1, maxFetchAgeMinutes: 360 },
    { today: "2026-09-09", nowUtc: "2026-09-09T19:00:00Z" }
  );

  assert.equal(freshness.stale, true);
  assert.deepEqual(freshness.reasons, ["source-data-old"]);
});

test("önbellek yaşı sınırı aşılırsa stale işaretlenir", () => {
  const observation = parseMarketObservation(validObservation);
  const freshness = assessMarketFreshness(
    observation,
    { maxObservationAgeDays: 1, maxFetchAgeMinutes: 60 },
    { today: "2026-09-09", nowUtc: "2026-09-09T19:00:00Z" }
  );

  assert.equal(freshness.stale, true);
  assert.deepEqual(freshness.reasons, ["cached-response-old"]);
});

test("gelecek tarihli kaynak veya fetch zamanı kabul edilmez", () => {
  const observation = parseMarketObservation(validObservation);

  assert.throws(
    () => assessMarketFreshness(
      observation,
      { maxObservationAgeDays: 1, maxFetchAgeMinutes: 60 },
      { today: "2026-09-08", nowUtc: "2026-09-09T19:00:00Z" }
    ),
    /veri tarihi gelecekte olamaz/
  );

  assert.throws(
    () => assessMarketFreshness(
      observation,
      { maxObservationAgeDays: 1, maxFetchAgeMinutes: 60 },
      { today: "2026-09-09", nowUtc: "2026-09-09T16:00:00Z" }
    ),
    /alınma zamanı gelecekte olamaz/
  );
});
