import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { loadFarmIdentity, type FarmIdentity } from "@/src/application/appSnapshot";
import { LocalDebtRepository } from "@/src/application/localDebtRepository";
import {
  createDebtInstallment,
  createFarmDebt,
  debtSourceKinds,
  debtSourceLabel,
  type DebtSourceKind
} from "@/src/domain/debt";
import { moneyFromUserInput, type MoneyKurus } from "@/src/domain/money";
import { mobileDatabase } from "@/src/mobile/database";
import { createLocalId } from "@/src/mobile/id";
import { dateInputFromIso, isoDateFromTurkishInput, todayIsoLocal } from "@/src/mobile/date";
import { BigButton, Card, ChoiceCard, ErrorNote, Field, PageTitle, Screen, SecondaryButton, SectionTitle } from "@/src/ui/components";
import { theme } from "@/src/ui/theme";

interface InstallmentDraft {
  readonly key: string;
  readonly dueText: string;
  readonly amountText: string;
}

const MAX_UI_INSTALLMENTS = 36;

function newInstallmentDraft(initialDueText = ""): InstallmentDraft {
  return { key: createLocalId("installment"), dueText: initialDueText, amountText: "" };
}

export default function DebtNewScreen() {
  const sqlite = useSQLiteContext();
  const [identity, setIdentity] = useState<FarmIdentity | null>(null);
  const [sourceKind, setSourceKind] = useState<DebtSourceKind>("bank_cash");
  const [creditorName, setCreditorName] = useState("");
  const [totalText, setTotalText] = useState("");
  const [openedText, setOpenedText] = useState(() => dateInputFromIso(todayIsoLocal()));
  const [inKindDescription, setInKindDescription] = useState("");
  const [note, setNote] = useState("");
  const [installments, setInstallments] = useState<readonly InstallmentDraft[]>(() => [
    newInstallmentDraft(dateInputFromIso(todayIsoLocal()))
  ]);
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
        if (active) setError("Çiftlik bilgini şu an okuyamadık. Borç kaydedilmedi.");
      }
    })();
    return () => { active = false; };
  }, [sqlite]));

  const updateInstallment = (key: string, patch: Partial<Omit<InstallmentDraft, "key">>) => {
    setInstallments((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item));
  };

  const save = async () => {
    if (savingRef.current || identity === null) return;
    setError(undefined);

    const creditor = creditorName.trim().replace(/\s+/g, " ");
    if (creditor.length < 2) {
      setError("Borcu kimden veya hangi kurumdan aldığını yaz.");
      return;
    }
    if (sourceKind === "coop_in_kind" && inKindDescription.trim().length < 2) {
      setError("Mal olarak ne aldığını yaz. Örnek: gübre, tohum veya mazot.");
      return;
    }

    let totalKurus: MoneyKurus;
    try {
      totalKurus = moneyFromUserInput(totalText);
    } catch {
      setError("Toplam borç tutarını kontrol et.");
      return;
    }

    let openedOn: string;
    try {
      openedOn = isoDateFromTurkishInput(openedText);
    } catch {
      setError("Borcu aldığın tarihi GG.AA.YYYY şeklinde kontrol et.");
      return;
    }

    let debt: ReturnType<typeof createFarmDebt>;
    try {
      debt = createFarmDebt({
        id: createLocalId("debt"),
        sourceKind,
        creditorName: creditor,
        totalKurus,
        openedOn,
        ...(sourceKind === "coop_in_kind" ? { inKindDescription } : {}),
        ...(note.trim().length === 0 ? {} : { note })
      });
    } catch {
      setError("Borç kaynağı ve açıklama bilgilerini kontrol et.");
      return;
    }

    const parsedInstallments: ReturnType<typeof createDebtInstallment>[] = [];
    for (const [index, item] of installments.entries()) {
      let dueOn: string;
      try {
        dueOn = isoDateFromTurkishInput(item.dueText);
      } catch {
        setError(`${index + 1}. ödeme tarihini GG.AA.YYYY şeklinde kontrol et.`);
        return;
      }
      if (dueOn < openedOn) {
        setError(`${index + 1}. ödeme tarihi borcu aldığın tarihten önce olamaz.`);
        return;
      }

      let amountKurus: MoneyKurus;
      if (installments.length === 1 && item.amountText.trim().length === 0) {
        amountKurus = totalKurus;
      } else {
        try {
          amountKurus = moneyFromUserInput(item.amountText);
        } catch {
          setError(`${index + 1}. ödeme tutarını kontrol et.`);
          return;
        }
      }

      try {
        parsedInstallments.push(createDebtInstallment({ id: item.key, dueOn, amountKurus }));
      } catch {
        setError(`${index + 1}. ödeme bilgilerini kontrol et.`);
        return;
      }
    }

    const installmentTotal = parsedInstallments.reduce((sum, item) => sum + item.amountKurus, 0);
    if (installmentTotal !== totalKurus) {
      setError("Ödeme planının toplamı toplam borçla aynı olmalı.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      await new LocalDebtRepository(mobileDatabase(sqlite)).addDebt({
        farmId: identity.farmId,
        debt,
        installments: parsedInstallments,
        nowIso: new Date().toISOString()
      });
      router.replace("/debts");
    } catch {
      setError("Borcu şu an kaydedemedik. Bilgilerin silinmedi; tekrar deneyebilirsin.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Screen>
      <PageTitle hint="Toplam borcu ve ödeme tarihlerini yaz. Kalanı uygulama hesaplar.">
        Borç ekle
      </PageTitle>

      <SectionTitle>Borcu nereden aldın?</SectionTitle>
      {debtSourceKinds.map((kind) => (
        <ChoiceCard
          key={kind}
          label={debtSourceLabel(kind)}
          selected={sourceKind === kind}
          onPress={() => {
            setSourceKind(kind);
            if (kind !== "coop_in_kind") setInKindDescription("");
          }}
        />
      ))}

      <Field
        label="Kimden / hangi kurumdan?"
        value={creditorName}
        onChangeText={setCreditorName}
        placeholder={sourceKind.startsWith("coop_") ? "Tarım Kredi Kooperatifi" : "Örnek: Ziraat Bankası"}
        autoCapitalize="words"
        maxLength={100}
      />

      {sourceKind === "coop_in_kind" ? (
        <Field
          label="Ne aldın?"
          value={inKindDescription}
          onChangeText={setInKindDescription}
          placeholder="Örnek: 20 torba gübre"
          maxLength={120}
        />
      ) : null}

      <Field
        label="Toplam borç"
        value={totalText}
        onChangeText={setTotalText}
        placeholder="Örnek: 150.000"
        keyboardType="decimal-pad"
      />

      <Field
        label="Borcu aldığın tarih"
        value={openedText}
        onChangeText={setOpenedText}
        placeholder="GG.AA.YYYY"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />

      <SectionTitle detail={`${installments.length} ödeme`}>Ödeme planı</SectionTitle>
      <Text style={styles.planHint}>
        Tek ödemeyse tutarı boş bırakabilirsin. Taksitliyse her tarihin tutarını yaz.
      </Text>

      {installments.map((item, index) => (
        <Card key={item.key} tone="soft">
          <Text style={styles.installmentTitle}>{index + 1}. ödeme</Text>
          <Field
            label="Tarih"
            value={item.dueText}
            onChangeText={(dueText) => updateInstallment(item.key, { dueText })}
            placeholder="GG.AA.YYYY"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
          <Field
            label="Tutar"
            {...(installments.length === 1 ? { hint: "Boş bırakabilirsin" } : {})}
            value={item.amountText}
            onChangeText={(amountText) => updateInstallment(item.key, { amountText })}
            placeholder={installments.length === 1 ? "Toplam borç alınır" : "Örnek: 25.000"}
            keyboardType="decimal-pad"
          />
        </Card>
      ))}

      {installments.length < MAX_UI_INSTALLMENTS ? (
        <SecondaryButton
          label="Bir ödeme tarihi daha ekle"
          disabled={saving}
          onPress={() => setInstallments((current) => [...current, newInstallmentDraft()])}
        />
      ) : null}

      {installments.length > 1 ? (
        <SecondaryButton
          label="Son ödeme tarihini kaldır"
          disabled={saving}
          onPress={() => setInstallments((current) => current.slice(0, -1))}
        />
      ) : null}

      <Field
        label="Not"
        hint="İsteğe bağlı"
        value={note}
        onChangeText={setNote}
        placeholder="Kısa bir not"
        multiline
        maxLength={240}
      />

      <ErrorNote message={error} />
      <BigButton
        label={saving ? "Kaydediliyor…" : "Borcu kaydet"}
        icon="→"
        disabled={saving || identity === null}
        onPress={() => void save()}
      />
      <SecondaryButton label="Vazgeç" disabled={saving} onPress={() => router.replace("/debts")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  planHint: { color: theme.color.textMuted, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  installmentTitle: { color: theme.color.text, fontSize: 16, fontWeight: "900" }
});
