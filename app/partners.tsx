import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { loadFarmIdentity } from "@/src/application/appSnapshot";
import { LocalPartnershipRepository, type PartnerBalance } from "@/src/application/localPartnershipRepository";
import { addMoney, formatTry, moneyFromKurus } from "@/src/domain/money";
import { mobileDatabase } from "@/src/mobile/database";
import { BigButton, PageTitle, Screen, TopNav } from "@/src/ui/components";
import { theme } from "@/src/ui/theme";

export default function PartnersScreen() {
  const sqlite = useSQLiteContext();
  const [balances, setBalances] = useState<readonly PartnerBalance[]>([]);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      const db = mobileDatabase(sqlite);
      const identity = await loadFarmIdentity(db);
      if (identity === null) {
        router.replace("/onboarding");
        return;
      }
      setBalances(await new LocalPartnershipRepository(db).balances(identity.farmId));
      setError(undefined);
    } catch {
      setBalances([]);
      setError("Ortak hesabını şu an okuyamadık. Defter kayıtların değişmedi.");
    }
  }, [sqlite]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const totals = useMemo(() => balances.reduce(
    (acc, item) => ({
      receivable: addMoney(acc.receivable, item.receivableKurus),
      payable: addMoney(acc.payable, item.payableKurus)
    }),
    { receivable: moneyFromKurus(0), payable: moneyFromKurus(0) }
  ), [balances]);

  return (
    <Screen>
      <PageTitle hint="Açık ortak hesapların.">Ortaklar</PageTitle>

      <TopNav
        active="partners"
        onLedger={() => router.replace("/home")}
        onCrops={() => router.replace("/crop-profit")}
        onPartners={() => undefined}
      />

      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Alacağım</Text>
          <Text style={styles.receivableTotal}>{formatTry(totals.receivable)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Borcum</Text>
          <Text style={styles.payableTotal}>{formatTry(totals.payable)}</Text>
        </View>
      </View>

      <BigButton label="Ortak ekle" icon="+" onPress={() => router.push("/partner-new")} />

      <View style={styles.list}>
        {balances.map((item, index) => {
          const receivable = item.netKurus > 0;
          const payable = item.netKurus < 0;
          const amount = receivable ? item.receivableKurus : item.payableKurus;
          return (
            <Pressable
              key={item.partnerId}
              accessibilityRole="button"
              accessibilityLabel={`${item.partnerName} ortak hesabını aç`}
              disabled={item.netKurus === 0}
              onPress={() => router.push({ pathname: "/partner-settlement", params: { partnerId: item.partnerId } })}
              style={({ pressed }) => [styles.row, index > 0 && styles.divider, pressed && styles.pressed]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(item.partnerName)}</Text>
              </View>
              <View style={styles.copy}>
                <Text style={styles.name}>{item.partnerName}</Text>
                <Text style={styles.status}>
                  {receivable ? "Bana ödeyecek" : payable ? "Ben ödeyeceğim" : "Hesap kapalı"}
                </Text>
              </View>
              <Text style={[
                styles.amount,
                receivable && styles.receivable,
                payable && styles.payable,
                !receivable && !payable && styles.closed
              ]}>{formatTry(amount)}</Text>
            </Pressable>
          );
        })}
      </View>

      {balances.length === 0 && !error ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Henüz ortak yok</Text>
          <Text style={styles.emptyText}>Ortaklı bir işin olduğunda kişiyi bir kez eklemen yeterli.</Text>
        </View>
      ) : null}

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toLocaleUpperCase("tr-TR"))
    .join("");
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingVertical: 22,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.divider
  },
  summaryItem: { flex: 1, gap: 5 },
  summaryDivider: { width: 1, backgroundColor: theme.color.divider, marginHorizontal: 18 },
  summaryLabel: { color: theme.color.textMuted, fontSize: 12, fontWeight: "700" },
  receivableTotal: { color: theme.color.income, fontSize: 22, fontWeight: "900", letterSpacing: -0.4 },
  payableTotal: { color: theme.color.expense, fontSize: 22, fontWeight: "900", letterSpacing: -0.4 },
  list: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.color.divider, marginTop: 8 },
  row: { minHeight: 78, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: theme.color.divider },
  pressed: { opacity: 0.6 },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.color.primarySoft, alignItems: "center", justifyContent: "center" },
  avatarText: { color: theme.color.primaryInk, fontSize: 14, fontWeight: "900" },
  copy: { flex: 1, gap: 3 },
  name: { color: theme.color.text, fontSize: 16, fontWeight: "800" },
  status: { color: theme.color.textMuted, fontSize: 12, fontWeight: "600" },
  amount: { fontSize: 16, fontWeight: "900" },
  receivable: { color: theme.color.income },
  payable: { color: theme.color.expense },
  closed: { color: theme.color.textMuted },
  empty: { minHeight: 140, justifyContent: "center", gap: 6, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.color.divider },
  emptyTitle: { color: theme.color.text, fontSize: 18, fontWeight: "900" },
  emptyText: { color: theme.color.textMuted, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  error: { color: theme.color.expense, fontSize: 15, fontWeight: "700", lineHeight: 22 }
});
