import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { loadFarmIdentity, type FarmIdentity } from "@/src/application/appSnapshot";
import { createExclusiveActionGate } from "@/src/application/exclusiveActionGate";
import { createHistoryPageNavigation } from "@/src/application/historyPageNavigation";
import { loadLedgerPartnershipDetails, type LedgerPartnershipDetail } from "@/src/application/ledgerDetails";
import { LocalFarmRepository } from "@/src/application/localFarmRepository";
import {
  LocalTransactionHistory,
  type TransactionHistoryCursor,
  type TransactionHistoryPage
} from "@/src/application/transactionHistory";
import { LocalTransactionCorrections } from "@/src/application/transactionCorrections";
import { cropTemplates } from "@/src/domain/crops";
import { formatTry } from "@/src/domain/money";
import { percentLabelFromBasisPoints } from "@/src/domain/partnership";
import { type FarmTransaction } from "@/src/domain/transaction";
import { mobileDatabase } from "@/src/mobile/database";
import { dateInputFromIso } from "@/src/mobile/date";
import { PageTitle, Screen, SecondaryButton, TopNav } from "@/src/ui/components";
import { uxPolicy } from "@/src/ui/policy";
import { theme } from "@/src/ui/theme";

const PAGE_SIZE = 20;

export default function TransactionsScreen() {
  const sqlite = useSQLiteContext();
  const actionGateRef = useRef(createExclusiveActionGate());
  const pageNavigationRef = useRef(createHistoryPageNavigation());
  const [identity, setIdentity] = useState<FarmIdentity | null>(null);
  const [items, setItems] = useState<readonly FarmTransaction[]>([]);
  const [partnershipDetails, setPartnershipDetails] = useState<ReadonlyMap<string, LedgerPartnershipDetail>>(new Map());
  const [nextCursor, setNextCursor] = useState<TransactionHistoryCursor>();
  const [canGoNewer, setCanGoNewer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState<string>();
  const [lastDeleted, setLastDeleted] = useState<FarmTransaction | null>(null);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);

  const readPage = useCallback(async (
    farmId: string,
    cursor: TransactionHistoryCursor | undefined
  ): Promise<TransactionHistoryPage> => {
    const history = new LocalTransactionHistory(mobileDatabase(sqlite));
    return cursor === undefined
      ? await history.page({ farmId, limit: PAGE_SIZE })
      : await history.page({ farmId, cursor, limit: PAGE_SIZE });
  }, [sqlite]);

  const readVisiblePage = useCallback(async (farmId: string): Promise<TransactionHistoryPage> => {
    let page = await readPage(farmId, pageNavigationRef.current.currentStart());

    while (page.items.length === 0 && pageNavigationRef.current.canGoNewer()) {
      pageNavigationRef.current.moveNewer();
      page = await readPage(farmId, pageNavigationRef.current.currentStart());
    }

    setCanGoNewer(pageNavigationRef.current.canGoNewer());
    return page;
  }, [readPage]);

  const applyPage = useCallback(async (farmId: string, page: TransactionHistoryPage) => {
    const details = await loadLedgerPartnershipDetails(
      mobileDatabase(sqlite),
      farmId,
      page.items.map((item) => item.id)
    );
    setItems(page.items);
    setPartnershipDetails(details);
    setNextCursor(page.nextCursor);
  }, [sqlite]);

  const loadCurrentPage = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const db = mobileDatabase(sqlite);
      const loadedIdentity = await loadFarmIdentity(db);
      if (loadedIdentity === null) {
        pageNavigationRef.current.reset();
        setCanGoNewer(false);
        setIdentity(null);
        setItems([]);
        setPartnershipDetails(new Map());
        setNextCursor(undefined);
        router.replace("/onboarding");
        return;
      }
      const page = await readVisiblePage(loadedIdentity.farmId);
      setIdentity(loadedIdentity);
      await applyPage(loadedIdentity.farmId, page);
    } catch {
      setError("Defterini şu an açamadık. Kayıtların silinmedi.");
    } finally {
      setLoading(false);
    }
  }, [applyPage, readVisiblePage, sqlite]);

  useFocusEffect(useCallback(() => {
    void loadCurrentPage();
  }, [loadCurrentPage]));

  const finishAction = (key: string) => {
    actionGateRef.current.finish(key);
    setPendingActionKey((current) => current === key ? null : current);
  };

  const showOlder = async () => {
    if (identity === null || nextCursor === undefined || paging || actionGateRef.current.isBusy()) return;

    pageNavigationRef.current.moveOlder(nextCursor);
    setCanGoNewer(true);
    setPaging(true);
    setError(undefined);
    try {
      await applyPage(identity.farmId, await readVisiblePage(identity.farmId));
    } catch {
      pageNavigationRef.current.moveNewer();
      setCanGoNewer(pageNavigationRef.current.canGoNewer());
      setError("Daha eski kayıtları açamadık. Tekrar deneyebilirsin.");
    } finally {
      setPaging(false);
    }
  };

  const showNewer = async () => {
    if (identity === null || !pageNavigationRef.current.canGoNewer() || paging || actionGateRef.current.isBusy()) return;

    const oldStart = pageNavigationRef.current.currentStart();
    pageNavigationRef.current.moveNewer();
    setCanGoNewer(pageNavigationRef.current.canGoNewer());
    setPaging(true);
    setError(undefined);
    try {
      await applyPage(identity.farmId, await readVisiblePage(identity.farmId));
    } catch {
      if (oldStart !== undefined) pageNavigationRef.current.moveOlder(oldStart);
      setCanGoNewer(pageNavigationRef.current.canGoNewer());
      setError("Daha yeni kayıtları açamadık. Tekrar deneyebilirsin.");
    } finally {
      setPaging(false);
    }
  };

  const reloadAfterCorrection = async (farmId: string) => {
    await applyPage(farmId, await readVisiblePage(farmId));
  };

  const deleteTransaction = async (item: FarmTransaction, farmId: string, actionKey: string) => {
    setError(undefined);
    try {
      const deleted = await new LocalFarmRepository(mobileDatabase(sqlite)).softDeleteTransaction({
        farmId,
        transactionId: item.id,
        nowIso: new Date().toISOString()
      });
      if (!deleted) {
        setError("Bu kayıt zaten silinmiş veya bulunamadı.");
        return;
      }
      setLastDeleted(item);
      await reloadAfterCorrection(farmId);
    } catch {
      setError("Kaydı silemedik. Diğer kayıtların güvende.");
    } finally {
      finishAction(actionKey);
    }
  };

  const askDelete = (item: FarmTransaction) => {
    if (identity === null) return;
    const actionKey = `delete:${item.id}`;
    if (!actionGateRef.current.tryStart(actionKey)) return;

    setPendingActionKey(actionKey);
    let deleteConfirmed = false;
    const releasePrompt = () => {
      if (!deleteConfirmed) finishAction(actionKey);
    };

    Alert.alert(
      "Bu kaydı silelim mi?",
      `${item.category} · ${formatTry(item.amountKurus)}`,
      [
        { text: "Vazgeç", style: "cancel", onPress: releasePrompt },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => {
            deleteConfirmed = true;
            void deleteTransaction(item, identity.farmId, actionKey);
          }
        }
      ],
      { cancelable: true, onDismiss: releasePrompt }
    );
  };

  const restoreLastDeleted = async () => {
    if (identity === null || lastDeleted === null) return;
    const actionKey = `restore:${lastDeleted.id}`;
    if (!actionGateRef.current.tryStart(actionKey)) return;

    setPendingActionKey(actionKey);
    setError(undefined);
    try {
      const restored = await new LocalTransactionCorrections(mobileDatabase(sqlite)).restoreTransaction({
        farmId: identity.farmId,
        transactionId: lastDeleted.id,
        nowIso: new Date().toISOString()
      });
      if (!restored) {
        setLastDeleted(null);
        setError("Bu kayıt geri alınamadı. Listeyi yenileyip tekrar deneyebilirsin.");
        return;
      }
      setLastDeleted(null);
      await reloadAfterCorrection(identity.farmId);
    } catch {
      setError("Kaydı geri alamadık. Diğer kayıtların güvende.");
    } finally {
      finishAction(actionKey);
    }
  };

  const editTransaction = (item: FarmTransaction) => {
    if (actionGateRef.current.isBusy() || paging) return;
    router.push({ pathname: "/transaction-edit", params: { id: item.id, returnTo: "transactions" } });
  };

  const busy = pendingActionKey !== null;
  const navigationBusy = busy || paging;

  return (
    <Screen>
      <PageTitle hint="Tarihli tüm gelir ve giderlerin.">Defter</PageTitle>

      <TopNav
        active="ledger"
        onLedger={() => router.replace("/home")}
        onCrops={() => router.replace("/crop-profit")}
        onPartners={() => router.replace("/partners")}
      />

      {lastDeleted !== null ? (
        <View style={styles.undo}>
          <View style={styles.undoCopy}>
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.undoTitle}>Kayıt silindi</Text>
            <Text style={styles.muted}>{lastDeleted.category} · {formatTry(lastDeleted.amountKurus)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Silinen kaydı geri al"
            disabled={navigationBusy}
            onPress={() => void restoreLastDeleted()}
            style={styles.undoButton}
          >
            <Text style={styles.undoButtonText}>{pendingActionKey?.startsWith("restore:") ? "Alınıyor…" : "Geri al"}</Text>
          </Pressable>
        </View>
      ) : null}

      {canGoNewer ? (
        <SecondaryButton
          label={paging ? "Açılıyor…" : "Daha yeni kayıtlar"}
          disabled={navigationBusy}
          onPress={() => void showNewer()}
        />
      ) : null}

      {loading && items.length === 0 ? <Text style={styles.muted}>Defter hazırlanıyor…</Text> : null}

      {!loading && items.length === 0 && !error ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Defterin boş</Text>
          <Text style={styles.muted}>Gider veya gelir eklediğinde burada görünür.</Text>
        </View>
      ) : null}

      {items.length > 0 ? (
        <View style={styles.list}>
          {items.map((item, index) => {
            const detail = partnershipDetails.get(item.id);
            const deletingThis = pendingActionKey === `delete:${item.id}`;
            return (
              <View key={item.id} style={[styles.row, index > 0 && styles.divider]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.category} kaydını aç`}
                  accessibilityState={{ disabled: navigationBusy }}
                  disabled={navigationBusy}
                  onPress={() => editTransaction(item)}
                  style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
                >
                  <View style={styles.copy}>
                    <Text style={styles.category}>{item.category}</Text>
                    <Text style={styles.meta}>
                      {dateInputFromIso(item.occurredOn)}
                      {item.cropCode ? ` · ${cropTemplates[item.cropCode].label}` : " · Genel"}
                    </Text>
                    {item.note ? <Text numberOfLines={2} style={styles.note}>{item.note}</Text> : null}
                    {detail ? (
                      <Text numberOfLines={2} style={styles.partnership}>
                        {detail.partnerName} · {percentLabelFromBasisPoints(detail.ownerShareBasisPoints)}/{percentLabelFromBasisPoints(detail.partnerShareBasisPoints)} · {cashActorLabel(item, detail)}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={item.kind === "income" ? styles.incomeText : styles.expenseText}>
                    {item.kind === "income" ? "+" : "−"}{formatTry(item.amountKurus)}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={deletingThis ? `${item.category} kaydı siliniyor` : `${item.category} kaydını sil`}
                  accessibilityState={{ disabled: navigationBusy }}
                  disabled={navigationBusy}
                  onPress={() => askDelete(item)}
                  style={styles.deleteButton}
                >
                  <Text style={styles.deleteText}>{deletingThis ? "…" : "Sil"}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      {nextCursor !== undefined ? (
        <SecondaryButton
          label={paging ? "Açılıyor…" : "Daha eski kayıtlar"}
          disabled={navigationBusy}
          onPress={() => void showOlder()}
        />
      ) : null}

      {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

function cashActorLabel(item: FarmTransaction, detail: LedgerPartnershipDetail): string {
  if (item.kind === "expense") return detail.cashActor === "owner" ? "Sen ödedin" : "Ortak ödedi";
  return detail.cashActor === "owner" ? "Para sana geldi" : "Para ortağa geldi";
}

const styles = StyleSheet.create({
  muted: { color: theme.color.textMuted, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  undo: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.divider
  },
  undoCopy: { flex: 1, gap: 2 },
  undoTitle: { color: theme.color.text, fontSize: 15, fontWeight: "800" },
  undoButton: { minWidth: 72, minHeight: uxPolicy.minimumTouchTargetPx, alignItems: "center", justifyContent: "center" },
  undoButtonText: { color: theme.color.primary, fontSize: 14, fontWeight: "800" },
  empty: { minHeight: 140, justifyContent: "center", gap: 5, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.color.divider },
  emptyTitle: { color: theme.color.text, fontSize: 18, fontWeight: "900" },
  list: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.color.divider },
  row: { flexDirection: "row", alignItems: "stretch", gap: 4, minHeight: 84 },
  divider: { borderTopWidth: 1, borderTopColor: theme.color.divider },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
  pressed: { opacity: 0.6 },
  copy: { flex: 1, gap: 3 },
  category: { color: theme.color.text, fontSize: 16, fontWeight: "800" },
  meta: { color: theme.color.textMuted, fontSize: 12, fontWeight: "600" },
  note: { color: theme.color.textSubtle, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  partnership: { color: theme.color.primary, fontSize: 12, fontWeight: "700", lineHeight: 17 },
  incomeText: { color: theme.color.income, fontSize: 16, fontWeight: "900" },
  expenseText: { color: theme.color.expense, fontSize: 16, fontWeight: "900" },
  deleteButton: { minWidth: 52, minHeight: uxPolicy.minimumTouchTargetPx, alignItems: "center", justifyContent: "center" },
  deleteText: { color: theme.color.expense, fontSize: 12, fontWeight: "700" },
  error: { color: theme.color.expense, fontSize: 15, fontWeight: "700", lineHeight: 22 }
});
