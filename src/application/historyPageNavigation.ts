import { type TransactionHistoryCursor } from "./transactionHistory";

export interface HistoryPageNavigation {
  readonly currentStart: () => TransactionHistoryCursor | undefined;
  readonly canGoNewer: () => boolean;
  readonly moveOlder: (nextStart: TransactionHistoryCursor) => void;
  readonly moveNewer: () => void;
  readonly reset: () => void;
}

export function createHistoryPageNavigation(): HistoryPageNavigation {
  let current: TransactionHistoryCursor | null = null;
  const newerStarts: Array<TransactionHistoryCursor | null> = [];

  return {
    currentStart: () => current ?? undefined,
    canGoNewer: () => newerStarts.length > 0,
    moveOlder: (nextStart) => {
      newerStarts.push(current);
      current = nextStart;
    },
    moveNewer: () => {
      const previous = newerStarts.pop();
      if (previous === undefined) return;
      current = previous;
    },
    reset: () => {
      current = null;
      newerStarts.length = 0;
    }
  };
}
