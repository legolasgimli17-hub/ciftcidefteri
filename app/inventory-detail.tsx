import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { loadFarmIdentity } from "@/src/application/appSnapshot";
import { LocalInventoryRepository, type InventoryDetail } from "@/src/application/localInventoryRepository";
import {
  formatInventoryQuantity,
  inventoryItemKindLabel,
  inventoryMovementLabel,
  inventoryUnitLabel,
  type InventoryMovement
} from "@/src/domain/inventory";
import { mobileDatabase } from "@/src/mobile/database";
import { dateInputFromIso } from "@/src/mobile/date";
import { BigButton, Card, ErrorNote, PageTitle, Screen, SecondaryButton, SectionTitle } from "@/src/ui/components";
import { uxPolicy } from "@/src/ui/policy";
import { theme } from "@/src/ui/theme";

export default function InventoryDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const sqlite = useSQLiteContext();
  const [farmId, setFarmId] = useState<string>();
  const [detail, setDetail] = useState<InventoryDetail>();
  const [lastDeleted, setLastDeleted] = useState<InventoryMovement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const busyRef = useRef(false);

  const refresh = useCallback(async () => {
    const itemId = params.id;
    if (!itemId) {
      setError("Kayıt bilgisi bulunamadı.");
      return;
    }
    try {
      const db = mobileDatabase(sqlite);
      const identity = await loadFarmIdentity(db);
      if (identity === null) {
        router.replace("/onboarding");
        return;
      }
      setFarmId(identity.farmId);
      setDetail(await new LocalInventoryRepository(db).load(identity.farmId, itemId));
      setError(undefined);
    } catch {
      setError("Ayrıntıları şu an gösteremedik. Kayıtların değiştirilmedi.");
    }
  }, [params.id, sqlite]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const deleteMovement = async (movement: InventoryMovement) => {
    if (busyRef.current || farmId === undefined || detail === undefined) return;
    busyRef.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const deleted = await new LocalInventoryRepository(mobileDatabase(sqlite)).softDeleteMovement({
        farmId,
        itemId: detail.balance.item.id,
        movementId: movement.id,
        nowIso: new Date().toISOString()
      });
      if (!deleted) {
        setError("Bu hareket zaten silinmiş veya bulunamadı.");
        return;
      }
      setLastDeleted(movement);
      await refresh();
    } catch {
      setError("Bu hareketi silemedik. Silmek kalan miktarı eksiye düşürecekse önce sonraki çıkışları düzelt.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const restoreLastDeleted = async () => {
    if (busyRef.current || farmId === undefined || detail === undefined || lastDeleted === null) return;
    busyRef.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const restored = await new LocalInventoryRepository(mobileDatabase(sqlite)).restoreMovement({
        farmId,
        itemId: detail.balance.item.id,
        movementId: lastDeleted.id,
        nowIso: new Date().toISOString()
      });
      if (!restored) {
        setLastDeleted(null);
        setError("Bu hareketi geri alamadık. Listeyi yenileyip tekrar deneyebilirsin.");
        return;
      }
      setLastDeleted(null);
      await refresh();
    } catch {
      setError("Hareketi geri alamadık. Kalan miktar eksiye düşecekse önce diğer hareketleri düzelt.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const deleteItem = async () => {
    if (busyRef.current || farmId === undefined || detail === undefined) return;
    busyRef.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await new LocalInventoryRepository(mobileDatabase(sqlite)).deleteItemWithoutMovements({
        farmId,
        itemId: detail.balance.item.id,
        nowIso: new Date().toISOString()
      });
      router.replace("/inventory");
    } catch {
      setError("Kaydı silemedik. Önce aktif miktar hareketlerini düzelt.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const askDeleteMovement = (movement: InventoryMovement) => {
    if (busyRef.current || detail === undefined) return;
    Alert.alert(
      "Bu hareket silinsin mi?",
      `${inventoryMovementLabel(movement.kind)} · ${formatInventoryQuantity(movement.quantityMilli, detail.balance.item.unit)}`,
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Sil", style: "destructive", onPress: () => void deleteMovement(movement) }
      ]
    );
  };

  const askDeleteItem = () => {
    Alert.alert(
      "Bu kayıt silinsin mi?",
      "Yalnız aktif miktar hareketi kalmadıysa kayıt kaldırılır.",
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Kaydı sil", style: "destructive", onPress: () => void deleteItem() }
      ]
    );
  };

  if (detail === undefined) {
    return (
      <Screen>
        <PageTitle hint="Kayıt hazırlanıyor.">Elindekiler</PageTitle>
        <ErrorNote message={error} />
        <SecondaryButton label="Elindekilere dön" onPress={() => router.replace("/inventory")} />
      </Screen>
    );
  }

  const { balance, movements } = detail;

  return (
    <Screen>
      <PageTitle hint={`${inventoryItemKindLabel(balance.item.kind)} · ${inventoryUnitLabel(balance.item.unit)}`}>
        {balance.item.name}
      </PageTitle>

      <View style={styles.balanceBlock}>
        <Text style={styles.balanceLabel}>Kalan</Text>
        <Text style={styles.balanceAmount}>
          {formatInventoryQuantity(balance.remainingQuantityMilli, balance.item.unit)}
        </Text>
      </View>

      <BigButton
        label="Miktar ekle"
        icon="+"
        kind="neutral"
        disabled={busy}
        onPress={() => router.push({ pathname: "/inventory-movement", params: { id: balance.item.id, kind: "increase" } })}
      />
      <SecondaryButton
        label="Miktar azalt"
        disabled={busy || balance.remainingQuantityMilli === 0}
        onPress={() => router.push({ pathname: "/inventory-movement", params: { id: balance.item.id, kind: "decrease" } })}
      />

      {lastDeleted !== null ? (
        <View style={styles.undo}>
          <View style={styles.undoCopy}>
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.undoTitle}>Hareket silindi</Text>
            <Text style={styles.muted}>
              {inventoryMovementLabel(lastDeleted.kind)} · {formatInventoryQuantity(lastDeleted.quantityMilli, balance.item.unit)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Silinen hareketi geri al"
            disabled={busy}
            onPress={() => void restoreLastDeleted()}
            style={styles.undoButton}
          >
            <Text style={styles.undoButtonText}>{busy ? "Alınıyor…" : "Geri al"}</Text>
          </Pressable>
        </View>
      ) : null}

      <SectionTitle detail={`${movements.length} kayıt`}>Miktar hareketleri</SectionTitle>
      {movements.length === 0 ? (
        <Card tone="soft">
          <Text style={styles.emptyTitle}>Aktif hareket kalmadı</Text>
          <Text style={styles.muted}>İstersen bu kaydı tamamen kaldırabilirsin.</Text>
        </Card>
      ) : null}

      {movements.map((movement) => (
        <Card key={movement.id}>
          <View style={styles.movementHead}>
            <View style={styles.movementCopy}>
              <Text style={styles.movementKind}>{inventoryMovementLabel(movement.kind)}</Text>
              <Text style={styles.muted}>{dateInputFromIso(movement.occurredOn)}</Text>
            </View>
            <Text style={styles.movementAmount}>
              {movement.kind === "increase" ? "+" : "−"}{formatInventoryQuantity(movement.quantityMilli, balance.item.unit)}
            </Text>
          </View>
          {movement.note ? <Text style={styles.note}>{movement.note}</Text> : null}
          <SecondaryButton label="Bu hareketi sil" disabled={busy} onPress={() => askDeleteMovement(movement)} />
        </Card>
      ))}

      <ErrorNote message={error} />
      {movements.length === 0 ? (
        <SecondaryButton label="Bu kaydı sil" disabled={busy} onPress={askDeleteItem} />
      ) : null}
      <SecondaryButton label="Elindekilere dön" disabled={busy} onPress={() => router.replace("/inventory")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  balanceBlock: {
    gap: 5,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.divider
  },
  balanceLabel: { color: theme.color.textMuted, fontSize: 13, fontWeight: "700" },
  balanceAmount: { color: theme.color.text, fontSize: 34, lineHeight: 42, fontWeight: "900", letterSpacing: -0.8 },
  muted: { color: theme.color.textMuted, fontSize: 13, fontWeight: "600", lineHeight: 19 },
  undo: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.divider
  },
  undoCopy: { flex: 1, gap: 2 },
  undoTitle: { color: theme.color.text, fontSize: 15, fontWeight: "800" },
  undoButton: { minWidth: 72, minHeight: uxPolicy.minimumTouchTargetPx, alignItems: "center", justifyContent: "center" },
  undoButtonText: { color: theme.color.primary, fontSize: 14, fontWeight: "800" },
  emptyTitle: { color: theme.color.text, fontSize: 17, fontWeight: "900" },
  movementHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  movementCopy: { flex: 1, gap: 3 },
  movementKind: { color: theme.color.text, fontSize: 16, fontWeight: "900" },
  movementAmount: { color: theme.color.text, fontSize: 16, fontWeight: "900" },
  note: { color: theme.color.textMuted, fontSize: 13, fontWeight: "600", lineHeight: 19 }
});
