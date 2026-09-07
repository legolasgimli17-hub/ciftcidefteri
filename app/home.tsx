import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { createExclusiveActionGate } from "@/src/application/exclusiveActionGate";
import { buildHomeSummary } from "@/src/application/homeSummary";
import { loadAppSnapshot, type AppSnapshot } from "@/src/application/appSnapshot";
import { LocalFarmRepository } from "@/src/application/localFarmRepository";
import { LocalPartnershipRepository, type PartnerBalance } from "@/src/application/localPartnershipRepository";
import { LocalTransactionCorrections } from "@/src/application/transactionCorrections";
import { addMoney, formatTry, moneyFromKurus } from "@/src/domain/money";
import { type FarmTransaction } from "@/src/domain/transaction";
import { mobileDatabase } from "@/src/mobile/database";
import { dateInputFromIso } from "@/src/mobile/date";
import { BigButton, Card, PageTitle, Pill, Screen, SecondaryButton, SectionTitle } from "@/src/ui/components";
import { theme } from "@/src/ui/theme";
import { uxPolicy } from "@/src/ui/policy";

export default function HomeScreen() {
  const sqlite = useSQLiteContext();
  const actionGateRef = useRef(createExclusiveActionGate());
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [partnerBalances, setPartnerBalances] = useState<readonly PartnerBalance[]>([]);
  const [error, setError] = useState<string>();
  const [partnerError, setPartnerError] = useState<string>();
  const [lastDeleted, setLastDeleted] = useState<FarmTransaction | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const db = mobileDatabase(sqlite);
    try {
      const loaded = await loadAppSnapshot(db);
      if (loaded === null) {
        setSnapshot(null);
        setError(undefined);
        router.replace("/onboarding");
        return;
      }
      setSnapshot(loaded);
      setError(undefined);

      try {
        setPartnerBalances(await new LocalPartnershipRepository(db).balances(loaded.identity.farmId));
        setPartnerError(undefined);
      } catch {
        setPartnerBalances([]);
        setPartnerError("Ortaklık hesabını şu an gösteremedik. Defter kayıtların etkilenmedi.");
      }
    } catch {
      setError("Defterini şu an okuyamadık. Kayıtların silinmedi.");
    }
  }, [sqlite]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const summary = snapshot ? buildHomeSummary(snapshot.summary) : null;
  const homeActionBusy = pendingActionKey !== null;
  const partnerTotals = useMemo(() => partnerBalances.reduce(
    (acc, item) => ({
      receivable: addMoney(acc.receivable, item.receivableKurus),
      payable: addMoney(acc.payable, item.payableKurus)
    }),
    { receivable: moneyFromKurus(0), payable: moneyFromKurus(0) }
  ), [partnerBalances]);

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
      <PageTitle hint={snapshot ? `${snapshot.identity.profile.name}, hesabın burada.` : "Defterin hazırlanıyor…"}>
        Benim Defterim
      </PageTitle>

      {summary && snapshot ? (
        <Card tone="strong">
          <Text style={styles.heroEyebrow}>GENEL DURUM</Text>
          <View style={styles.heroAmountBlock}>
            <Text style={styles.heroLabel}>{summary.headline}</Text>
            <Text style={[
              styles.heroAmount,
              summary.tone === "positive" && styles.heroPositive,
              summary.tone === "negative" && styles.heroNegative
            ]}>{formatTry(summary.netKurus)}</Text>
          </View>
          <View style={styles.heroMetrics}>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricLabel}>GELİR</Text>
              <Text style={styles.heroIncome}>{formatTry(snapshot.summary.income)}</Text>
            </View>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricLabel}>GİDER</Text>
              <Text style={styles.heroExpense}>{formatTry(snapshot.summary.expense)}</Text>
            </View>
          </View>
          <SecondaryButton
            label="Ürün hesabını aç"
            disabled={homeActionBusy}
            onPress={() => router.push("/crop-profit")}
          />
        </Card>
      ) : null}

      {lastDeleted !== null ? (
        <Card tone="soft">
          <View style={styles.undoHeader}>
            <Pill label="Kayıt silindi" tone="warning" />
            <Text style={styles.undoCopy}>{lastDeleted.category} · {formatTry(lastDeleted.amountKurus)}</Text>
          </View>
          <SecondaryButton
            label={restoring ? "Geri alınıyor…" : "Geri al"}
            disabled={restoring || homeActionBusy}
            onPress={() => void restoreLastDeleted()}
          />
        </Card>
      ) : null}

      {snapshot ? (
        <>
          <SectionTitle detail="Tarihli deftere işler">Hızlı kayıt</SectionTitle>
          <BigButton
            label="Gider ekle"
            icon="−"
            kind="expense"
            disabled={homeActionBusy}
            onPress={() => router.push({ pathname: "/transaction", params: { kind: "expense" } })}
          />
          <BigButton
            label="Gelir ekle"
            icon="+"
            kind="income"
            disabled={homeActionBusy}
            onPress={() => router.push({ pathname: "/transaction", params: { kind: "income" } })}
          />
        </>
      ) : null}

      {snapshot ? (
        <>
          <SectionTitle>Ortak hesabı</SectionTitle>
          <Card>
            <View style={styles.partnerSummaryHeader}>
              <View style={styles.partnerBadge}><Text style={styles.partnerBadgeText}>2K</Text></View>
              <View style={styles.partnerSummaryCopy}>
                <Text style={styles.cardTitle}>Kim kime ne kadar?</Text>
                <Text style={styles.mutedCopy}>Ortaklı gider ve gelirlerden otomatik hesaplanır.</Text>
              </View>
            </View>
            <View style={styles.partnerMetricRow}>
              <View style={[styles.partnerMetric, styles.receivableBox]}>
                <Text style={styles.metricLabel}>ALACAĞIM</Text>
                <Text style={styles.receivableText}>{formatTry(partnerTotals.receivable)}</Text>
              </View>
              <View style={[styles.partnerMetric, styles.payableBox]}>
                <Text style={styles.metricLabel}>BORCUM</Text>
                <Text style={styles.payableText}>{formatTry(partnerTotals.payable)}</Text>
              </View>
            </View>
            {partnerError ? <Text style={styles.partnerError}>{partnerError}</Text> : null}
            <SecondaryButton label="Ortak hesaplarını aç" onPress={() => router.push("/partners")} />
          </Card>
        </>
      ) : null}

      {snapshot && snapshot.recentTransactions.length === 0 ? (
        <>
          <SectionTitle>Defter</SectionTitle>
          <Card tone="soft">
            <Text accessibilityRole="header" style={styles.cardTitle}>Henüz kayıt yok</Text>
            <Text style={styles.mutedCopy}>İlk giderini yukarıdaki “Gider ekle” düğmesinden tarihli olarak yazabilirsin.</Text>
          </Card>
        </>
      ) : null}

      {snapshot && snapshot.recentTransactions.length > 0 ? (
        <>
          <SectionTitle detail="Son 4 kayıt">Defter</SectionTitle>
          <Card>
            {snapshot.recentTransactions.map((item: FarmTransaction, index: number) => {
              const deletingThis = pendingActionKey === `delete:${item.id}`;
              return (
                <View key={item.id} style={[styles.transactionRow, index > 0 && styles.transactionDivider]}>
                  <View style={styles.transactionMain}>
                    <View style={styles.transactionTopLine}>
                      <Text style={styles.transactionCategory}>{item.category}</Text>
                      <Pill label={item.kind === "income" ? "Gelir" : "Gider"} tone={item.kind === "income" ? "income" : "expense"} />
                    </View>
                    <Text style={styles.transactionDate}>{dateInputFromIso(item.occurredOn)}</Text>
                    <Text style={item.kind === "income" ? styles.incomeText : styles.expenseText}>
                      {item.kind === "income" ? "+" : "−"}{formatTry(item.amountKurus)}
                    </Text>
                  </View>
                  <View style={styles.actionRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${item.category} kaydını düzelt`}
                      accessibilityState={{ disabled: homeActionBusy }}
                      disabled={homeActionBusy}
                      onPress={() => editTransaction(item)}
                      hitSlop={4}
                      style={[styles.actionButton, homeActionBusy && styles.actionDisabled]}
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
                      style={[styles.actionButton, homeActionBusy && styles.actionDisabled]}
                    >
                      <Text style={styles.deleteText}>{deletingThis ? "Siliniyor…" : "Sil"}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
            <SecondaryButton
              label="Tüm kayıtları aç"
              disabled={homeActionBusy}
              onPress={() => router.push("/transactions")}
            />
          </Card>
        </>
      ) : null}

      {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroEyebrow: { color: theme.color.gold, fontSize: 11, fontWeight: "900", letterSpacing: 1.15 },
  heroAmountBlock: { gap: 4 },
  heroLabel: { color: "#B8C7BF", fontSize: 15, fontWeight: "700" },
  heroAmount: { color: theme.color.white, fontSize: theme.type.heroAmount, fontWeight: "900", letterSpacing: -1.2 },
  heroPositive: { color: "#8DE0AC" },
  heroNegative: { color: "#FFAAA4" },
  heroMetrics: { flexDirection: "row", gap: 10 },
  heroMetric: { flex: 1, borderRadius: theme.radius.md, backgroundColor: "rgba(255,255,255,0.08)", padding: 13, gap: 5 },
  heroMetricLabel: { color: "#AABAB1", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  heroIncome: { color: "#8DE0AC", fontSize: 16, fontWeight: "900" },
  heroExpense: { color: "#FFAAA4", fontSize: 16, fontWeight: "900" },
  undoHeader: { gap: 8 },
  undoCopy: { color: theme.color.text, fontSize: 16, fontWeight: "700" },
  partnerSummaryHeader: { flexDirection: "row", gap: 12, alignItems: "center" },
  partnerBadge: { width: 48, height: 48, borderRadius: 16, backgroundColor: theme.color.primarySoft, alignItems: "center", justifyContent: "center" },
  partnerBadgeText: { color: theme.color.primaryInk, fontSize: 15, fontWeight: "900" },
  partnerSummaryCopy: { flex: 1, gap: 3 },
  cardTitle: { color: theme.color.text, fontSize: 19, fontWeight: "900", letterSpacing: -0.2 },
  mutedCopy: { color: theme.color.textMuted, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  partnerMetricRow: { flexDirection: "row", gap: 10 },
  partnerMetric: { flex: 1, borderRadius: theme.radius.md, padding: 13, gap: 5 },
  receivableBox: { backgroundColor: theme.color.incomeSoft },
  payableBox: { backgroundColor: theme.color.expenseSoft },
  metricLabel: { color: theme.color.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  receivableText: { color: theme.color.income, fontSize: 17, fontWeight: "900" },
  payableText: { color: theme.color.expense, fontSize: 17, fontWeight: "900" },
  partnerError: { color: theme.color.expense, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  transactionRow: { gap: 10, paddingVertical: 2 },
  transactionDivider: { borderTopWidth: 1, borderTopColor: theme.color.divider, paddingTop: 14 },
  transactionMain: { gap: 5 },
  transactionTopLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  transactionCategory: { color: theme.color.text, fontSize: 17, fontWeight: "900", flex: 1 },
  transactionDate: { color: theme.color.textMuted, fontSize: 13, fontWeight: "600" },
  incomeText: { color: theme.color.income, fontSize: 19, fontWeight: "900" },
  expenseText: { color: theme.color.expense, fontSize: 19, fontWeight: "900" },
  actionRow: { flexDirection: "row", gap: 8 },
  actionButton: {
    minWidth: uxPolicy.minimumTouchTargetPx,
    minHeight: uxPolicy.minimumTouchTargetPx,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color.surfaceRaised
  },
  actionDisabled: { opacity: 0.45 },
  editText: { color: theme.color.primary, fontSize: 14, fontWeight: "800" },
  deleteText: { color: theme.color.expense, fontSize: 14, fontWeight: "800" },
  error: { color: theme.color.expense, fontSize: 15, fontWeight: "700", lineHeight: 22 }
});
