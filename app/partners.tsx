import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { loadFarmIdentity } from "@/src/application/appSnapshot";
import { LocalPartnershipRepository, type PartnerBalance } from "@/src/application/localPartnershipRepository";
import { addMoney, formatTry, moneyFromKurus } from "@/src/domain/money";
import { mobileDatabase } from "@/src/mobile/database";
import { BigButton, Card, PageTitle, Pill, Screen, SecondaryButton, SectionTitle } from "@/src/ui/components";
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
      const loaded = await new LocalPartnershipRepository(db).balances(identity.farmId);
      setBalances(loaded);
      setError(undefined);
    } catch {
      setBalances([]);
      setError("Ortaklık hesabını şu an okuyamadık. Defter kayıtların değiştirilmedi.");
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
      <PageTitle hint="Kimin ne ödediğini kaynak kayıtlardan hesaplarız. Ayrı, gizli borç hesabı yok.">
        Ortak hesapları
      </PageTitle>

      <Card tone="strong">
        <Text style={styles.strongEyebrow}>AÇIK HESAP</Text>
        <View style={styles.totalRow}>
          <View style={styles.totalBlock}>
            <Text style={styles.strongLabel}>Alacağım</Text>
            <Text style={styles.receivableAmount}>{formatTry(totals.receivable)}</Text>
          </View>
          <View style={styles.totalDivider} />
          <View style={styles.totalBlock}>
            <Text style={styles.strongLabel}>Borcum</Text>
            <Text style={styles.payableAmount}>{formatTry(totals.payable)}</Text>
          </View>
        </View>
      </Card>

      <BigButton label="Ortak ekle" icon="+" onPress={() => router.push("/partner-new")} />

      {balances.length > 0 ? <SectionTitle detail={`${balances.length} kişi`}>Kişi kişi hesap</SectionTitle> : null}

      {balances.map((item) => {
        const status = item.netKurus > 0 ? "Bana borçlu" : item.netKurus < 0 ? "Ben borçluyum" : "Hesap kapalı";
        const tone = item.netKurus > 0 ? "income" : item.netKurus < 0 ? "expense" : "neutral";
        return (
          <Card key={item.partnerId}>
            <View style={styles.partnerHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(item.partnerName)}</Text>
              </View>
              <View style={styles.partnerCopy}>
                <Text accessibilityRole="header" style={styles.partnerName}>{item.partnerName}</Text>
                <Pill label={status} tone={tone} />
              </View>
            </View>
            <View style={styles.balanceLine}>
              <Text style={styles.balanceLabel}>{item.netKurus >= 0 ? "Benden alacağı değil, bana ödeyeceği" : "Benim ödeyeceğim"}</Text>
              <Text style={[styles.balanceAmount, item.netKurus > 0 ? styles.receivable : item.netKurus < 0 ? styles.payable : styles.closed]}>
                {formatTry(item.netKurus >= 0 ? item.receivableKurus : item.payableKurus)}
              </Text>
            </View>
          </Card>
        );
      })}

      {balances.length === 0 && !error ? (
        <Card tone="soft">
          <Text style={styles.emptyTitle}>Henüz ortak yok</Text>
          <Text style={styles.emptyCopy}>Ortaklı iş yaptığın kişiyi bir kez ekle. Sonra ortaklı giderlerde seçebilirsin.</Text>
        </Card>
      ) : null}

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <SecondaryButton label="Deftere dön" onPress={() => router.replace("/home")} />
    </Screen>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.slice(0, 1).toLocaleUpperCase("tr-TR")).join("");
}

const styles = StyleSheet.create({
  strongEyebrow: { color: theme.color.gold, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  totalRow: { flexDirection: "row", alignItems: "stretch", gap: 14 },
  totalBlock: { flex: 1, gap: 7 },
  totalDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.14)" },
  strongLabel: { color: "#B8C7BF", fontSize: 13, fontWeight: "700" },
  receivableAmount: { color: "#8DE0AC", fontSize: 22, fontWeight: "900", letterSpacing: -0.4 },
  payableAmount: { color: "#FFAAA4", fontSize: 22, fontWeight: "900", letterSpacing: -0.4 },
  partnerHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: theme.color.primarySoft, alignItems: "center", justifyContent: "center" },
  avatarText: { color: theme.color.primaryInk, fontSize: 16, fontWeight: "900" },
  partnerCopy: { flex: 1, gap: 7 },
  partnerName: { color: theme.color.text, fontSize: 19, fontWeight: "900", letterSpacing: -0.2 },
  balanceLine: { borderTopWidth: 1, borderTopColor: theme.color.divider, paddingTop: 14, gap: 4 },
  balanceLabel: { color: theme.color.textMuted, fontSize: 13, fontWeight: "600" },
  balanceAmount: { fontSize: 24, fontWeight: "900", letterSpacing: -0.45 },
  receivable: { color: theme.color.income },
  payable: { color: theme.color.expense },
  closed: { color: theme.color.textMuted },
  emptyTitle: { color: theme.color.text, fontSize: 18, fontWeight: "900" },
  emptyCopy: { color: theme.color.textMuted, fontSize: 15, fontWeight: "600", lineHeight: 22 },
  error: { color: theme.color.expense, fontSize: 15, fontWeight: "700", lineHeight: 22 }
});
