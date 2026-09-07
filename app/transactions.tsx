import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { loadFarmIdentity, type FarmIdentity } from "@/src/application/appSnapshot";
import { createExclusiveActionGate } from "@/src/application/exclusiveActionGate";
import { LocalFarmRepository } from "@/src/application/localFarmRepository";
import {
  LocalTransactionHistory,
  type TransactionHistoryCursor
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
  const [identity, setIdentity] = useState<FarmIdentity | null>(null);
  const [items, setItems] = useState<readonly FarmTransaction[]>([]);
  const [nextCursor, setNextCursor] = useState<TransactionHistoryCursor>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>();
  const [lastDeleted, setLastDeleted] = useState<FarmTransaction | null>(null);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const db = mobileDatabase(sqlite);
      const loadedIdentity = await loadFarmIdentity(db);
      if (loadedIdentity === null) {
        setIdentity(null);
        setItems([]);
        setNextCursor(undefined);
        router.replace("/onboarding");
        return;
      }
      const page = await new LocalTransactionHistory(db).page({
        farmId: loadedIdentity.farmId,
        limit: PAGE_SIZE
      });
      setIdentity(loadedIdentity);
      setItems(page.items);
      setNextCursor(page.nextCursor);
    } catch {
      setError("Kayıtlarını şu an açamadık. Defterindeki bilgiler silinmedi.");
    } finally {
      setLoading(false);
    }
  }, [sqlite]);

  useFocusEffect(useCallback(() => {
    void loadFirstPage();
  }, [loadFirstPage]));

  const finishAction = (key: string) => {
    actionGateRef.current.finish(key);
    setPendingActionKey((current) => current === key ? null : current);
  };

  const loadMore = async () => {
    if (identity === null || nextCursor === undefined || loadingMore || actionGateRef.current.isBusy()) return;
    setLoadingMore(true);
    setError(undefined);
    try {
      const page = await new LocalTransactionHistory(mobileDatabase(sqlite)).page({
        farmId: identity.farmId,
        cursor: nextCursor,
        limit: PAGE_SIZE
      });
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch {
      setError("Daha eski kayıtları açamadık. Tekrar deneyebilirsin.");
    } finally {
      setLoadingMore(false);
    }
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
      await loadFirstPage();
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
      await loadFirstPage();
    } catch {
      setError("Kaydı geri alamadık. Diğer kayıtların güvende.");
    } finally {
      finishAction(actionKey);
    }
  };

  const editTransaction = (item: FarmTransaction) => {
    if (actionGateRef.current.isBusy()) return;
    router.push({ pathname: "/transaction-edit", params: { id: item.id } });
  };

  const busy = pendingActionKey !== null;

  return (
    <Screen>
      <PageTitle hint="Eski para girişlerini ve çıkışlarını burada bulabilirsin.">
        Tüm kayıtlar
      </PageTitle>

      <SecondaryButton label="Ana sayfaya dön" disabled={busy} onPress={() => router.replace("/home")} />

      {lastDeleted !== null ? (
        <Card>
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.undoTitle}>Kayıt silindi.</Text>
          <Text style={styles.muted}>{lastDeleted.category} · {formatTry(lastDeleted.amountKurus)}</Text>
          <SecondaryButton
            label={pendingActionKey?.startsWith("restore:") ? "Geri alınıyor…" : "Geri al"}
            disabled={busy}
            onPress={() => void restoreLastDeleted()}
          />
        </Card>
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
                      accessibilityState={{ disabled: busy }}
                      disabled={busy}
                      hitSlop={4}
                      onPress={() => editTransaction(item)}
                      style={[styles.actionButton, busy && styles.actionDisabled]}
                    >
                      <Text style={styles.editText}>Düzelt</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={deletingThis ? `${item.category} kaydı siliniyor` : `${item.category} kaydını sil`}
                      accessibilityState={{ disabled: busy }}
                      disabled={busy}
                      hitSlop={4}
                      onPress={() => askDelete(item)}
                      style={[styles.actionButton, busy && styles.actionDisabled]}
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
          label={loadingMore ? "Açılıyor…" : "Daha fazla göster"}
          disabled={loadingMore || busy}
          onPress={() => void loadMore()}
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
