import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import { loadFarmIdentity, type FarmIdentity } from "@/src/application/appSnapshot";
import { LocalFarmRepository } from "@/src/application/localFarmRepository";
import { LocalPartnershipRepository } from "@/src/application/localPartnershipRepository";
import { stepAfterAmount, transactionAmountFromInput, transactionKindFromRoute } from "@/src/application/transactionFlow";
import { buildTransactionFromDraft } from "@/src/application/transactionDraft";
import { previousCreateTransactionStep, type CreateTransactionStep } from "@/src/application/wizardBack";
import {
  commonExpenseCategories,
  commonIncomeCategories,
  isTaxExemptPublicAgriculturalSupport
} from "@/src/domain/categories";
import { cropTemplates, expenseSuggestionsFor, type CropCode } from "@/src/domain/crops";
import { formatTry } from "@/src/domain/money";
import { type FarmPartner } from "@/src/domain/partner";
import {
  BASIS_POINTS_TOTAL,
  basisPointsFromUserInput,
  createTransactionPartnership,
  percentLabelFromBasisPoints,
  type PartnershipCashActor,
  type TransactionPartnership
} from "@/src/domain/partnership";
import { type TransactionKind } from "@/src/domain/transaction";
import { mobileDatabase } from "@/src/mobile/database";
import { dateInputFromIso, isoDateFromTurkishInput, todayIsoLocal } from "@/src/mobile/date";
import { createLocalId } from "@/src/mobile/id";
import { BigButton, Card, ChoiceCard, ErrorNote, Field, PageTitle, Pill, Screen, SecondaryButton, SectionTitle } from "@/src/ui/components";
import { CropArtwork } from "@/src/ui/cropArtwork";
import { theme } from "@/src/ui/theme";

type Step = CreateTransactionStep;

export default function TransactionScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const sqlite = useSQLiteContext();
  const kind: TransactionKind | null = transactionKindFromRoute(params.kind);
  const [identity, setIdentity] = useState<FarmIdentity | null>(null);
  const [partners, setPartners] = useState<readonly FarmPartner[]>([]);
  const [partnerWarning, setPartnerWarning] = useState<string>();
  const [step, setStep] = useState<Step>("amount");
  const [amountText, setAmountText] = useState("");
  const [dateText, setDateText] = useState(() => dateInputFromIso(todayIsoLocal()));
  const [cropCode, setCropCode] = useState<CropCode>();
  const [category, setCategory] = useState<string>();
  const [noteText, setNoteText] = useState("");
  const [partnership, setPartnership] = useState<TransactionPartnership>();
  const [partnerId, setPartnerId] = useState<string>();
  const [ownerShareText, setOwnerShareText] = useState("50");
  const [cashActor, setCashActor] = useState<PartnershipCashActor>("owner");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const db = mobileDatabase(sqlite);
      try {
        const loaded = await loadFarmIdentity(db);
        if (!active || loaded === null) return;
        setIdentity(loaded);
        if (loaded.cropCodes.length === 1) setCropCode(loaded.cropCodes[0]);
        try {
          const loadedPartners = await new LocalPartnershipRepository(db).listActivePartners(loaded.farmId);
          if (active) {
            setPartners(loadedPartners);
            setPartnerWarning(undefined);
          }
        } catch {
          if (active) {
            setPartners([]);
            setPartnerWarning("Ortaklar şu an okunamadı. Normal kayıt eklemeye devam edebilirsin.");
          }
        }
      } catch {
        if (active) setError("Çiftlik bilgini okuyamadık.");
      }
    })();
    return () => { active = false; };
  }, [sqlite]);

  useFocusEffect(useCallback(() => {
    const onBack = () => {
      if (savingRef.current) return true;
      const action = previousCreateTransactionStep(step, identity?.cropCodes.length ?? 1);
      if (action === "exit") return false;
      if (action === "home") {
        router.replace("/home");
        return true;
      }
      setError(undefined);
      setStep(action);
      return true;
    };
    const subscription = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => subscription.remove();
  }, [identity?.cropCodes.length, step]));

  const categories = useMemo(() => {
    if (kind === null) return [];
    if (kind === "income") return commonIncomeCategories;
    const cropSpecific = cropCode ? expenseSuggestionsFor(cropCode) : [];
    return [...new Set([...cropSpecific, ...commonExpenseCategories])];
  }, [cropCode, kind]);

  const singleCrop = identity?.cropCodes.length === 1 ? identity.cropCodes[0] : undefined;
  const selectedPartner = partners.find((item) => item.id === partnerId);
  const configuredPartner = partnership === undefined
    ? undefined
    : partners.find((item) => item.id === partnership.partnerId);

  const amountPreview = useMemo(() => {
    try {
      return formatTry(transactionAmountFromInput(amountText));
    } catch {
      return amountText.trim() || "—";
    }
  }, [amountText]);

  const sharePreview = useMemo(() => {
    try {
      const owner = basisPointsFromUserInput(ownerShareText);
      return {
        owner: percentLabelFromBasisPoints(owner),
        partner: percentLabelFromBasisPoints(BASIS_POINTS_TOTAL - owner)
      };
    } catch {
      return null;
    }
  }, [ownerShareText]);

  const afterAmount = () => {
    setError(undefined);
    if (kind === null) {
      setError("İşlem türü anlaşılmadı. Defterden yeniden başla.");
      return;
    }
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
    if (identity === null) {
      setError("Çiftlik bilgini okuyamadık.");
      return;
    }
    setStep(stepAfterAmount(identity.cropCodes.length));
  };

  const chooseCategory = (nextCategory: string) => {
    setCategory(nextCategory);
    setError(undefined);
    setStep("details");
  };

  const openPartnership = () => {
    if (partnership !== undefined) {
      setPartnerId(partnership.partnerId);
      setOwnerShareText(percentLabelFromBasisPoints(partnership.ownerShareBasisPoints).slice(1));
      setCashActor(partnership.cashActor);
    } else {
      setPartnerId(undefined);
      setOwnerShareText("50");
      setCashActor("owner");
    }
    setError(undefined);
    setStep("partnership");
  };

  const applyPartnership = () => {
    setError(undefined);
    if (partnerId === undefined || selectedPartner === undefined) {
      setError("Ortağı seç.");
      return;
    }
    try {
      setPartnership(createTransactionPartnership({
        partnerId,
        ownerShareBasisPoints: basisPointsFromUserInput(ownerShareText),
        cashActor
      }));
      setStep("details");
    } catch {
      setError("Ortaklık payını kontrol et.");
    }
  };

  const save = async () => {
    if (savingRef.current) return;
    if (kind === null) {
      setError("İşlem türü anlaşılmadı. Defterden yeniden başla.");
      return;
    }
    if (identity === null) {
      setError("Çiftlik bilgini okuyamadık.");
      return;
    }
    if (category === undefined) {
      setError("Gelir veya gider türünü seç.");
      setStep("category");
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
        ...(noteText.trim().length === 0 ? {} : { note: noteText }),
        ...(isTaxExemptSupport ? { isTaxExemptSupport: true } : {})
      }, {
        nextTransactionId: () => createLocalId("txn")
      });
      const repo = new LocalFarmRepository(mobileDatabase(sqlite));
      await repo.addTransaction({
        farmId: identity.farmId,
        transaction,
        ...(partnership === undefined ? {} : { partnership }),
        nowIso: new Date().toISOString()
      });
      setStep("done");
    } catch {
      setError("Kaydı şu an kaydedemedik. Bilgilerin güvende. Tekrar dene.");
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
            {kind === "income" ? "Ne kadar gelir var?" : "Ne kadar harcadın?"}
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
          <PageTitle hint="Bir ürüne bağlı değilse Genel'i seç.">Hangi ürün için?</PageTitle>
          <ChoiceCard
            icon="G"
            label="Genel"
            caption="Belirli bir ürüne ait değil"
            selected={cropCode === undefined}
            onPress={() => { setCropCode(undefined); setStep("category"); }}
          />
          {identity?.cropCodes.map((crop: CropCode) => (
            <ChoiceCard
              key={crop}
              leading={<CropArtwork cropCode={crop} compact />}
              label={cropTemplates[crop].label}
              selected={cropCode === crop}
              onPress={() => { setCropCode(crop); setStep("category"); }}
            />
          ))}
          <SecondaryButton label="Geri" onPress={() => setStep("amount")} />
        </>
      ) : null}

      {step === "category" ? (
        <>
          <PageTitle hint={cropCode === undefined ? "Bu kayıt belirli bir ürüne bağlanmayacak." : "Defterde görmek istediğin en yakın kalemi seç."}>
            {kind === "income" ? "Gelir nereden geldi?" : "Neye harcadın?"}
          </PageTitle>
          {singleCrop !== undefined ? (
            <View style={styles.scopeBlock}>
              <SectionTitle>Bu kayıt neyle ilgili?</SectionTitle>
              <ChoiceCard
                leading={<CropArtwork cropCode={singleCrop} compact />}
                label={cropTemplates[singleCrop].label}
                selected={cropCode === singleCrop}
                onPress={() => setCropCode(singleCrop)}
              />
              <ChoiceCard
                icon="G"
                label="Genel"
                caption="Belirli bir ürüne ait değil"
                selected={cropCode === undefined}
                onPress={() => setCropCode(undefined)}
              />
            </View>
          ) : null}
          {categories.map((item: string) => (
            <ChoiceCard key={item} icon={kind === "income" ? "+" : "−"} label={item} onPress={() => chooseCategory(item)} />
          ))}
          <ErrorNote message={error} />
          <SecondaryButton
            label="Geri"
            onPress={() => setStep(identity && identity.cropCodes.length > 1 ? "crop" : "amount")}
          />
        </>
      ) : null}

      {step === "details" ? (
        <>
          <PageTitle hint="Deftere geçmeden önce son ayrıntıları ekleyebilirsin.">Kayıt ayrıntısı</PageTitle>
          <Card tone="soft">
            <View style={styles.reviewTop}>
              <Pill label={kind === "income" ? "Gelir" : "Gider"} tone={kind === "income" ? "income" : "expense"} />
              <Text style={styles.reviewAmount}>{amountPreview}</Text>
            </View>
            <View style={styles.reviewLine}><Text style={styles.reviewKey}>Tarih</Text><Text style={styles.reviewValue}>{dateText}</Text></View>
            <View style={styles.reviewLine}><Text style={styles.reviewKey}>Kalem</Text><Text style={styles.reviewValue}>{category ?? "—"}</Text></View>
            <View style={styles.reviewLine}><Text style={styles.reviewKey}>Ürün</Text><Text style={styles.reviewValue}>{cropCode ? cropTemplates[cropCode].label : "Genel"}</Text></View>
          </Card>

          <Field
            label="Not"
            hint="İsteğe bağlı"
            value={noteText}
            onChangeText={setNoteText}
            placeholder="Örnek: 2. gübre, 4 torba"
            multiline
            maxLength={240}
          />

          <SectionTitle>Ortaklık</SectionTitle>
          {partnership !== undefined && configuredPartner !== undefined ? (
            <Card>
              <View style={styles.partnershipHeader}>
                <View style={styles.partnerInitial}><Text style={styles.partnerInitialText}>{configuredPartner.name.slice(0, 1).toLocaleUpperCase("tr-TR")}</Text></View>
                <View style={styles.partnershipCopy}>
                  <Text style={styles.partnershipName}>{configuredPartner.name}</Text>
                  <Text style={styles.partnershipMeta}>
                    Sen {percentLabelFromBasisPoints(partnership.ownerShareBasisPoints)} · Ortak {percentLabelFromBasisPoints(BASIS_POINTS_TOTAL - partnership.ownerShareBasisPoints)}
                  </Text>
                  <Text style={styles.partnershipMeta}>
                    {kind === "expense"
                      ? partnership.cashActor === "owner" ? "Ödemeyi sen yaptın" : "Ödemeyi ortak yaptı"
                      : partnership.cashActor === "owner" ? "Para sana geldi" : "Para ortağa geldi"}
                  </Text>
                </View>
              </View>
              <SecondaryButton label="Ortaklığı değiştir" onPress={openPartnership} />
              <SecondaryButton label="Ortaklığı kaldır" onPress={() => setPartnership(undefined)} />
            </Card>
          ) : partners.length > 0 ? (
            <SecondaryButton label="Bu kayıt ortaklı" onPress={openPartnership} />
          ) : (
            <Card tone="soft">
              <Text style={styles.helperText}>Ortaklı çalışıyorsan önce ana sayfadaki “Ortak hesabı” bölümünden kişiyi ekleyebilirsin.</Text>
            </Card>
          )}
          {partnerWarning ? <Text style={styles.warningText}>{partnerWarning}</Text> : null}
          <ErrorNote message={error} />
          {saving ? <Text style={styles.saving}>Kaydediliyor…</Text> : null}
          <BigButton label={kind === "income" ? "Geliri kaydet" : "Gideri kaydet"} icon="✓" kind={kind} disabled={saving} onPress={() => void save()} />
          <SecondaryButton label="Geri" disabled={saving} onPress={() => setStep("category")} />
        </>
      ) : null}

      {step === "partnership" ? (
        <>
          <PageTitle hint="Bu bilgiler yalnız bu kaydın ortak hesabını hesaplamak için kullanılır.">Ortaklık hesabı</PageTitle>
          <SectionTitle>Hangi ortak?</SectionTitle>
          {partners.map((item) => (
            <ChoiceCard
              key={item.id}
              icon={item.name.slice(0, 1).toLocaleUpperCase("tr-TR")}
              label={item.name}
              selected={partnerId === item.id}
              onPress={() => setPartnerId(item.id)}
            />
          ))}

          <Field
            label="Benim payım"
            hint="Yüzde"
            keyboardType="decimal-pad"
            value={ownerShareText}
            onChangeText={setOwnerShareText}
            placeholder="50"
          />
          {sharePreview ? (
            <Card tone="soft">
              <View style={styles.shareRow}><Text style={styles.reviewKey}>Senin payın</Text><Text style={styles.shareValue}>{sharePreview.owner}</Text></View>
              <View style={styles.shareRow}><Text style={styles.reviewKey}>Ortağın payı</Text><Text style={styles.shareValue}>{sharePreview.partner}</Text></View>
            </Card>
          ) : null}

          {selectedPartner ? (
            <>
              <SectionTitle>{kind === "expense" ? "Parayı kim ödedi?" : "Parayı kim aldı?"}</SectionTitle>
              <ChoiceCard
                icon="B"
                label={kind === "expense" ? "Ben ödedim" : "Ben aldım"}
                selected={cashActor === "owner"}
                onPress={() => setCashActor("owner")}
              />
              <ChoiceCard
                icon="O"
                label={kind === "expense" ? "Ortak ödedi" : "Ortak aldı"}
                caption={selectedPartner.name}
                selected={cashActor === "partner"}
                onPress={() => setCashActor("partner")}
              />
            </>
          ) : null}

          <ErrorNote message={error} />
          <BigButton label="Ortaklığı kullan" icon="✓" onPress={applyPartnership} />
          <SecondaryButton label="Geri" onPress={() => setStep("details")} />
        </>
      ) : null}

      {step === "done" ? (
        <View style={styles.done}>
          <View style={styles.doneMark}><Text style={styles.doneIcon}>✓</Text></View>
          <PageTitle hint="İnternet olmasa da kayıt telefonunda duruyor.">Deftere işlendi</PageTitle>
          <BigButton label="Deftere dön" icon="←" onPress={() => router.replace("/home")} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  saving: { color: theme.color.textMuted, fontSize: 15, fontWeight: "700", textAlign: "center" },
  done: { flex: 1, justifyContent: "center", gap: theme.spacing.md },
  doneMark: { width: 72, height: 72, borderRadius: 24, backgroundColor: theme.color.incomeSoft, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  doneIcon: { fontSize: 38, color: theme.color.income, fontWeight: "900" },
  scopeBlock: { gap: theme.spacing.sm },
  reviewTop: { gap: 8 },
  reviewAmount: { color: theme.color.text, fontSize: 30, fontWeight: "900", letterSpacing: -0.7 },
  reviewLine: { flexDirection: "row", justifyContent: "space-between", gap: 16, borderTopWidth: 1, borderTopColor: theme.color.divider, paddingTop: 10 },
  reviewKey: { color: theme.color.textMuted, fontSize: 14, fontWeight: "700" },
  reviewValue: { color: theme.color.text, fontSize: 14, fontWeight: "800", flexShrink: 1, textAlign: "right" },
  partnershipHeader: { flexDirection: "row", gap: 12, alignItems: "center" },
  partnerInitial: { width: 48, height: 48, borderRadius: 16, backgroundColor: theme.color.primarySoft, alignItems: "center", justifyContent: "center" },
  partnerInitialText: { color: theme.color.primaryInk, fontSize: 18, fontWeight: "900" },
  partnershipCopy: { flex: 1, gap: 3 },
  partnershipName: { color: theme.color.text, fontSize: 17, fontWeight: "900" },
  partnershipMeta: { color: theme.color.textMuted, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  helperText: { color: theme.color.textMuted, fontSize: 14, fontWeight: "600", lineHeight: 21 },
  warningText: { color: theme.color.warning, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  shareRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  shareValue: { color: theme.color.primary, fontSize: 17, fontWeight: "900" }
});
