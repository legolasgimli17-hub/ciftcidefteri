import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { loadFarmIdentity, type FarmIdentity } from "@/src/application/appSnapshot";
import { LocalDebtRepository, type DebtBalance } from "@/src/application/localDebtRepository";
import { debtSourceLabel } from "@/src/domain/debt";
import { formatTry, moneyFromKurus } from "@/src/domain/money";
import { mobileDatabase } from "@/src/mobile/database";
import { dateInputFromIso } from "@/src/mobile/date";
import { BigButton, Card, ErrorNote, PageTitle, Screen, SecondaryButton, SectionTitle } from "@/src/ui/components";
import { theme } from "@/src/ui/theme";

export default function DebtsScreen() {
  const sqlite = useSQLiteContext();
  const [identity, setIdentity] = useState<FarmIdentity | null>(null);
  const [balances, setBalances] = useState<readonly DebtBalance[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const db = mobileDatabase(sqlite);
      const loadedIdentity = await loadFarmIdentity(db);
      if (loadedIdentity === null) {
        router.replace("/onboarding");
        return;
      }
      const loadedBalances = await new LocalDebtRepository(db).listBalances(loadedIdentity.farmId);
      setIdentity(loadedIdentity);
      setBalances(loadedBalances);
      setError(undefined);
    } catch {
      setError("Borç hesabını şu an gösteremedik. Kayıtların silinmedi.");
    } finally {
      setLoading(false);
    }
  }, [sqlite]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const totalRemaining = moneyFromKurus(
    balances.reduce((sum, item) => sum + item.remainingKurus, 0)
  );

  return (
    <Screen>
      <PageTitle hint={identity ? identity.profile.name : "Borç hesabın hazırlanıyor…"}>
        Borçlar
      </PageTitle>

      {!loading && balances.length > 0 ? (
        <View style={styles.totalBlock}>
          <Text style={styles.totalLabel}>Toplam kalan borç</Text>
          <Text style={styles.totalAmount}>{formatTry(totalRemaining)}</Text>
        </View>
      ) : null}

      <BigButton label="Borç ekle" icon="+" onPress={() => router.push("/debt-new")} />

      {!loading ? <SectionTitle detail={`${balances.length} kayıt`}>Borçların</SectionTitle> : null}

      {!loading && balances.length === 0 && !error ? (
        <Card tone="soft">
          <Text style={styles.emptyTitle}>Henüz borç kaydı yok</Text>
          <Text style={styles.emptyText}>Banka, Tarım Kredi, çek-senet veya birinden aldığın borcu burada takip edebilirsin.</Text>
        </Card>
      ) : null}

      {balances.map((balance) => (
        <Card key={balance.debt.id}>
          <View style={styles.cardHead}>
            <View style={styles.cardCopy}>
              <Text style={styles.creditor}>{balance.debt.creditorName}</Text>
              <Text style={styles.source}>{debtSourceLabel(balance.debt.sourceKind)}</Text>
            </View>
            <Text style={balance.remainingKurus > 0 ? styles.remaining : styles.closed}>
              {balance.remainingKurus > 0 ? formatTry(balance.remainingKurus) : "Kapandı"}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Toplam</Text>
            <Text style={styles.metaValue}>{formatTry(balance.debt.totalKurus)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Ödenen</Text>
            <Text style={styles.metaValue}>{formatTry(balance.paidKurus)}</Text>
          </View>

          {balance.nextDueOn && balance.nextDueAmountKurus ? (
            <View style={styles.nextBox}>
              <Text style={styles.nextLabel}>Sıradaki ödeme</Text>
              <Text style={styles.nextValue}>
                {dateInputFromIso(balance.nextDueOn)} · {formatTry(balance.nextDueAmountKurus)}
              </Text>
            </View>
          ) : null}

          {balance.debt.inKindDescription ? (
            <Text style={styles.note}>Mal olarak: {balance.debt.inKindDescription}</Text>
          ) : null}

          {balance.remainingKurus > 0 ? (
            <SecondaryButton
              label="Ödeme kaydet"
              onPress={() => router.push({ pathname: "/debt-payment", params: { id: balance.debt.id } })}
            />
          ) : null}
        </Card>
      ))}

      <ErrorNote message={error} />
      <SecondaryButton label="Daha'ya dön" onPress={() => router.replace("/more")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  totalBlock: {
    paddingVertical: 16,
    gap: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.divider
  },
  totalLabel: { color: theme.color.textMuted, fontSize: 14, fontWeight: "700" },
  totalAmount: { color: theme.color.text, fontSize: 34, lineHeight: 42, fontWeight: "900", letterSpacing: -0.8 },
  emptyTitle: { color: theme.color.text, fontSize: 18, fontWeight: "900" },
  emptyText: { color: theme.color.textMuted, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  cardHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  cardCopy: { flex: 1, gap: 3 },
  creditor: { color: theme.color.text, fontSize: 18, fontWeight: "900" },
  source: { color: theme.color.textMuted, fontSize: 13, fontWeight: "700" },
  remaining: { color: theme.color.expense, fontSize: 18, fontWeight: "900" },
  closed: { color: theme.color.income, fontSize: 15, fontWeight: "900" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  metaLabel: { color: theme.color.textMuted, fontSize: 13, fontWeight: "700" },
  metaValue: { color: theme.color.text, fontSize: 14, fontWeight: "800" },
  nextBox: { backgroundColor: theme.color.surfaceMuted, borderRadius: theme.radius.sm, padding: 12, gap: 3 },
  nextLabel: { color: theme.color.textMuted, fontSize: 12, fontWeight: "700" },
  nextValue: { color: theme.color.text, fontSize: 15, fontWeight: "900" },
  note: { color: theme.color.textMuted, fontSize: 13, fontWeight: "600", lineHeight: 19 }
});
