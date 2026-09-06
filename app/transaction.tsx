import { router, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { loadFarmIdentity, type FarmIdentity } from "@/src/application/appSnapshot";
import { LocalFarmRepository } from "@/src/application/localFarmRepository";
import { stepAfterAmount, transactionAmountFromInput, transactionKindFromRoute } from "@/src/application/transactionFlow";
import { buildTransactionFromDraft } from "@/src/application/transactionDraft";
import {
  commonExpenseCategories,
  commonIncomeCategories,
  isTaxExemptPublicAgriculturalSupport
} from "@/src/domain/categories";
import { cropTemplates, expenseSuggestionsFor, type CropCode } from "@/src/domain/crops";
import { type TransactionKind } from "@/src/domain/transaction";
import { mobileDatabase } from "@/src/mobile/database";
import { dateInputFromIso, isoDateFromTurkishInput, todayIsoLocal } from "@/src/mobile/date";
import { createLocalId } from "@/src/mobile/id";
import { BigButton, ChoiceCard, ErrorNote, Field, PageTitle, Screen, SecondaryButton } from "@/src/ui/components";
import { theme } from "@/src/ui/theme";

type Step = "amount" | "crop" | "category" | "done";

export default function TransactionScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const sqlite = useSQLiteContext();
  const kind: TransactionKind | null = transactionKindFromRoute(params.kind);
  const [identity, setIdentity] = useState<FarmIdentity | null>(null);
  const [step, setStep] = useState<Step>("amount");
  const [amountText, setAmountText] = useState("");
  const [dateText, setDateText] = useState(() => dateInputFromIso(todayIsoLocal()));
  const [cropCode, setCropCode] = useState<CropCode>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    let active = true;
    void loadFarmIdentity(mobileDatabase(sqlite))
      .then((loaded) => {
        if (!active || loaded === null) return;
        setIdentity(loaded);
        if (loaded.cropCodes.length === 1) setCropCode(loaded.cropCodes[0]);
      })
      .catch(() => {
        if (active) setError("Çiftlik bilgini okuyamadık.");
      });
    return () => { active = false; };
  }, [sqlite]);

  const categories = useMemo(() => {
    if (kind === null) return [];
    if (kind === "income") return commonIncomeCategories;
    const cropSpecific = cropCode ? expenseSuggestionsFor(cropCode) : [];
    return [...new Set([...cropSpecific, ...commonExpenseCategories])];
  }, [cropCode, kind]);

  const singleCrop = identity?.cropCodes.length === 1 ? identity.cropCodes[0] : undefined;

  const afterAmount = () => {
    setError(undefined);
    if (kind === null) {
      setError("İşlem türü anlaşılmadı. Defterden yeniden başla.");
      return;
    }
    try {
      transactionAmountFromInput(amountText);
      isoDateFromTurkishInput(dateText);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tutarı ve tarihi kontrol et.");
      return;
    }
    if (identity === null) {
      setError("Çiftlik bilgini okuyamadık.");
      return;
    }
    setStep(stepAfterAmount(identity.cropCodes.length));
  };

  const save = async (category: string) => {
    if (savingRef.current) return;
    if (kind === null) {
      setError("İşlem türü anlaşılmadı. Defterden yeniden başla.");
      return;
    }
    if (identity === null) {
      setError("Çiftlik bilgini okuyamadık.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(undefined);
    try {
      const isTaxExemptSupport = isTaxExemptPublicAgriculturalSupport(kind, category);
      const transaction = buildTransactionFromDraft({
        kind,
        amountText,
        occurredOn: isoDateFromTurkishInput(dateText),
        category,
        ...(cropCode === undefined ? {} : { cropCode }),
        ...(isTaxExemptSupport ? { isTaxExemptSupport: true } : {})
      }, {
        nextTransactionId: () => createLocalId("txn")
      });
      const repo = new LocalFarmRepository(mobileDatabase(sqlite));
      await repo.addTransaction({ farmId: identity.farmId, transaction, nowIso: new Date().toISOString() });
      setStep("done");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kaydedemedik. Tekrar dene.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (kind === null) {
    return (
      <Screen>
        <PageTitle hint="Defterden yeniden kayıt aç.">Kayıt açılamadı</PageTitle>
        <ErrorNote message="İşlem türü anlaşılmadı." />
        <BigButton label="Deftere dön" icon="←" onPress={() => router.replace("/home")} />
      </Screen>
    );
  }

  return (
    <Screen>
      {step === "amount" ? (
        <>
          <PageTitle hint="Tarih bugün hazır. Gerekirse değiştirebilirsin.">
            Ne kadar {kind === "income" ? "girdi" : "çıktı"}?
          </PageTitle>
          <Field label="Tutar" keyboardType="decimal-pad" value={amountText} onChangeText={setAmountText} placeholder="0,00 TL" autoFocus />
          <Field label="Tarih" keyboardType="numeric" value={dateText} onChangeText={setDateText} placeholder="GG.AA.YYYY" />
          <ErrorNote message={error} />
          <BigButton label="Devam" icon="→" kind={kind} onPress={afterAmount} />
          <SecondaryButton label="Vazgeç" onPress={() => router.back()} />
        </>
      ) : null}

      {step === "crop" ? (
        <>
          <PageTitle hint="Bir ürüne bağlı değilse Genel'i seç.">Hangi ürün?</PageTitle>
          <ChoiceCard
            icon="📒"
            label="Genel"
            selected={cropCode === undefined}
            onPress={() => { setCropCode(undefined); setStep("category"); }}
          />
          {identity?.cropCodes.map((crop: CropCode) => (
            <ChoiceCard key={crop} icon="🌱" label={cropTemplates[crop].label} selected={cropCode === crop} onPress={() => { setCropCode(crop); setStep("category"); }} />
          ))}
          <SecondaryButton label="Geri" onPress={() => setStep("amount")} />
        </>
      ) : null}

      {step === "category" ? (
        <>
          <PageTitle hint={cropCode === undefined ? "Bu kayıt belirli bir ürüne bağlanmayacak." : "En yakın olanı seç."}>
            {kind === "income" ? "Para nereden geldi?" : "Neye harcadın?"}
          </PageTitle>
          {singleCrop !== undefined ? (
            <View style={styles.scopeBlock}>
              <Text style={styles.scopeLabel}>Bu kayıt neyle ilgili?</Text>
              <ChoiceCard
                icon="🌱"
                label={cropTemplates[singleCrop].label}
                selected={cropCode === singleCrop}
                onPress={() => setCropCode(singleCrop)}
              />
              <ChoiceCard
                icon="📒"
                label="Genel"
                selected={cropCode === undefined}
                onPress={() => setCropCode(undefined)}
              />
            </View>
          ) : null}
          {categories.map((category: string) => (
            <ChoiceCard key={category} icon={kind === "income" ? "↓" : "↑"} label={category} onPress={() => void save(category)} />
          ))}
          <ErrorNote message={error} />
          {saving ? <Text style={styles.saving}>Kaydediliyor…</Text> : null}
          <SecondaryButton
            label="Geri"
            disabled={saving}
            onPress={() => setStep(identity && identity.cropCodes.length > 1 ? "crop" : "amount")}
          />
        </>
      ) : null}

      {step === "done" ? (
        <View style={styles.done}>
          <Text style={styles.doneIcon}>✓</Text>
          <PageTitle hint="İnternet olmasa da kayıt telefonunda duruyor.">Kaydettim</PageTitle>
          <BigButton label="Deftere dön" icon="←" onPress={() => router.replace("/home")} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  saving: { color: theme.color.textMuted, fontSize: 16, fontWeight: "700", textAlign: "center" },
  done: { flex: 1, justifyContent: "center", gap: theme.spacing.md },
  doneIcon: { fontSize: 64, color: theme.color.income, fontWeight: "900", textAlign: "center" },
  scopeBlock: { gap: theme.spacing.sm },
  scopeLabel: { color: theme.color.text, fontSize: 17, fontWeight: "800" }
});
