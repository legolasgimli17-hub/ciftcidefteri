import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { loadFarmIdentity, type FarmIdentity } from "@/src/application/appSnapshot";
import { createExclusiveActionGate } from "@/src/application/exclusiveActionGate";
import { createHistoryPageNavigation } from "@/src/application/historyPageNavigation";
import { LocalFarmRepository } from "@/src/application/localFarmRepository";
import {
  LocalTransactionHistory,
  type TransactionHistoryCursor,
  type TransactionHistoryPage
} from "@/src/application/transactionHistory";
import { LocalTransactionCorrections } from "@/src/application/transactionCorrections";
import { formatTry } from "@/src/domain/money";
import { type FarmTransaction } from "@/src/domain/transaction";
import { mobileDatabase } from "@/src/mobile/database";
import { dateInputFromIso } from "@/src/mobile/date";
import { Card, PageTitle, Screen, SecondaryButton } from "@/src/ui/components";
import { uxPolicy } from "@/src/ui/policy";
import { theme } from "@/src/ui/theme";

const PAGE_SIZE = 20;

export default function TransactionsScreen() {
  const sqlite = useSQLiteContext();
  const actionGateRef = useRef(createExclusiveActionGate());
  const pageNavigationRef = useRef(createHistoryPageNavigation());
  const [identity, setIdentity] = useState<FarmIdentity | null>(null);
  const [items, setItems] = useState<readonly FarmTransaction[]>([]);
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

  const applyPage = (page: TransactionHistoryPage) => {
    setItems(page.items);
    setNextCursor(page.nextCursor);
  };

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
        setNextCursor(undefined);
        router.replace("/onboarding");
        return;
      }
      const page = await readVisiblePage(loadedIdentity.farmId);
      setIdentity(loadedIdentity);
      applyPage(page);
    } catch {
      setError("Kayıtlarını şu an açamadık. Defterindeki bilgiler silinmedi.");
    } finally {
      setLoading(false);
    }
  }, [readVisiblePage, sqlite]);

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
      applyPage(await readVisiblePage(identity.farmId));
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
      applyPage(await readVisiblePage(identity.farmId));
    } catch {
      if (oldStart !== undefined) pageNavigationRef.current.moveOlder(oldStart);
      setCanGoNewer(pageNavigationRef.current.canGoNewer());
      setError("Daha yeni kayıtları açamadık. Tekrar deneyebilirsin.");
    } finally {
      setPaging(false);
    }
  };

  const reloadAfterCorrection = async (farmId: string) => {
    applyPage(await readVisiblePage(farmId));
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
      <PageTitle hint="Eski para girişlerini ve çıkışlarını burada bulabilirsin.">
        Tüm kayıtlar
      </PageTitle>

      <SecondaryButton label="Ana sayfaya dön" disabled={navigationBusy} onPress={() => router.replace("/home")} />

      {lastDeleted !== null ? (
        <Card>
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.undoTitle}>Kayıt silindi.</Text>
          <Text style={styles.muted}>{lastDeleted.category} · {formatTry(lastDeleted.amountKurus)}</Text>
          <SecondaryButton
            label={pendingActionKey?.startsWith("restore:") ? "Geri alınıyor…" : "Geri al"}
            disabled={navigationBusy}
            onPress={() => void restoreLastDeleted()}
          />
        </Card>
      ) : null}

      {canGoNewer ? (
        <SecondaryButton
          label={paging ? "Açılıyor…" : "Daha yeni kayıtları göster"}
          disabled={navigationBusy}
          onPress={() => void showNewer()}
        />
      ) : null}

      {loading && items.length === 0 ? <Text style={styles.muted}>Kayıtların hazırlanıyor…</Text> : null}

      {!loading && items.length === 0 && !error ? (
        <Card>
          <Text accessibilityRole="header" style={styles.cardTitle}>Henüz kayıt yok</Text>
          <Text style={styles.muted}>Para girişi veya çıkışı eklediğinde burada görünecek.</Text>
        </Card>
      ) : null}

      {items.length > 0 ? (
        <Card>
          {items.map((item) => {
            const deletingThis = pendingActionKey === `delete:${item.id}`;
            return (
              <View style={styles.transactionRow} key={item.id}>
                <View style={styles.transactionCopy}>
                  <Text style={styles.transactionCategory}>{item.category}</Text>
                  <Text style={styles.transactionDate}>{dateInputFromIso(item.occurredOn)}</Text>
                </View>
                <View style={styles.transactionActions}>
                  <Text style={item.kind === "income" ? styles.incomeText : styles.expenseText}>
                    {item.kind === "income" ? "+" : "−"}{formatTry(item.amountKurus)}
                  </Text>
                  <View style={styles.actionRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${item.category} kaydını düzelt`}
                      accessibilityState={{ disabled: navigationBusy }}
                      disabled={navigationBusy}
                      hitSlop={4}
                      onPress={() => editTransaction(item)}
                      style={[styles.actionButton, navigationBusy && styles.actionDisabled]}
                    >
                      <Text style={styles.editText}>Düzelt</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={deletingThis ? `${item.category} kaydı siliniyor` : `${item.category} kaydını sil`}
                      accessibilityState={{ disabled: navigationBusy }}
                      disabled={navigationBusy}
                      hitSlop={4}
                      onPress={() => askDelete(item)}
                      style={[styles.actionButton, navigationBusy && styles.actionDisabled]}
                    >
                      <Text style={styles.deleteText}>{deletingThis ? "Siliniyor…" : "Sil"}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
        </Card>
      ) : null}

      {nextCursor !== undefined ? (
        <SecondaryButton
          label={paging ? "Açılıyor…" : "Daha eski kayıtları göster"}
          disabled={navigationBusy}
          onPress={() => void showOlder()}
        />
      ) : null}

      {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: theme.color.text, fontSize: 20, fontWeight: "900" },
  muted: { color: theme.color.textMuted, fontSize: 16, fontWeight: "700", lineHeight: 23 },
  undoTitle: { color: theme.color.text, fontSize: 18, fontWeight: "900" },
  transactionRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 4
  },
  transactionCopy: { flex: 1 },
  transactionCategory: { color: theme.color.text, fontSize: 17, fontWeight: "800" },
  transactionDate: { color: theme.color.textMuted, fontSize: 14, marginTop: 3 },
  transactionActions: { alignItems: "flex-end", gap: 6 },
  incomeText: { color: theme.color.income, fontSize: 17, fontWeight: "800" },
  expenseText: { color: theme.color.expense, fontSize: 17, fontWeight: "800" },
  actionRow: { flexDirection: "row", gap: 4 },
  actionButton: {
    minWidth: uxPolicy.minimumTouchTargetPx,
    minHeight: uxPolicy.minimumTouchTargetPx,
    alignItems: "center",
    justifyContent: "center"
  },
  actionDisabled: { opacity: 0.45 },
  editText: { color: theme.color.primary, fontSize: 15, fontWeight: "800" },
  deleteText: { color: theme.color.expense, fontSize: 15, fontWeight: "800" },
  error: { color: theme.color.expense, fontSize: 16, fontWeight: "700", lineHeight: 22 }
});
