import {
  parseMarketFeed,
  type MarketFeed,
  type MarketObservation
} from "../domain/market";
import {
  assessMarketFreshness,
  type MarketFreshness,
  type MarketFreshnessClock,
  type MarketFreshnessPolicy
} from "./marketFreshness";

export interface MarketFeedCache {
  read(): Promise<unknown | null>;
  write(feed: MarketFeed): Promise<void>;
}

export interface MarketHttpHeaders {
  get(name: string): string | null;
}

export interface MarketHttpResponse {
  readonly status: number;
  readonly headers: MarketHttpHeaders;
  text(): Promise<string>;
}

export type MarketFetch = (
  url: string,
  init: {
    readonly method: "GET";
    readonly headers: Readonly<Record<string, string>>;
    readonly signal: AbortSignal;
  }
) => Promise<MarketHttpResponse>;

export interface MarketFeedDeliveryConfig {
  readonly endpoint: string;
  readonly allowedOrigins: readonly string[];
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
  readonly freshnessPolicy: MarketFreshnessPolicy;
  readonly clock: MarketFreshnessClock;
}

export type MarketObservationState = "current" | "last-known" | "stale";

export interface DeliveredMarketObservation {
  readonly observation: MarketObservation;
  readonly freshness: MarketFreshness;
  readonly state: MarketObservationState;
}

export interface DeliveredMarketFeed {
  readonly source: "network" | "cache";
  readonly cacheSaved: boolean;
  readonly items: readonly DeliveredMarketObservation[];
}

export class MarketFeedUnavailableError extends Error {
  constructor() {
    super("Piyasa verisi şu anda kullanılamıyor.");
    this.name = "MarketFeedUnavailableError";
  }
}

export async function loadMarketFeed(
  config: MarketFeedDeliveryConfig,
  dependencies: { readonly fetch: MarketFetch; readonly cache: MarketFeedCache }
): Promise<DeliveredMarketFeed> {
  const endpoint = validateConfig(config);

  try {
    const feed = await requestMarketFeed(endpoint, config, dependencies.fetch);
    const delivered = deliver(feed, "network", config);
    let cacheSaved = true;
    try {
      await dependencies.cache.write(feed);
    } catch {
      cacheSaved = false;
    }
    return { ...delivered, cacheSaved };
  } catch {
    const cached = await readValidatedCache(dependencies.cache);
    if (cached === null) throw new MarketFeedUnavailableError();
    try {
      return deliver(cached, "cache", config);
    } catch {
      throw new MarketFeedUnavailableError();
    }
  }
}

async function requestMarketFeed(
  endpoint: URL,
  config: MarketFeedDeliveryConfig,
  fetch: MarketFetch
): Promise<MarketFeed> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(endpoint.toString(), {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    if (response.status !== 200) throw new Error("market_http_status");

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("application/json")) throw new Error("market_content_type");

    const announcedLength = parseContentLength(response.headers.get("content-length"));
    if (announcedLength !== undefined && announcedLength > config.maxResponseBytes) {
      throw new Error("market_response_too_large");
    }

    const body = await response.text();
    if (new TextEncoder().encode(body).byteLength > config.maxResponseBytes) {
      throw new Error("market_response_too_large");
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(body) as unknown;
    } catch {
      throw new Error("market_invalid_json");
    }
    return parseMarketFeed(decoded);
  } finally {
    clearTimeout(timeout);
  }
}

async function readValidatedCache(cache: MarketFeedCache): Promise<MarketFeed | null> {
  try {
    const stored = await cache.read();
    return stored === null ? null : parseMarketFeed(stored);
  } catch {
    return null;
  }
}

function deliver(
  feed: MarketFeed,
  source: "network" | "cache",
  config: MarketFeedDeliveryConfig
): DeliveredMarketFeed {
  return {
    source,
    cacheSaved: source === "network",
    items: feed.items.map(observation => {
      const freshness = assessMarketFreshness(
        observation,
        config.freshnessPolicy,
        config.clock
      );
      return {
        observation,
        freshness,
        state: freshness.stale ? "stale" : source === "network" ? "current" : "last-known"
      };
    })
  };
}

function validateConfig(config: MarketFeedDeliveryConfig): URL {
  if (!Number.isSafeInteger(config.timeoutMs) || config.timeoutMs < 250 || config.timeoutMs > 30_000) {
    throw new Error("Piyasa isteği zaman sınırı 250-30000 ms arasında olmalı.");
  }
  if (
    !Number.isSafeInteger(config.maxResponseBytes) ||
    config.maxResponseBytes < 1 ||
    config.maxResponseBytes > 512_000
  ) {
    throw new Error("Piyasa yanıt boyutu güvenli sınırda olmalı.");
  }

  let endpoint: URL;
  try {
    endpoint = new URL(config.endpoint);
  } catch {
    throw new Error("Piyasa servis adresi geçersiz.");
  }
  if (endpoint.protocol !== "https:" || endpoint.username !== "" || endpoint.password !== "") {
    throw new Error("Piyasa servisi güvenli HTTPS adresi olmalı.");
  }
  if (endpoint.pathname !== "/api/market" || endpoint.search !== "" || endpoint.hash !== "") {
    throw new Error("Piyasa servis yolu izin verilen adresle eşleşmiyor.");
  }

  const allowedOrigins = config.allowedOrigins.map(normalizeAllowedOrigin);
  if (!allowedOrigins.includes(endpoint.origin)) {
    throw new Error("Piyasa servis adresine izin verilmiyor.");
  }
  return endpoint;
}

function normalizeAllowedOrigin(value: string): string {
  let origin: URL;
  try {
    origin = new URL(value);
  } catch {
    throw new Error("Piyasa servis izin listesi geçersiz.");
  }
  if (
    origin.protocol !== "https:" ||
    origin.username !== "" ||
    origin.password !== "" ||
    origin.pathname !== "/" ||
    origin.search !== "" ||
    origin.hash !== ""
  ) {
    throw new Error("Piyasa servis izin listesi yalnız HTTPS origin içermeli.");
  }
  return origin.origin;
}

function parseContentLength(value: string | null): number | undefined {
  if (value === null) return undefined;
  if (!/^\d+$/.test(value)) throw new Error("market_invalid_content_length");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error("market_invalid_content_length");
  return parsed;
}
