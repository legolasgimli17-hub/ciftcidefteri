import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { loadFarmIdentity } from "@/src/application/appSnapshot";
import { loadCropProfitSummaries, type CropProfitSummary } from "@/src/application/cropProfit";
import { formatTry } from "@/src/domain/money";
import { mobileDatabase } from "@/src/mobile/database";
import { Card, PageTitle, Screen, SecondaryButton } from "@/src/ui/components";
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
      const loaded = await loadCropProfitSummaries(db, identity.farmId);
      setItems(loaded);
      setError(undefined);
    } catch {
      setItems([]);
      setError("Ürünlerinin durumunu şu an gösteremedik. Kayıtların güvende.");
    }
  }, [sqlite]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  return (
    <Screen>
      <PageTitle hint="Her ürün için giren, çıkan ve elinde kalanı gör.">
        Ürünlerin durumu
      </PageTitle>

      {items.map((item) => (
        <Card key={item.cropCode}>
          <Text accessibilityRole="header" style={styles.cropName}>{item.cropLabel}</Text>
          <Text style={styles.netLabel}>Kalan</Text>
          <Text style={[
            styles.netAmount,
            item.summary.net > 0 && styles.positive,
            item.summary.net < 0 && styles.negative
          ]}>
            {formatTry(item.summary.net)}
          </Text>
          <View style={styles.rows}>
            <Text style={styles.income}>Giren: {formatTry(item.summary.income)}</Text>
            <Text style={styles.expense}>Çıkan: {formatTry(item.summary.expense)}</Text>
          </View>
        </Card>
      ))}

      {items.length === 0 && !error ? (
        <Card>
          <Text style={styles.empty}>Ürün kaydı bulunamadı.</Text>
        </Card>
      ) : null}

      {error ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>
      ) : null}

      <SecondaryButton label="Deftere dön" onPress={() => router.replace("/home")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cropName: { color: theme.color.text, fontSize: 22, fontWeight: "900" },
  netLabel: { color: theme.color.textMuted, fontSize: 16, fontWeight: "700" },
  netAmount: { color: theme.color.text, fontSize: 32, fontWeight: "900", letterSpacing: -0.5 },
  positive: { color: theme.color.income },
  negative: { color: theme.color.expense },
  rows: { flexDirection: "row", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  income: { color: theme.color.income, fontSize: 17, fontWeight: "800" },
  expense: { color: theme.color.expense, fontSize: 17, fontWeight: "800" },
  empty: { color: theme.color.textMuted, fontSize: 17, fontWeight: "700", lineHeight: 24 },
  error: { color: theme.color.expense, fontSize: 16, fontWeight: "700", lineHeight: 22 }
});
