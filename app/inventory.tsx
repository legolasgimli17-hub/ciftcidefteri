import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { loadFarmIdentity, type FarmIdentity } from "@/src/application/appSnapshot";
import { LocalInventoryRepository, type InventoryBalance } from "@/src/application/localInventoryRepository";
import { formatInventoryQuantity, inventoryItemKindLabel } from "@/src/domain/inventory";
import { mobileDatabase } from "@/src/mobile/database";
import { BigButton, Card, ErrorNote, PageTitle, Screen, SecondaryButton, SectionTitle } from "@/src/ui/components";
import { theme } from "@/src/ui/theme";

export default function InventoryScreen() {
  const sqlite = useSQLiteContext();
  const [identity, setIdentity] = useState<FarmIdentity | null>(null);
  const [balances, setBalances] = useState<readonly InventoryBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const db = mobileDatabase(sqlite);
      const loadedIdentity = await loadFarmIdentity(db);
      if (loadedIdentity === null) {
        router.replace("/onboarding");
        return;
      }
      setIdentity(loadedIdentity);
      setBalances(await new LocalInventoryRepository(db).listBalances(loadedIdentity.farmId));
    } catch {
      setError("Elindekileri şu an gösteremedik. Kayıtların değiştirilmedi.");
    } finally {
      setLoading(false);
    }
  }, [sqlite]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  return (
    <Screen>
      <PageTitle hint={identity ? `${identity.profile.name} · ürün ve girdiler` : "Kayıtların hazırlanıyor…"}>
        Elindekiler
      </PageTitle>

      <BigButton label="Ürün veya girdi ekle" icon="+" onPress={() => router.push("/inventory-new")} />

      {!loading ? <SectionTitle detail={`${balances.length} kayıt`}>Ne kadar kaldı?</SectionTitle> : null}

      {loading && balances.length === 0 ? <Text style={styles.muted}>Elindekiler hazırlanıyor…</Text> : null}

      {!loading && balances.length === 0 && !error ? (
        <Card tone="soft">
          <Text style={styles.emptyTitle}>Henüz kayıt yok</Text>
          <Text style={styles.muted}>Buğday, gübre, mazot gibi elinde olanları ekleyip kalan miktarı takip edebilirsin.</Text>
        </Card>
      ) : null}

      {balances.map((balance) => (
        <Card key={balance.item.id}>
          <View style={styles.cardHead}>
            <View style={styles.copy}>
              <Text style={styles.name}>{balance.item.name}</Text>
              <Text style={styles.kind}>{inventoryItemKindLabel(balance.item.kind)}</Text>
            </View>
            <View style={styles.amountBlock}>
              <Text style={styles.amountLabel}>Kalan</Text>
              <Text style={styles.amount}>
                {formatInventoryQuantity(balance.remainingQuantityMilli, balance.item.unit)}
              </Text>
            </View>
          </View>
          <SecondaryButton
            label="Ayrıntıları aç"
            onPress={() => router.push({ pathname: "/inventory-detail", params: { id: balance.item.id } })}
          />
        </Card>
      ))}

      <ErrorNote message={error} />
      <SecondaryButton label="Daha'ya dön" onPress={() => router.replace("/more")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: theme.color.textMuted, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  emptyTitle: { color: theme.color.text, fontSize: 18, fontWeight: "900" },
  cardHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  copy: { flex: 1, gap: 3 },
  name: { color: theme.color.text, fontSize: 18, fontWeight: "900" },
  kind: { color: theme.color.textMuted, fontSize: 13, fontWeight: "700" },
  amountBlock: { alignItems: "flex-end", gap: 2 },
  amountLabel: { color: theme.color.textMuted, fontSize: 12, fontWeight: "700" },
  amount: { color: theme.color.text, fontSize: 18, fontWeight: "900" }
});
