import { type FarmTransaction } from "./transaction";
import { addMoney, moneyFromKurus, subtractMoney, type MoneyKurus } from "./money";

export interface ProfitLossSummary {
  readonly income: MoneyKurus;
  readonly expense: MoneyKurus;
  readonly net: MoneyKurus;
  readonly taxExemptSupportIncome: MoneyKurus;
}

export interface ProfitLossTotalsInput {
  readonly incomeKurus: number;
  readonly expenseKurus: number;
  readonly taxExemptSupportIncomeKurus: number;
}

export function createProfitLossSummary(input: ProfitLossTotalsInput): ProfitLossSummary {
  const income = moneyFromKurus(input.incomeKurus);
  const expense = moneyFromKurus(input.expenseKurus);
  const taxExemptSupportIncome = moneyFromKurus(input.taxExemptSupportIncomeKurus);

  if (income < 0 || expense < 0 || taxExemptSupportIncome < 0) {
    throw new Error("Kâr/zarar toplamlarında negatif değer olamaz.");
  }
  if (taxExemptSupportIncome > income) {
    throw new Error("Destekleme geliri toplam gelirden büyük olamaz.");
  }

  return {
    income,
    expense,
    net: subtractMoney(income, expense),
    taxExemptSupportIncome
  };
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

  return createProfitLossSummary({
    incomeKurus: income,
    expenseKurus: expense,
    taxExemptSupportIncomeKurus: taxExemptSupportIncome
  });
}
