import { assertIsoCalendarDate, assertIsoUtcTimestamp } from "../domain/date";
import { type MarketObservation } from "../domain/market";

export interface MarketFreshnessPolicy {
  readonly maxObservationAgeDays: number;
  readonly maxFetchAgeMinutes: number;
}

export type MarketFreshnessReason = "source-data-old" | "cached-response-old";

export interface MarketFreshness {
  readonly stale: boolean;
  readonly observationAgeDays: number;
  readonly fetchAgeMinutes: number;
  readonly reasons: readonly MarketFreshnessReason[];
}

export interface MarketFreshnessClock {
  readonly today: string;
  readonly nowUtc: string;
}

export function assessMarketFreshness(
  observation: MarketObservation,
  policy: MarketFreshnessPolicy,
  clock: MarketFreshnessClock
): MarketFreshness {
  assertPolicy(policy);
  assertIsoCalendarDate(clock.today);
  assertIsoUtcTimestamp(clock.nowUtc);

  const observationAgeDays = calendarDayDifference(observation.source.observationDate, clock.today);
  if (observationAgeDays < 0) {
    throw new Error("Piyasa veri tarihi gelecekte olamaz.");
  }

  const fetchAgeMinutes = minuteDifference(observation.source.fetchedAt, clock.nowUtc);
  if (fetchAgeMinutes < 0) {
    throw new Error("Piyasa verisinin alınma zamanı gelecekte olamaz.");
  }

  const reasons: MarketFreshnessReason[] = [];
  if (observationAgeDays > policy.maxObservationAgeDays) {
    reasons.push("source-data-old");
  }
  if (fetchAgeMinutes > policy.maxFetchAgeMinutes) {
    reasons.push("cached-response-old");
  }

  return {
    stale: reasons.length > 0,
    observationAgeDays,
    fetchAgeMinutes,
    reasons
  };
}

function assertPolicy(policy: MarketFreshnessPolicy): void {
  if (!Number.isSafeInteger(policy.maxObservationAgeDays) || policy.maxObservationAgeDays < 0) {
    throw new Error("Piyasa veri yaşı sınırı negatif olmayan tam gün olmalı.");
  }
  if (!Number.isSafeInteger(policy.maxFetchAgeMinutes) || policy.maxFetchAgeMinutes < 0) {
    throw new Error("Piyasa önbellek yaşı sınırı negatif olmayan tam dakika olmalı.");
  }
}

function calendarDayDifference(earlier: string, later: string): number {
  assertIsoCalendarDate(earlier);
  assertIsoCalendarDate(later);
  return Math.round(
    (Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86_400_000
  );
}

function minuteDifference(earlier: string, later: string): number {
  assertIsoUtcTimestamp(earlier);
  assertIsoUtcTimestamp(later);
  return Math.floor((Date.parse(later) - Date.parse(earlier)) / 60_000);
}
