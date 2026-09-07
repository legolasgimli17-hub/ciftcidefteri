import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { buildHomeSummary } from "@/src/application/homeSummary";
import { loadAppSnapshot, type AppSnapshot } from "@/src/application/appSnapshot";
import { formatTry } from "@/src/domain/money";
import { type FarmTransaction } from "@/src/domain/transaction";
import { cropTemplates } from "@/src/domain/crops";
import { mobileDatabase } from "@/src/mobile/database";
import { dateInputFromIso } from "@/src/mobile/date";
import { BigButton, PageTitle, Screen, SecondaryButton, SectionTitle, TopNav } from "@/src/ui/components";
import { theme } from "@/src/ui/theme";
import { uxPolicy } from "@/src/ui/policy";

export default function HomeScreen() {
  const sqlite = useSQLiteContext();
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [error, setError] = useState<string>();

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

  return (
    <Screen>
      <PageTitle hint={snapshot ? snapshot.identity.profile.name : "Defterin hazırlanıyor…"}>
        Defterim
      </PageTitle>

      <TopNav
        active="ledger"
        onLedger={() => undefined}
        onCrops={() => router.replace("/crop-profit")}
        onPartners={() => router.replace("/partners")}
      />

      {summary && snapshot ? (
        <View style={styles.balanceBlock}>
          <Text style={styles.balanceLabel}>Bu sezon kalan</Text>
          <Text style={[
            styles.balanceAmount,
            summary.tone === "negative" && styles.balanceNegative
          ]}>
            {formatTry(summary.netKurus)}
          </Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Gelir</Text>
              <Text style={styles.incomeAmount}>{formatTry(snapshot.summary.income)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Gider</Text>
              <Text style={styles.expenseAmount}>{formatTry(snapshot.summary.expense)}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {snapshot ? (
        <View style={styles.actions}>
          <BigButton
            label="Gider ekle"
            icon="+"
            disabled={false}
            onPress={() => router.push({ pathname: "/transaction", params: { kind: "expense" } })}
          />
          <SecondaryButton
            label="Gelir ekle"
            onPress={() => router.push({ pathname: "/transaction", params: { kind: "income" } })}
          />
        </View>
      ) : null}

      {snapshot ? <SectionTitle detail="En yeniler">Son kayıtlar</SectionTitle> : null}

      {snapshot && snapshot.recentTransactions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Defterin boş</Text>
          <Text style={styles.emptyText}>İlk giderini “Gider ekle” ile tarihli olarak yazabilirsin.</Text>
        </View>
      ) : null}

      {snapshot && snapshot.recentTransactions.length > 0 ? (
        <View style={styles.ledgerList}>
          {snapshot.recentTransactions.map((item: FarmTransaction, index: number) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${item.category} kaydını aç`}
              onPress={() => router.push({ pathname: "/transaction-edit", params: { id: item.id } })}
              style={({ pressed }) => [
                styles.ledgerRow,
                index > 0 && styles.ledgerDivider,
                pressed && styles.ledgerPressed
              ]}
            >
              <View style={styles.ledgerCopy}>
                <Text style={styles.ledgerCategory}>{item.category}</Text>
                <Text style={styles.ledgerMeta}>
                  {dateInputFromIso(item.occurredOn)}
                  {item.cropCode ? ` · ${cropTemplates[item.cropCode].label}` : " · Genel"}
                </Text>
                {item.note ? <Text numberOfLines={1} style={styles.ledgerNote}>{item.note}</Text> : null}
              </View>
              <Text style={item.kind === "income" ? styles.ledgerIncome : styles.ledgerExpense}>
                {item.kind === "income" ? "+" : "−"}{formatTry(item.amountKurus)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {snapshot && snapshot.recentTransactions.length > 0 ? (
        <SecondaryButton label="Tüm defteri aç" onPress={() => router.push("/transactions")} />
      ) : null}

      {snapshot ? (
        <SecondaryButton label="Daha" onPress={() => router.push("/more")} />
      ) : null}

      {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  balanceBlock: {
    paddingTop: 22,
    paddingBottom: 16,
    gap: 7
  },
  balanceLabel: {
    color: theme.color.textMuted,
    fontSize: 14,
    fontWeight: "700"
  },
  balanceAmount: {
    color: theme.color.text,
    fontSize: theme.type.heroAmount,
    lineHeight: 56,
    fontWeight: "900",
    letterSpacing: -1.8
  },
  balanceNegative: { color: theme.color.expense },
  summaryRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.divider
  },
  summaryItem: { flex: 1, gap: 4 },
  summaryDivider: { width: 1, backgroundColor: theme.color.divider, marginHorizontal: 18 },
  summaryLabel: { color: theme.color.textMuted, fontSize: 12, fontWeight: "700" },
  incomeAmount: { color: theme.color.text, fontSize: 17, fontWeight: "800" },
  expenseAmount: { color: theme.color.text, fontSize: 17, fontWeight: "800" },
  actions: { gap: 10, marginTop: 2 },
  emptyState: {
    minHeight: 128,
    justifyContent: "center",
    paddingVertical: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.divider,
    gap: 6
  },
  emptyTitle: { color: theme.color.text, fontSize: 18, fontWeight: "900" },
  emptyText: { color: theme.color.textMuted, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  ledgerList: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.divider
  },
  ledgerRow: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    paddingVertical: 13
  },
  ledgerDivider: { borderTopWidth: 1, borderTopColor: theme.color.divider },
  ledgerPressed: { opacity: 0.6 },
  ledgerCopy: { flex: 1, gap: 3 },
  ledgerCategory: { color: theme.color.text, fontSize: 16, fontWeight: "800" },
  ledgerMeta: { color: theme.color.textMuted, fontSize: 12, fontWeight: "600" },
  ledgerNote: { color: theme.color.textSubtle, fontSize: 12, fontWeight: "600" },
  ledgerIncome: { color: theme.color.income, fontSize: 16, fontWeight: "900" },
  ledgerExpense: { color: theme.color.expense, fontSize: 16, fontWeight: "900" },
  error: { color: theme.color.expense, fontSize: 15, fontWeight: "700", lineHeight: 22, minHeight: uxPolicy.minimumTouchTargetPx }
});
