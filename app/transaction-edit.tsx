import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import { loadFarmIdentity, type FarmIdentity } from "@/src/application/appSnapshot";
import { LocalTransactionCorrections } from "@/src/application/transactionCorrections";
import { transactionAmountFromInput } from "@/src/application/transactionFlow";
import { previousEditTransactionStep, type EditTransactionStep } from "@/src/application/wizardBack";
import {
  commonExpenseCategories,
  commonIncomeCategories,
  isTaxExemptPublicAgriculturalSupport
} from "@/src/domain/categories";
import { cropTemplates, expenseSuggestionsFor, type CropCode } from "@/src/domain/crops";
import { createFarmTransaction, type FarmTransaction } from "@/src/domain/transaction";
import { mobileDatabase } from "@/src/mobile/database";
import { dateInputFromIso, isoDateFromTurkishInput } from "@/src/mobile/date";
import { BigButton, ChoiceCard, ErrorNote, Field, PageTitle, Screen, SecondaryButton } from "@/src/ui/components";
import { theme } from "@/src/ui/theme";

type Step = EditTransactionStep;
type ReturnPath = "/home" | "/transactions";

export default function TransactionEditScreen() {
  const params = useLocalSearchParams<{ id?: string; returnTo?: string }>();
  const sqlite = useSQLiteContext();
  const [identity, setIdentity] = useState<FarmIdentity | null>(null);
  const [original, setOriginal] = useState<FarmTransaction | null>(null);
  const [step, setStep] = useState<Step>("details");
  const [amountText, setAmountText] = useState("");
  const [dateText, setDateText] = useState("");
  const [cropCode, setCropCode] = useState<CropCode>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const returnPath: ReturnPath = params.returnTo === "transactions" ? "/transactions" : "/home";

  useEffect(() => {
    let active = true;
    const load = async () => {
      const transactionId = params.id;
      if (transactionId === undefined) {
        if (active) {
          setError("Düzeltilecek kayıt bulunamadı.");
          setLoading(false);
        }
        return;
      }

      try {
        const database = mobileDatabase(sqlite);
        const loadedIdentity = await loadFarmIdentity(database);
        if (loadedIdentity === null) {
          if (active) setError("Çiftlik bilgini okuyamadık.");
          return;
        }
        const loadedTransaction = await new LocalTransactionCorrections(database).getActiveTransaction({
          farmId: loadedIdentity.farmId,
          transactionId
        });
        if (!active) return;
        if (loadedTransaction === null) {
          setError("Bu kayıt bulunamadı veya daha önce silinmiş.");
          return;
        }
        setIdentity(loadedIdentity);
        setOriginal(loadedTransaction);
        setAmountText(amountTextFromKurus(loadedTransaction.amountKurus));
        setDateText(dateInputFromIso(loadedTransaction.occurredOn));
        setCropCode(loadedTransaction.cropCode);
      } catch {
        if (active) setError("Kaydı şu an açamadık. Defterdeki diğer kayıtlar güvende.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [params.id, sqlite]);

  useFocusEffect(useCallback(() => {
    const onBack = () => {
      if (savingRef.current) return true;
      const action = previousEditTransactionStep(step);
      if (action === "exit") return false;
      if (action === "home") {
        router.replace(returnPath);
        return true;
      }
      setStep(action);
      return true;
    };
    const subscription = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => subscription.remove();
  }, [returnPath, step]));

  const categories = useMemo(() => {
    if (original === null) return [];
    const base = original.kind === "income"
      ? [...commonIncomeCategories]
      : [...(cropCode ? expenseSuggestionsFor(cropCode) : []), ...commonExpenseCategories];
    const keepOriginal = original.kind === "income" || original.cropCode === cropCode;
    return [...new Set([...(keepOriginal ? [original.category] : []), ...base])];
  }, [cropCode, original]);

  const afterDetails = () => {
    setError(undefined);
    try {
      transactionAmountFromInput(amountText);
    } catch {
      setError("Tutarı kontrol et.");
      return;
    }
    try {
      isoDateFromTurkishInput(dateText);
    } catch {
      setError("Tarihi GG.AA.YYYY olarak kontrol et.");
      return;
    }
    setStep("scope");
  };

  const save = async (category: string) => {
    if (savingRef.current || original === null || identity === null) return;
    savingRef.current = true;
    setSaving(true);
    setError(undefined);
    try {
      const updatedTransaction = createFarmTransaction({
        id: original.id,
        kind: original.kind,
        amountKurus: transactionAmountFromInput(amountText),
        occurredOn: isoDateFromTurkishInput(dateText),
        category,
        ...(cropCode === undefined ? {} : { cropCode }),
        ...(original.note === undefined ? {} : { note: original.note }),
        isTaxExemptSupport: isTaxExemptPublicAgriculturalSupport(original.kind, category)
      });
      const updated = await new LocalTransactionCorrections(mobileDatabase(sqlite)).updateTransaction({
        farmId: identity.farmId,
        transaction: updatedTransaction,
        nowIso: new Date().toISOString()
      });
      if (!updated) {
        setError("Bu kayıt artık bulunamadı. Deftere dönüp tekrar kontrol et.");
        return;
      }
      setOriginal(updatedTransaction);
      setStep("done");
    } catch {
      setError("Kaydı şu an düzeltemedik. Defterdeki kayıtların güvende. Tekrar dene.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <PageTitle hint="Kayıt bilgileri açılıyor…">Kaydı düzelt</PageTitle>
      </Screen>
    );
  }

  if (original === null || identity === null) {
    return (
      <Screen>
        <PageTitle hint="Deftere dönüp kaydı yeniden seç.">Kayıt açılamadı</PageTitle>
        <ErrorNote message={error ?? "Düzeltilecek kayıt bulunamadı."} />
        <BigButton label="Deftere dön" icon="←" onPress={() => router.replace(returnPath)} />
      </Screen>
    );
  }

  return (
    <Screen>
      {step === "details" ? (
        <>
          <PageTitle hint={original.kind === "income" ? "Gelen para kaydını düzeltiyorsun." : "Çıkan para kaydını düzeltiyorsun."}>
            Kaydı düzelt
          </PageTitle>
          <Field label="Tutar" keyboardType="decimal-pad" value={amountText} onChangeText={setAmountText} placeholder="0,00 TL" autoFocus />
          <Field label="Tarih" keyboardType="numeric" value={dateText} onChangeText={setDateText} placeholder="GG.AA.YYYY" />
          <ErrorNote message={error} />
          <BigButton label="Devam" icon="→" kind={original.kind} onPress={afterDetails} />
          <SecondaryButton label="Vazgeç" onPress={() => router.replace(returnPath)} />
        </>
      ) : null}

      {step === "scope" ? (
        <>
          <PageTitle hint="Bir ürüne bağlı değilse Genel'i seç.">Hangi ürün?</PageTitle>
          <ChoiceCard icon="📒" label="Genel" selected={cropCode === undefined} onPress={() => { setCropCode(undefined); setStep("category"); }} />
          {identity.cropCodes.map((crop: CropCode) => (
            <ChoiceCard
              key={crop}
              icon="🌱"
              label={cropTemplates[crop].label}
              selected={cropCode === crop}
              onPress={() => { setCropCode(crop); setStep("category"); }}
            />
          ))}
          <SecondaryButton label="Geri" onPress={() => setStep("details")} />
        </>
      ) : null}

      {step === "category" ? (
        <>
          <PageTitle hint="Doğru başlığı seç. Sonra kayıt güncellenecek.">
            {original.kind === "income" ? "Para nereden geldi?" : "Neye harcadın?"}
          </PageTitle>
          {categories.map((category: string) => (
            <ChoiceCard
              key={category}
              icon={original.kind === "income" ? "↓" : "↑"}
              label={category}
              selected={category === original.category && original.cropCode === cropCode}
              onPress={() => void save(category)}
            />
          ))}
          <ErrorNote message={error} />
          {saving ? <Text style={styles.saving}>Düzeltiliyor…</Text> : null}
          <SecondaryButton label="Geri" disabled={saving} onPress={() => setStep("scope")} />
        </>
      ) : null}

      {step === "done" ? (
        <View style={styles.done}>
          <Text style={styles.doneIcon}>✓</Text>
          <PageTitle hint="Değişiklik telefonundaki deftere kaydedildi.">Düzeltildi</PageTitle>
          <BigButton label="Deftere dön" icon="←" onPress={() => router.replace(returnPath)} />
        </View>
      ) : null}
    </Screen>
  );
}

function amountTextFromKurus(amountKurus: number): string {
  const whole = Math.floor(amountKurus / 100);
  const fraction = String(amountKurus % 100).padStart(2, "0");
  return `${whole},${fraction}`;
}

const styles = StyleSheet.create({
  saving: { color: theme.color.textMuted, fontSize: 16, fontWeight: "700", textAlign: "center" },
  done: { flex: 1, justifyContent: "center", gap: theme.spacing.md },
  doneIcon: { fontSize: 64, color: theme.color.income, fontWeight: "900", textAlign: "center" }
});
