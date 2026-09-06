import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { buildHomeSummary } from "@/src/application/homeSummary";
import { loadAppSnapshot, type AppSnapshot } from "@/src/application/appSnapshot";
import { LocalFarmRepository } from "@/src/application/localFarmRepository";
import { formatTry } from "@/src/domain/money";
import { type FarmTransaction } from "@/src/domain/transaction";
import { mobileDatabase } from "@/src/mobile/database";
import { BigButton, Card, PageTitle, Screen } from "@/src/ui/components";
import { theme } from "@/src/ui/theme";

export default function HomeScreen() {
  const sqlite = useSQLiteContext();
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await loadAppSnapshot(mobileDatabase(sqlite)));
      setError(undefined);
    } catch {
      setError("Defterini şu an okuyamadık. Kayıtların silinmedi.");
    }
  }, [sqlite]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const summary = snapshot ? buildHomeSummary(snapshot.summary) : null;

  const askDelete = (item: FarmTransaction) => {
    if (snapshot === null) return;
    Alert.alert(
      "Bu kaydı silelim mi?",
      `${item.category} · ${formatTry(item.amountKurus)}`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => {
            const repository = new LocalFarmRepository(mobileDatabase(sqlite));
            void repository
              .softDeleteTransaction({
                farmId: snapshot.identity.farmId,
                transactionId: item.id,
                nowIso: new Date().toISOString()
              })
              .then(() => refresh())
              .catch(() => setError("Kaydı silemedik. Kayıtların güvende."));
          }
        }
      ]
    );
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

      <Text style={styles.question}>Bugün para girdi mi, çıktı mı?</Text>
      <BigButton label="Para girdi" icon="↓" kind="income" onPress={() => router.push({ pathname: "/transaction", params: { kind: "income" } })} />
      <BigButton label="Para çıktı" icon="↑" kind="expense" onPress={() => router.push({ pathname: "/transaction", params: { kind: "expense" } })} />

      {snapshot && snapshot.transactions.length > 0 ? (
        <Card>
          <Text style={styles.cardTitle}>Son kayıtlar</Text>
          {snapshot.transactions.slice(0, 4).map((item: FarmTransaction) => (
            <View style={styles.transactionRow} key={item.id}>
              <View style={styles.transactionCopy}>
                <Text style={styles.transactionCategory}>{item.category}</Text>
                <Text style={styles.transactionDate}>{item.occurredOn}</Text>
              </View>
              <View style={styles.transactionActions}>
                <Text style={item.kind === "income" ? styles.incomeText : styles.expenseText}>
                  {item.kind === "income" ? "+" : "−"}{formatTry(item.amountKurus)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.category} kaydını sil`}
                  onPress={() => askDelete(item)}
                  hitSlop={10}
                >
                  <Text style={styles.deleteText}>Sil</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
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
  transactionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 58, gap: 12 },
  transactionCopy: { flex: 1 },
  transactionCategory: { color: theme.color.text, fontSize: 17, fontWeight: "800" },
  transactionDate: { color: theme.color.textMuted, fontSize: 14, marginTop: 3 },
  transactionActions: { alignItems: "flex-end", gap: 6 },
  deleteText: { color: theme.color.expense, fontSize: 15, fontWeight: "800", paddingVertical: 6 },
  error: { color: theme.color.expense, fontSize: 16, fontWeight: "700" }
});
