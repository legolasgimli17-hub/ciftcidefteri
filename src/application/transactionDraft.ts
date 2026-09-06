import { type CropCode } from "../domain/crops";
import { moneyFromUserInput } from "../domain/money";
import { createFarmTransaction, type FarmTransaction, type TransactionKind } from "../domain/transaction";

export interface TransactionDraft {
  readonly kind: TransactionKind;
  readonly amountText: string;
  readonly occurredOn: string;
  readonly category: string;
  readonly cropCode?: CropCode;
  readonly note?: string;
  readonly isTaxExemptSupport?: boolean;
}

export interface IdGenerator {
  nextTransactionId(): string;
}

export function buildTransactionFromDraft(draft: TransactionDraft, ids: IdGenerator): FarmTransaction {
  const amountKurus = moneyFromUserInput(draft.amountText);
  return createFarmTransaction({
    id: ids.nextTransactionId(),
    kind: draft.kind,
    amountKurus,
    occurredOn: draft.occurredOn,
    category: draft.category,
    ...(draft.cropCode === undefined ? {} : { cropCode: draft.cropCode }),
    ...(draft.note === undefined ? {} : { note: draft.note }),
    ...(draft.isTaxExemptSupport === undefined ? {} : { isTaxExemptSupport: draft.isTaxExemptSupport })
  });
}
