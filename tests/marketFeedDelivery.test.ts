declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");

import {
  loadMarketFeed,
  MarketFeedUnavailableError,
  type MarketFeedCache,
  type MarketFetch,
  type MarketHttpResponse
} from "../src/application/marketFeedDelivery";

const observation = {
  id: "gtb-wheat-2026-09-09",
  category: "crop",
  productCode: "wheat",
  productName: "Ekmeklik buğday",
  price: { unit: "TRY_KG", minKurus: 1720, maxKurus: 1750, averageKurus: 1735 },
  source: {
    id: "GTB",
    name: "Gaziantep Ticaret Borsası",
    official: true,
    observationDate: "2026-09-09",
    fetchedAt: "2026-09-09T17:00:00Z"
  }
};
const feed = { schemaVersion: 1, items: [observation] };

function config(overrides: Record<string, unknown> = {}) {
  return {
    endpoint: "https://ekincep-data-api.vercel.app/api/market",
    allowedOrigins: ["https://ekincep-data-api.vercel.app"],
    timeoutMs: 5_000,
    maxResponseBytes: 64_000,
    freshnessPolicy: { maxObservationAgeDays: 1, maxFetchAgeMinutes: 360 },
    clock: { today: "2026-09-09", nowUtc: "2026-09-09T19:00:00Z" },
    ...overrides
  };
}

function response(body: unknown, overrides: { status?: number; contentType?: string; contentLength?: string } = {}): MarketHttpResponse {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  const headers = new Map<string, string>([
    ["content-type", overrides.contentType ?? "application/json; charset=utf-8"],
    ["content-length", overrides.contentLength ?? String(new TextEncoder().encode(text).byteLength)]
  ]);
  return {
    status: overrides.status ?? 200,
    headers: { get: name => headers.get(name.toLowerCase()) ?? null },
    text: async () => text
  };
}

function memoryCache(initial: unknown | null = null): MarketFeedCache & { writes: unknown[] } {
  let stored = initial;
  const writes: unknown[] = [];
  return {
    writes,
    read: async () => stored,
    write: async value => {
      writes.push(value);
      stored = value;
    }
  };
}

test("doğrulanmış ağ verisi current olarak teslim edilir ve önbelleğe yazılır", async () => {
  const cache = memoryCache();
  const fetch: MarketFetch = async () => response(feed);
  const result = await loadMarketFeed(config(), { fetch, cache });

  assert.equal(result.source, "network");
  assert.equal(result.items[0]?.state, "current");
  assert.equal(result.cacheSaved, true);
  assert.equal(cache.writes.length, 1);
});

test("ağ yoksa doğrulanmış son veri last-known olarak teslim edilir", async () => {
  const fetch: MarketFetch = async () => { throw new Error("offline"); };
  const result = await loadMarketFeed(config(), { fetch, cache: memoryCache(feed) });

  assert.equal(result.source, "cache");
  assert.equal(result.items[0]?.state, "last-known");
  assert.equal(result.cacheSaved, false);
});

test("eski kaynak verisi ağdan gelse bile stale işaretlenir", async () => {
  const oldFeed = {
    ...feed,
    items: [{ ...observation, source: { ...observation.source, observationDate: "2026-09-06" } }]
  };
  const result = await loadMarketFeed(config(), {
    fetch: async () => response(oldFeed),
    cache: memoryCache()
  });

  assert.equal(result.items[0]?.state, "stale");
  assert.deepEqual(result.items[0]?.freshness.reasons, ["source-data-old"]);
});

test("bozuk ağ yanıtı önbelleğe yazılmaz ve geçerli cache kullanılır", async () => {
  const cache = memoryCache(feed);
  const invalid = { schemaVersion: 1, items: [{ ...observation, source: undefined }] };
  const result = await loadMarketFeed(config(), {
    fetch: async () => response(invalid),
    cache
  });

  assert.equal(result.source, "cache");
  assert.equal(cache.writes.length, 0);
});

test("ağ ve önbellek birlikte bozuksa fail-closed davranır", async () => {
  await assert.rejects(
    () => loadMarketFeed(config(), {
      fetch: async () => response("not-json"),
      cache: memoryCache({ schemaVersion: 99, items: [] })
    }),
    MarketFeedUnavailableError
  );
});

test("JSON olmayan içerik kabul edilmez ve güvenli önbelleğe dönülür", async () => {
  const result = await loadMarketFeed(config(), {
    fetch: async () => response(feed, { contentType: "text/html" }),
    cache: memoryCache(feed)
  });
  assert.equal(result.source, "cache");
});

test("bildirilen veya gerçek yanıt boyutu sınırı aşamaz", async () => {
  const cached = memoryCache(feed);
  const announced = await loadMarketFeed(config({ maxResponseBytes: 50 }), {
    fetch: async () => response(feed, { contentLength: "999" }),
    cache: cached
  });
  assert.equal(announced.source, "cache");

  const actual = await loadMarketFeed(config({ maxResponseBytes: 50 }), {
    fetch: async () => response(feed, { contentLength: "1" }),
    cache: memoryCache(feed)
  });
  assert.equal(actual.source, "cache");
});

test("yalnız izin listesindeki HTTPS market endpoint çağrılabilir", async () => {
  let calls = 0;
  const fetch: MarketFetch = async () => { calls += 1; return response(feed); };

  await assert.rejects(
    () => loadMarketFeed(config({ endpoint: "http://ekincep-data-api.vercel.app/api/market" }), {
      fetch,
      cache: memoryCache(feed)
    }),
    /güvenli HTTPS/
  );
  await assert.rejects(
    () => loadMarketFeed(config({ endpoint: "https://evil.example/api/market" }), {
      fetch,
      cache: memoryCache(feed)
    }),
    /izin verilmiyor/
  );
  assert.equal(calls, 0);
});

test("endpoint query veya farklı yol ile genişletilemez", async () => {
  await assert.rejects(
    () => loadMarketFeed(config({ endpoint: "https://ekincep-data-api.vercel.app/api/market?target=evil" }), {
      fetch: async () => response(feed),
      cache: memoryCache(feed)
    }),
    /servis yolu/
  );
});

test("önbellek yazma hatası güncel ağ verisini kullanıcıdan saklamaz", async () => {
  const cache: MarketFeedCache = {
    read: async () => null,
    write: async () => { throw new Error("quota"); }
  };
  const result = await loadMarketFeed(config(), {
    fetch: async () => response(feed),
    cache
  });

  assert.equal(result.source, "network");
  assert.equal(result.cacheSaved, false);
  assert.equal(result.items[0]?.state, "current");
});
