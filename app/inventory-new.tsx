import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useRef, useState } from "react";
import { Text } from "react-native";
import { loadFarmIdentity, type FarmIdentity } from "@/src/application/appSnapshot";
import { LocalInventoryRepository } from "@/src/application/localInventoryRepository";
import {
  createInventoryItem,
  createInventoryMovement,
  inventoryItemKinds,
  inventoryItemKindLabel,
  inventoryUnitLabel,
  inventoryUnits,
  quantityMilliFromUserInput,
  type InventoryItemKind,
  type InventoryUnit
} from "@/src/domain/inventory";
import { mobileDatabase } from "@/src/mobile/database";
import { dateInputFromIso, isoDateFromTurkishInput, todayIsoLocal } from "@/src/mobile/date";
import { createLocalId } from "@/src/mobile/id";
import { BigButton, ChoiceCard, ErrorNote, Field, PageTitle, Screen, SecondaryButton, SectionTitle } from "@/src/ui/components";
import { theme } from "@/src/ui/theme";

export default function InventoryNewScreen() {
  const sqlite = useSQLiteContext();
  const [identity, setIdentity] = useState<FarmIdentity | null>(null);
  const [kind, setKind] = useState<InventoryItemKind>("product");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<InventoryUnit>("kg");
  const [quantityText, setQuantityText] = useState("");
  const [dateText, setDateText] = useState(() => dateInputFromIso(todayIsoLocal()));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    void (async () => {
      try {
        const loaded = await loadFarmIdentity(mobileDatabase(sqlite));
        if (!active) return;
        if (loaded === null) {
          router.replace("/onboarding");
          return;
        }
        setIdentity(loaded);
      } catch {
        if (active) setError("Çiftlik bilgini şu an okuyamadık. Kayıt yapılmadı.");
      }
    })();
    return () => { active = false; };
  }, [sqlite]));

  const save = async () => {
    if (savingRef.current || identity === null) return;
    setError(undefined);

    let quantityMilli: number;
    try {
      quantityMilli = quantityMilliFromUserInput(quantityText);
    } catch {
      setError("Miktarı 12 veya 12,5 gibi kontrol et.");
      return;
    }

    let occurredOn: string;
    try {
      occurredOn = isoDateFromTurkishInput(dateText);
    } catch {
      setError("Tarihi GG.AA.YYYY şeklinde kontrol et.");
      return;
    }

    const itemId = createLocalId("stockitem");
    let item: ReturnType<typeof createInventoryItem>;
    let openingMovement: ReturnType<typeof createInventoryMovement>;
    try {
      item = createInventoryItem({ id: itemId, kind, name, unit });
      openingMovement = createInventoryMovement({
        id: createLocalId("stockmove"),
        itemId,
        kind: "increase",
        quantityMilli,
        occurredOn,
        ...(note.trim().length === 0 ? {} : { note })
      });
    } catch {
      setError("Ad, birim veya not bilgisini kontrol et.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      await new LocalInventoryRepository(mobileDatabase(sqlite)).addItemWithOpening({
        farmId: identity.farmId,
        item,
        openingMovement,
        nowIso: new Date().toISOString()
      });
      router.replace("/inventory");
    } catch {
      setError("Kaydı ekleyemedik. Aynı ad ve birimde bir kayıt varsa onu açıp miktar ekleyebilirsin.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Screen>
      <PageTitle hint="Elinde ne olduğunu ve şu anki miktarını yaz.">Ürün veya girdi ekle</PageTitle>

      <SectionTitle>Bu ne?</SectionTitle>
      {inventoryItemKinds.map((itemKind) => (
        <ChoiceCard
          key={itemKind}
          label={inventoryItemKindLabel(itemKind)}
          caption={itemKind === "product" ? "Hasat ettiğin veya elinde tuttuğun ürün." : "Gübre, mazot ve kullandığın diğer şeyler."}
          selected={kind === itemKind}
          onPress={() => setKind(itemKind)}
        />
      ))}

      <Field
        label="Adı"
        value={name}
        onChangeText={setName}
        placeholder={kind === "product" ? "Örnek: Buğday" : "Örnek: Üre gübresi"}
        autoCapitalize="words"
        maxLength={80}
      />

      <SectionTitle>Nasıl sayıyorsun?</SectionTitle>
      {inventoryUnits.map((itemUnit) => (
        <ChoiceCard
          key={itemUnit}
          label={inventoryUnitLabel(itemUnit)}
          selected={unit === itemUnit}
          onPress={() => setUnit(itemUnit)}
        />
      ))}

      <Field
        label="Şu an ne kadar var?"
        value={quantityText}
        onChangeText={setQuantityText}
        placeholder="Örnek: 125,5"
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
        placeholder="Kısa bir not"
        maxLength={180}
        multiline
      />

      <Text style={{ color: theme.color.textMuted, fontSize: 13, fontWeight: "600", lineHeight: 19 }}>
        Bu kayıt hep seçtiğin birimle takip edilir. Miktar hareketleri para defterindeki kâr-zararı değiştirmez.
      </Text>

      <ErrorNote message={error} />
      <BigButton
        label={saving ? "Kaydediliyor…" : "Kaydet"}
        icon="✓"
        disabled={saving || identity === null}
        onPress={() => void save()}
      />
      <SecondaryButton label="Vazgeç" disabled={saving} onPress={() => router.replace("/inventory")} />
    </Screen>
  );
}
