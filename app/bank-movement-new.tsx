import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { loadFarmIdentity, type FarmIdentity } from "@/src/application/appSnapshot";
import { LocalBankMovementRepository } from "@/src/application/localBankMovementRepository";
import {
  bankMovementKinds,
  bankMovementLabel,
  createBankMovement,
  type BankMovementKind
} from "@/src/domain/bankMovement";
import { moneyFromUserInput } from "@/src/domain/money";
import { dateInputFromIso, isoDateFromTurkishInput, todayIsoLocal } from "@/src/mobile/date";
import { mobileDatabase } from "@/src/mobile/database";
import { createLocalId } from "@/src/mobile/id";
import { BigButton, ChoiceCard, ErrorNote, Field, PageTitle, Screen, SecondaryButton, SectionTitle } from "@/src/ui/components";
import { theme } from "@/src/ui/theme";

export default function BankMovementNewScreen() {
  const sqlite = useSQLiteContext();
  const [identity, setIdentity] = useState<FarmIdentity | null>(null);
  const [kind, setKind] = useState<BankMovementKind>("withdrawal");
  const [amountText, setAmountText] = useState("");
  const [dateText, setDateText] = useState(() => dateInputFromIso(todayIsoLocal()));
  const [bankName, setBankName] = useState("");
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
        if (active) setError("Çiftlik bilgini şu an okuyamadık. Banka hareketi kaydedilmedi.");
      }
    })();
    return () => { active = false; };
  }, [sqlite]));

  const save = async () => {
    if (savingRef.current || identity === null) return;
    setError(undefined);

    let amountKurus: number;
    try {
      amountKurus = moneyFromUserInput(amountText);
    } catch {
      setError("Tutarı kontrol et.");
      return;
    }

    let occurredOn: string;
    try {
      occurredOn = isoDateFromTurkishInput(dateText);
    } catch {
      setError("Tarihi GG.AA.YYYY şeklinde kontrol et.");
      return;
    }

    let movement: ReturnType<typeof createBankMovement>;
    try {
      movement = createBankMovement({
        id: createLocalId("bankmove"),
        kind,
        amountKurus,
        occurredOn,
        ...(bankName.trim().length === 0 ? {} : { bankName }),
        ...(note.trim().length === 0 ? {} : { note })
      });
    } catch {
      setError("Banka adı veya not bilgisini kontrol et.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      await new LocalBankMovementRepository(mobileDatabase(sqlite)).add({
        farmId: identity.farmId,
        movement,
        nowIso: new Date().toISOString()
      });
      router.replace("/bank-movements");
    } catch {
      setError("Banka hareketini şu an kaydedemedik. Bilgilerin silinmedi; tekrar deneyebilirsin.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Screen>
      <PageTitle hint="Yalnız bankadaki para hareketini kaydet.">Banka hareketi ekle</PageTitle>

      <SectionTitle>Ne yaptın?</SectionTitle>
      {bankMovementKinds.map((movementKind) => (
        <ChoiceCard
          key={movementKind}
          label={bankMovementLabel(movementKind)}
          caption={movementKind === "withdrawal" ? "Bankadaki paranı eline aldın." : "Elindeki parayı bankaya koydun."}
          selected={kind === movementKind}
          onPress={() => setKind(movementKind)}
        />
      ))}

      <Field
        label="Tutar"
        value={amountText}
        onChangeText={setAmountText}
        placeholder="Örnek: 25.000"
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
        label="Hangi banka?"
        hint="İsteğe bağlı"
        value={bankName}
        onChangeText={setBankName}
        placeholder="Örnek: Ziraat Bankası"
        autoCapitalize="words"
        maxLength={100}
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

      <Text style={styles.explanation}>
        Bu kayıt gelir veya gider değildir. Defterindeki kâr-zarar hesabını değiştirmez.
      </Text>

      <ErrorNote message={error} />
      <BigButton
        label={saving ? "Kaydediliyor…" : "Hareketi kaydet"}
        icon="✓"
        disabled={saving || identity === null}
        onPress={() => void save()}
      />
      <SecondaryButton label="Vazgeç" disabled={saving} onPress={() => router.replace("/bank-movements")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  explanation: { color: theme.color.textMuted, fontSize: 13, fontWeight: "600", lineHeight: 19 }
});
