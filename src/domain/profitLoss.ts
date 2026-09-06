import { type FarmTransaction } from "./transaction";
import { addMoney, moneyFromKurus, subtractMoney, type MoneyKurus } from "./money";

export interface ProfitLossSummary {
  readonly income: MoneyKurus;
  readonly expense: MoneyKurus;
  readonly net: MoneyKurus;
  readonly taxExemptSupportIncome: MoneyKurus;
}

export function summarizeProfitLoss(transactions: readonly FarmTransaction[]): ProfitLossSummary {
  let income = moneyFromKurus(0);
  let expense = moneyFromKurus(0);
  let taxExemptSupportIncome = moneyFromKurus(0);

  for (const transaction of transactions) {
    if (transaction.kind === "income") {
      income = addMoney(income, transaction.amountKurus);
      if (transaction.isTaxExemptSupport) {
        taxExemptSupportIncome = addMoney(taxExemptSupportIncome, transaction.amountKurus);
      }
    } else {
      expense = addMoney(expense, transaction.amountKurus);
    }
  }

  return {
    income,
    expense,
    net: subtractMoney(income, expense),
    taxExemptSupportIncome
  };
}
