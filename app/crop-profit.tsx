import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { loadFarmIdentity } from "@/src/application/appSnapshot";
import { loadCropProfitSummaries, type CropProfitSummary } from "@/src/application/cropProfit";
import { formatTry } from "@/src/domain/money";
import { mobileDatabase } from "@/src/mobile/database";
import { Card, PageTitle, Pill, Screen, SecondaryButton, SectionTitle } from "@/src/ui/components";
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
      <PageTitle hint="Hangi ürün para kazandırıyor, hangisi masraf çıkarıyor tek bakışta gör.">
        Ürün hesabı
      </PageTitle>

      {items.length > 0 ? <SectionTitle detail={`${items.length} ürün`}>Ürünlerin</SectionTitle> : null}

      {items.map((item) => {
        const tone = item.summary.net > 0 ? "income" : item.summary.net < 0 ? "expense" : "neutral";
        const status = item.summary.net > 0 ? "Artıda" : item.summary.net < 0 ? "Ekside" : "Dengede";
        return (
          <Card key={item.cropCode}>
            <View style={styles.cropHeader}>
              <CropArtwork cropCode={item.cropCode} />
              <View style={styles.cropHeaderCopy}>
                <Text accessibilityRole="header" style={styles.cropName}>{item.cropLabel}</Text>
                <Pill label={status} tone={tone} />
              </View>
            </View>

            <View style={styles.netBlock}>
              <Text style={styles.netLabel}>Bu üründe kalan</Text>
              <Text style={[
                styles.netAmount,
                item.summary.net > 0 && styles.positive,
                item.summary.net < 0 && styles.negative
              ]}>
                {formatTry(item.summary.net)}
              </Text>
            </View>

            <View style={styles.metricRow}>
              <View style={[styles.metricBox, styles.incomeBox]}>
                <Text style={styles.metricLabel}>GELEN</Text>
                <Text style={[styles.metricAmount, styles.positive]}>{formatTry(item.summary.income)}</Text>
              </View>
              <View style={[styles.metricBox, styles.expenseBox]}>
                <Text style={styles.metricLabel}>HARCANAN</Text>
                <Text style={[styles.metricAmount, styles.negative]}>{formatTry(item.summary.expense)}</Text>
              </View>
            </View>
          </Card>
        );
      })}

      {items.length === 0 && !error ? (
        <Card tone="soft">
          <Text style={styles.emptyTitle}>Henüz ürün hesabı oluşmadı</Text>
          <Text style={styles.empty}>Ürüne bağlı bir gelir veya gider eklediğinde burada görünür.</Text>
        </Card>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>
        </View>
      ) : null}

      <SecondaryButton label="Deftere dön" onPress={() => router.replace("/home")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cropHeader: { flexDirection: "row", alignItems: "center", gap: 14 },
  cropHeaderCopy: { flex: 1, gap: 8 },
  cropName: { color: theme.color.text, fontSize: 23, fontWeight: "900", letterSpacing: -0.35 },
  netBlock: { gap: 4, paddingTop: 2 },
  netLabel: { color: theme.color.textMuted, fontSize: 14, fontWeight: "700" },
  netAmount: { color: theme.color.text, fontSize: 34, fontWeight: "900", letterSpacing: -0.9 },
  positive: { color: theme.color.income },
  negative: { color: theme.color.expense },
  metricRow: { flexDirection: "row", gap: 10 },
  metricBox: { flex: 1, borderRadius: theme.radius.md, padding: 14, gap: 7 },
  incomeBox: { backgroundColor: theme.color.incomeSoft },
  expenseBox: { backgroundColor: theme.color.expenseSoft },
  metricLabel: { color: theme.color.textMuted, fontSize: 11, fontWeight: "900", letterSpacing: 0.7 },
  metricAmount: { fontSize: 16, fontWeight: "900" },
  emptyTitle: { color: theme.color.text, fontSize: 18, fontWeight: "900" },
  empty: { color: theme.color.textMuted, fontSize: 16, fontWeight: "600", lineHeight: 23 },
  errorBox: { backgroundColor: theme.color.expenseSoft, borderRadius: theme.radius.sm, padding: 14 },
  error: { color: theme.color.expense, fontSize: 15, fontWeight: "700", lineHeight: 22 }
});
