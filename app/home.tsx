import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { createExclusiveActionGate } from "@/src/application/exclusiveActionGate";
import { buildHomeSummary } from "@/src/application/homeSummary";
import { loadAppSnapshot, type AppSnapshot } from "@/src/application/appSnapshot";
import { LocalFarmRepository } from "@/src/application/localFarmRepository";
import { LocalTransactionCorrections } from "@/src/application/transactionCorrections";
import { formatTry } from "@/src/domain/money";
import { type FarmTransaction } from "@/src/domain/transaction";
import { mobileDatabase } from "@/src/mobile/database";
import { dateInputFromIso } from "@/src/mobile/date";
import { BigButton, Card, PageTitle, Screen, SecondaryButton } from "@/src/ui/components";
import { theme } from "@/src/ui/theme";
import { uxPolicy } from "@/src/ui/policy";

export default function HomeScreen() {
  const sqlite = useSQLiteContext();
  const actionGateRef = useRef(createExclusiveActionGate());
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [error, setError] = useState<string>();
  const [lastDeleted, setLastDeleted] = useState<FarmTransaction | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const loaded = await loadAppSnapshot(mobileDatabase(sqlite));
      if (loaded === null) {
        setSnapshot(null);
        setError(undefined);
        router.replace("/onboarding");
        return;
      }
      setSnapshot(loaded);
      setError(undefined);
    } catch {
      setError("Defterini şu an okuyamadık. Kayıtların silinmedi.");
    }
  }, [sqlite]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const summary = snapshot ? buildHomeSummary(snapshot.summary) : null;
  const homeActionBusy = pendingActionKey !== null;

  const finishHomeAction = (key: string) => {
    actionGateRef.current.finish(key);
    setPendingActionKey((current) => current === key ? null : current);
  };

  const restoreLastDeleted = async () => {
    if (snapshot === null || lastDeleted === null) return;
    const actionKey = `restore:${lastDeleted.id}`;
    if (!actionGateRef.current.tryStart(actionKey)) return;

    setPendingActionKey(actionKey);
    setRestoring(true);
    setError(undefined);
    try {
      const restored = await new LocalTransactionCorrections(mobileDatabase(sqlite)).restoreTransaction({
        farmId: snapshot.identity.farmId,
        transactionId: lastDeleted.id,
        nowIso: new Date().toISOString()
      });
      if (!restored) {
        setLastDeleted(null);
        setError("Bu kayıt geri alınamadı. Defterini yenileyip tekrar dene.");
        return;
      }
      setLastDeleted(null);
      await refresh();
    } catch {
      setError("Kaydı geri alamadık. Diğer kayıtların güvende.");
    } finally {
      setRestoring(false);
      finishHomeAction(actionKey);
    }
  };

  const deleteTransaction = async (item: FarmTransaction, farmId: string, actionKey: string) => {
    setError(undefined);
    try {
      const repository = new LocalFarmRepository(mobileDatabase(sqlite));
      const deleted = await repository.softDeleteTransaction({
        farmId,
        transactionId: item.id,
        nowIso: new Date().toISOString()
      });
      if (!deleted) {
        setError("Bu kayıt zaten silinmiş veya bulunamadı.");
        return;
      }
      setLastDeleted(item);
      await refresh();
    } catch {
      setError("Kaydı silemedik. Kayıtların güvende.");
    } finally {
      finishHomeAction(actionKey);
    }
  };

  const askDelete = (item: FarmTransaction) => {
    if (snapshot === null) return;
    const actionKey = `delete:${item.id}`;
    if (!actionGateRef.current.tryStart(actionKey)) return;

    setPendingActionKey(actionKey);
    let deleteConfirmed = false;
    const releasePrompt = () => {
      if (!deleteConfirmed) finishHomeAction(actionKey);
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
            void deleteTransaction(item, snapshot.identity.farmId, actionKey);
          }
        }
      ],
      { cancelable: true, onDismiss: releasePrompt }
    );
  };

  const editTransaction = (item: FarmTransaction) => {
    if (actionGateRef.current.isBusy()) return;
    router.push({ pathname: "/transaction-edit", params: { id: item.id } });
  };

  return (
    <Screen>
      <PageTitle hint={snapshot ? `${snapshot.identity.profile.name}, bugün ne oldu?` : "Defterin hazırlanıyor…"}>
        Benim Defterim
      </PageTitle>

      {summary ? (
        <Card>
          <Text style={styles.summaryLabel}>{summary.headline}</Text>
          <Text style={[
            styles.summaryAmount,
            summary.tone === "positive" && styles.positive,
            summary.tone === "negative" && styles.negative
          ]}>{formatTry(summary.netKurus)}</Text>
          <View style={styles.rows}>
            <Text style={styles.incomeText}>Giren: {formatTry(snapshot!.summary.income)}</Text>
            <Text style={styles.expenseText}>Çıkan: {formatTry(snapshot!.summary.expense)}</Text>
          </View>
        </Card>
      ) : null}

      {lastDeleted !== null ? (
        <Card>
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.undoTitle}>Kayıt silindi.</Text>
          <Text style={styles.undoCopy}>{lastDeleted.category} · {formatTry(lastDeleted.amountKurus)}</Text>
          <SecondaryButton
            label={restoring ? "Geri alınıyor…" : "Geri al"}
            disabled={restoring || homeActionBusy}
            onPress={() => void restoreLastDeleted()}
          />
        </Card>
      ) : null}

      {snapshot ? (
        <>
          <Text style={styles.question}>Bugün para girdi mi, çıktı mı?</Text>
          <BigButton
            label="Para girdi"
            icon="↓"
            kind="income"
            disabled={homeActionBusy}
            onPress={() => router.push({ pathname: "/transaction", params: { kind: "income" } })}
          />
          <BigButton
            label="Para çıktı"
            icon="↑"
            kind="expense"
            disabled={homeActionBusy}
            onPress={() => router.push({ pathname: "/transaction", params: { kind: "expense" } })}
          />
        </>
      ) : null}

      {snapshot && snapshot.recentTransactions.length === 0 ? (
        <Card>
          <Text accessibilityRole="header" style={styles.cardTitle}>Henüz kayıt yok</Text>
          <Text style={styles.emptyCopy}>İlk para girişini veya çıkışını yukarıdan ekleyebilirsin.</Text>
        </Card>
      ) : null}

      {snapshot && snapshot.recentTransactions.length > 0 ? (
        <Card>
          <Text style={styles.cardTitle}>Son kayıtlar</Text>
          {snapshot.recentTransactions.map((item: FarmTransaction) => {
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
                      accessibilityState={{ disabled: homeActionBusy }}
                      disabled={homeActionBusy}
                      onPress={() => editTransaction(item)}
                      hitSlop={4}
                      style={[styles.editButton, homeActionBusy && styles.actionDisabled]}
                    >
                      <Text style={styles.editText}>Düzelt</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={deletingThis ? `${item.category} kaydı siliniyor` : `${item.category} kaydını sil`}
                      accessibilityState={{ disabled: homeActionBusy }}
                      disabled={homeActionBusy}
                      onPress={() => askDelete(item)}
                      hitSlop={4}
                      style={[styles.deleteButton, homeActionBusy && styles.actionDisabled]}
                    >
                      <Text style={styles.deleteText}>{deletingThis ? "Siliniyor…" : "Sil"}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
          <SecondaryButton
            label="Tüm kayıtları gör"
            disabled={homeActionBusy}
            onPress={() => router.push("/transactions")}
          />
        </Card>
      ) : null}

      {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryLabel: { color: theme.color.textMuted, fontSize: 17, fontWeight: "700" },
  summaryAmount: { color: theme.color.text, fontSize: theme.type.amount, fontWeight: "900", letterSpacing: -1 },
  positive: { color: theme.color.income },
  negative: { color: theme.color.expense },
  rows: { flexDirection: "row", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  incomeText: { color: theme.color.income, fontSize: 17, fontWeight: "800" },
  expenseText: { color: theme.color.expense, fontSize: 17, fontWeight: "800" },
  question: { color: theme.color.text, fontSize: 21, fontWeight: "900", marginTop: 6 },
  cardTitle: { color: theme.color.text, fontSize: 20, fontWeight: "900" },
  emptyCopy: { color: theme.color.textMuted, fontSize: 16, fontWeight: "700", lineHeight: 23 },
  transactionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 58, gap: 12 },
  transactionCopy: { flex: 1 },
  transactionCategory: { color: theme.color.text, fontSize: 17, fontWeight: "800" },
  transactionDate: { color: theme.color.textMuted, fontSize: 14, marginTop: 3 },
  transactionActions: { alignItems: "flex-end", gap: 6 },
  actionRow: { flexDirection: "row", gap: 4 },
  editButton: {
    minWidth: uxPolicy.minimumTouchTargetPx,
    minHeight: uxPolicy.minimumTouchTargetPx,
    alignItems: "center",
    justifyContent: "center"
  },
  deleteButton: {
    minWidth: uxPolicy.minimumTouchTargetPx,
    minHeight: uxPolicy.minimumTouchTargetPx,
    alignItems: "center",
    justifyContent: "center"
  },
  actionDisabled: { opacity: 0.45 },
  editText: { color: theme.color.primary, fontSize: 15, fontWeight: "800" },
  deleteText: { color: theme.color.expense, fontSize: 15, fontWeight: "800" },
  undoTitle: { color: theme.color.text, fontSize: 18, fontWeight: "900" },
  undoCopy: { color: theme.color.textMuted, fontSize: 16, fontWeight: "700" },
  error: { color: theme.color.expense, fontSize: 16, fontWeight: "700" }
});
