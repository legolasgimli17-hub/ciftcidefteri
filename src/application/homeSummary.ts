import { type MoneyKurus } from "../domain/money";
import { type ProfitLossSummary } from "../domain/profitLoss";

export interface HomeSummary {
  readonly headline: string;
  readonly tone: "positive" | "negative" | "neutral";
  readonly netKurus: MoneyKurus;
}

export function buildHomeSummary(summary: ProfitLossSummary): HomeSummary {
  if (summary.net > 0) {
    return { headline: "Elinde kalan", tone: "positive", netKurus: summary.net };
  }
  if (summary.net < 0) {
    return { headline: "Şu an açık", tone: "negative", netKurus: summary.net };
  }
  return { headline: "Şu an dengede", tone: "neutral", netKurus: summary.net };
}
