import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { loadFarmIdentity } from "@/src/application/appSnapshot";
import { loadCropProfitSummaries, type CropProfitSummary } from "@/src/application/cropProfit";
import { formatTry } from "@/src/domain/money";
import { mobileDatabase } from "@/src/mobile/database";
import { PageTitle, Screen, TopNav } from "@/src/ui/components";
import { CropArtwork } from "@/src/ui/cropArtwork";
import { theme } from "@/src/ui/theme";

export default function CropProfitScreen() {
  const sqlite = useSQLiteContext();
  const [items, setItems] = useState<readonly CropProfitSummary[]>([]);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      const db = mobileDatabase(sqlite);
      const identity = await loadFarmIdentity(db);
      if (identity === null) {
        router.replace("/onboarding");
        return;
      }
      setItems(await loadCropProfitSummaries(db, identity.farmId));
      setError(undefined);
    } catch {
      setItems([]);
      setError("Ürün hesabını şu an gösteremedik. Kayıtların güvende.");
    }
  }, [sqlite]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  return (
    <Screen>
      <PageTitle hint="Her ürünün net durumunu ayrı gör.">Ürünler</PageTitle>

      <TopNav
        active="crops"
        onLedger={() => router.replace("/home")}
        onCrops={() => undefined}
        onPartners={() => router.replace("/partners")}
      />

      <View style={styles.list}>
        {items.map((item, index) => (
          <View key={item.cropCode} style={[styles.row, index > 0 && styles.divider]}>
            <CropArtwork cropCode={item.cropCode} size={58} />
            <View style={styles.copy}>
              <Text accessibilityRole="header" style={styles.name}>{item.cropLabel}</Text>
              <Text style={styles.meta}>
                Gelir {formatTry(item.summary.income)} · Gider {formatTry(item.summary.expense)}
              </Text>
            </View>
            <View style={styles.amountBlock}>
              <Text style={styles.amountLabel}>Kalan</Text>
              <Text style={[
                styles.amount,
                item.summary.net < 0 && styles.negative,
                item.summary.net > 0 && styles.positive
              ]}>{formatTry(item.summary.net)}</Text>
            </View>
          </View>
        ))}
      </View>

      {items.length === 0 && !error ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Henüz ürün hesabı yok</Text>
          <Text style={styles.emptyText}>Ürüne bağlı kayıt girdikçe burada oluşur.</Text>
        </View>
      ) : null}

      {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.divider,
    marginTop: 10
  },
  row: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14
  },
  divider: { borderTopWidth: 1, borderTopColor: theme.color.divider },
  copy: { flex: 1, gap: 5 },
  name: { color: theme.color.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.2 },
  meta: { color: theme.color.textMuted, fontSize: 12, fontWeight: "600", lineHeight: 18 },
  amountBlock: { alignItems: "flex-end", gap: 3 },
  amountLabel: { color: theme.color.textSubtle, fontSize: 11, fontWeight: "700" },
  amount: { color: theme.color.text, fontSize: 17, fontWeight: "900" },
  positive: { color: theme.color.income },
  negative: { color: theme.color.expense },
  empty: {
    minHeight: 140,
    justifyContent: "center",
    gap: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.divider
  },
  emptyTitle: { color: theme.color.text, fontSize: 18, fontWeight: "900" },
  emptyText: { color: theme.color.textMuted, fontSize: 14, fontWeight: "600" },
  error: { color: theme.color.expense, fontSize: 15, fontWeight: "700", lineHeight: 22 }
});
