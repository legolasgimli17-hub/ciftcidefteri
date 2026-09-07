import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useRef, useState } from "react";
import { Text } from "react-native";
import { loadFarmIdentity } from "@/src/application/appSnapshot";
import { LocalInventoryRepository, type InventoryBalance } from "@/src/application/localInventoryRepository";
import {
  createInventoryMovement,
  formatInventoryQuantity,
  parseInventoryMovementKind,
  quantityMilliFromUserInput,
  type InventoryMovementKind
} from "@/src/domain/inventory";
import { mobileDatabase } from "@/src/mobile/database";
import { dateInputFromIso, isoDateFromTurkishInput, todayIsoLocal } from "@/src/mobile/date";
import { createLocalId } from "@/src/mobile/id";
import { BigButton, ErrorNote, Field, PageTitle, Screen, SecondaryButton } from "@/src/ui/components";
import { theme } from "@/src/ui/theme";

export default function InventoryMovementScreen() {
  const params = useLocalSearchParams<{ id?: string; kind?: string }>();
  const sqlite = useSQLiteContext();
  const [farmId, setFarmId] = useState<string>();
  const [balance, setBalance] = useState<InventoryBalance>();
  const [quantityText, setQuantityText] = useState("");
  const [dateText, setDateText] = useState(() => dateInputFromIso(todayIsoLocal()));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  let movementKind: InventoryMovementKind | undefined;
  try {
    if (params.kind !== undefined) movementKind = parseInventoryMovementKind(params.kind);
  } catch {
    movementKind = undefined;
  }

  const refresh = useCallback(async () => {
    if (!params.id || movementKind === undefined) {
      setError("Hareket bilgisi bulunamadı.");
      return;
    }
    try {
      const db = mobileDatabase(sqlite);
      const identity = await loadFarmIdentity(db);
      if (identity === null) {
        router.replace("/onboarding");
        return;
      }
      const detail = await new LocalInventoryRepository(db).load(identity.farmId, params.id);
      setFarmId(identity.farmId);
      setBalance(detail.balance);
      setError(undefined);
    } catch {
      setError("Kayıt bilgilerini şu an okuyamadık. Miktar değiştirilmedi.");
    }
  }, [movementKind, params.id, sqlite]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const save = async () => {
    if (savingRef.current || farmId === undefined || balance === undefined || movementKind === undefined) return;
    setError(undefined);

    let quantityMilli: number;
    try {
      quantityMilli = quantityMilliFromUserInput(quantityText);
    } catch {
      setError("Miktarı 12 veya 12,5 gibi kontrol et.");
      return;
    }
    if (movementKind === "decrease" && quantityMilli > balance.remainingQuantityMilli) {
      setError(`Elinde ${formatInventoryQuantity(balance.remainingQuantityMilli, balance.item.unit)} var. Bundan fazlasını azaltamazsın.`);
      return;
    }

    let occurredOn: string;
    try {
      occurredOn = isoDateFromTurkishInput(dateText);
    } catch {
      setError("Tarihi GG.AA.YYYY şeklinde kontrol et.");
      return;
    }

    let movement: ReturnType<typeof createInventoryMovement>;
    try {
      movement = createInventoryMovement({
        id: createLocalId("stockmove"),
        itemId: balance.item.id,
        kind: movementKind,
        quantityMilli,
        occurredOn,
        ...(note.trim().length === 0 ? {} : { note })
      });
    } catch {
      setError("Miktar veya not bilgisini kontrol et.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      await new LocalInventoryRepository(mobileDatabase(sqlite)).addMovement({
        farmId,
        movement,
        nowIso: new Date().toISOString()
      });
      router.replace({ pathname: "/inventory-detail", params: { id: balance.item.id } });
    } catch {
      setError(movementKind === "decrease"
        ? "Miktarı azaltamadık. Elindekinden fazla çıkış olmadığını kontrol et."
        : "Miktarı ekleyemedik. Bilgilerin silinmedi; tekrar deneyebilirsin.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const title = movementKind === "decrease" ? "Miktar azalt" : "Miktar ekle";
  const hint = balance
    ? `${balance.item.name} · şu an ${formatInventoryQuantity(balance.remainingQuantityMilli, balance.item.unit)}`
    : "Kayıt hazırlanıyor…";

  return (
    <Screen>
      <PageTitle hint={hint}>{title}</PageTitle>

      <Field
        label={movementKind === "decrease" ? "Ne kadar azaldı?" : "Ne kadar eklendi?"}
        value={quantityText}
        onChangeText={setQuantityText}
        placeholder="Örnek: 25,5"
        keyboardType="decimal-pad"
      />
      <Field
        label="Tarih"
        value={dateText}
        onChangeText={setDateText}
        placeholder="GG.AA.YYYY"
        keyboardType="numbers-and-punctuation"
      />
      <Field
        label="Not"
        hint="İsteğe bağlı"
        value={note}
        onChangeText={setNote}
        placeholder={movementKind === "decrease" ? "Örnek: Tarlada kullandım" : "Örnek: Yeni geldi"}
        maxLength={180}
        multiline
      />

      <Text style={{ color: theme.color.textMuted, fontSize: 13, fontWeight: "600", lineHeight: 19 }}>
        Bu miktar hareketi para defterine gelir veya gider yazmaz.
      </Text>

      <ErrorNote message={error} />
      <BigButton
        label={saving ? "Kaydediliyor…" : "Kaydet"}
        icon="✓"
        disabled={saving || farmId === undefined || balance === undefined || movementKind === undefined}
        onPress={() => void save()}
      />
      <SecondaryButton
        label="Vazgeç"
        disabled={saving}
        onPress={() => balance
          ? router.replace({ pathname: "/inventory-detail", params: { id: balance.item.id } })
          : router.replace("/inventory")}
      />
    </Screen>
  );
}
