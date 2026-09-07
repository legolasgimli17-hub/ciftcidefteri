import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
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
import { BigButton, ErrorNote, Field, PageTitle, Screen, SecondaryButton } from "@/src/ui/components";
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
          <PageTitle hint="Tarih bugün hazır. Gerekirse değiştir.">
            {kind === "income" ? "Gelir ekle" : "Gider ekle"}
          </PageTitle>
          <Field label="Tutar" keyboardType="decimal-pad" value={amountText} onChangeText={setAmountText} placeholder="0,00 TL" autoFocus />
          <Field label="Tarih" keyboardType="numeric" value={dateText} onChangeText={setDateText} placeholder="GG.AA.YYYY" />
          <ErrorNote message={error} />
          <BigButton label="Devam" icon="→" onPress={afterAmount} />
          <SecondaryButton label="Vazgeç" onPress={() => router.back()} />
        </>
      ) : null}

      {step === "crop" ? (
        <>
          <PageTitle hint="Bir ürüne ait değilse Genel'i seç.">Hangi ürün?</PageTitle>
          <View style={styles.selectionList}>
            <SimpleOption
              label="Genel"
              selected={cropCode === undefined}
              onPress={() => { setCropCode(undefined); setStep("category"); }}
            />
            {identity?.cropCodes.map((crop: CropCode) => (
              <SimpleOption
                key={crop}
                label={cropTemplates[crop].label}
                selected={cropCode === crop}
                leading={<CropArtwork cropCode={crop} compact />}
                onPress={() => { setCropCode(crop); setStep("category"); }}
              />
            ))}
          </View>
          <SecondaryButton label="Geri" onPress={() => setStep("amount")} />
        </>
      ) : null}

      {step === "category" ? (
        <>
          <PageTitle hint="En yakın gider veya gelir kalemini seç.">
            {kind === "income" ? "Gelir nereden geldi?" : "Neye harcadın?"}
          </PageTitle>

          {singleCrop !== undefined ? (
            <View style={styles.scopeToggle}>
              <ScopeButton
                label={cropTemplates[singleCrop].label}
                selected={cropCode === singleCrop}
                onPress={() => setCropCode(singleCrop)}
              />
              <ScopeButton
                label="Genel"
                selected={cropCode === undefined}
                onPress={() => setCropCode(undefined)}
              />
            </View>
          ) : null}

          <View style={styles.categoryGrid}>
            {categories.map((item: string) => (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityLabel={item}
                onPress={() => chooseCategory(item)}
                style={({ pressed }) => [styles.categoryTile, pressed && styles.pressed]}
              >
                <Text style={styles.categoryText}>{item}</Text>
              </Pressable>
            ))}
          </View>

          <ErrorNote message={error} />
          <SecondaryButton
            label="Geri"
            onPress={() => setStep(identity && identity.cropCodes.length > 1 ? "crop" : "amount")}
          />
        </>
      ) : null}

      {step === "details" ? (
        <>
          <PageTitle hint={`${category ?? "Kayıt"} · ${cropCode ? cropTemplates[cropCode].label : "Genel"} · ${dateText}`}>
            Son kontrol
          </PageTitle>

          <Text style={styles.amount}>{amountPreview}</Text>

          <Field
            label="Not"
            hint="İsteğe bağlı"
            value={noteText}
            onChangeText={setNoteText}
            placeholder="Örnek: 2. gübre, 4 torba"
            multiline
            maxLength={240}
          />

          {partnership !== undefined && configuredPartner !== undefined ? (
            <View style={styles.partnerLine}>
              <View style={styles.partnerAvatar}>
                <Text style={styles.partnerAvatarText}>{configuredPartner.name.slice(0, 1).toLocaleUpperCase("tr-TR")}</Text>
              </View>
              <View style={styles.partnerCopy}>
                <Text style={styles.partnerName}>{configuredPartner.name}</Text>
                <Text style={styles.partnerMeta}>
                  Sen {percentLabelFromBasisPoints(partnership.ownerShareBasisPoints)} · Ortak {percentLabelFromBasisPoints(BASIS_POINTS_TOTAL - partnership.ownerShareBasisPoints)}
                </Text>
                <Text style={styles.partnerMeta}>
                  {kind === "expense"
                    ? partnership.cashActor === "owner" ? "Ödemeyi sen yaptın" : "Ödemeyi ortak yaptı"
                    : partnership.cashActor === "owner" ? "Para sana geldi" : "Para ortağa geldi"}
                </Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Ortaklığı değiştir" onPress={openPartnership} hitSlop={8}>
                <Text style={styles.link}>Değiştir</Text>
              </Pressable>
            </View>
          ) : partners.length > 0 ? (
            <SecondaryButton label="Ortaklık ekle" onPress={openPartnership} />
          ) : null}

          {partnership !== undefined ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Ortaklığı kaldır" onPress={() => setPartnership(undefined)} style={styles.removePartner}>
              <Text style={styles.removePartnerText}>Ortaklığı kaldır</Text>
            </Pressable>
          ) : null}

          {partnerWarning ? <Text style={styles.warningText}>{partnerWarning}</Text> : null}
          <ErrorNote message={error} />
          {saving ? <Text style={styles.saving}>Kaydediliyor…</Text> : null}
          <BigButton
            label={kind === "income" ? "Geliri kaydet" : "Gideri kaydet"}
            icon="✓"
            disabled={saving}
            onPress={() => void save()}
          />
          <SecondaryButton label="Geri" disabled={saving} onPress={() => setStep("category")} />
        </>
      ) : null}

      {step === "partnership" ? (
        <>
          <PageTitle hint="Yalnız bu kaydın ortak hesabı için.">Ortaklık</PageTitle>

          <View style={styles.selectionList}>
            {partners.map((item) => (
              <SimpleOption
                key={item.id}
                label={item.name}
                selected={partnerId === item.id}
                onPress={() => setPartnerId(item.id)}
              />
            ))}
          </View>

          <Field
            label="Benim payım"
            hint="Yüzde"
            keyboardType="decimal-pad"
            value={ownerShareText}
            onChangeText={setOwnerShareText}
            placeholder="50"
          />

          {sharePreview ? (
            <Text style={styles.sharePreview}>Sen {sharePreview.owner} · Ortak {sharePreview.partner}</Text>
          ) : null}

          {selectedPartner ? (
            <View style={styles.scopeToggle}>
              <ScopeButton
                label={kind === "expense" ? "Ben ödedim" : "Ben aldım"}
                selected={cashActor === "owner"}
                onPress={() => setCashActor("owner")}
              />
              <ScopeButton
                label={kind === "expense" ? "Ortak ödedi" : "Ortak aldı"}
                selected={cashActor === "partner"}
                onPress={() => setCashActor("partner")}
              />
            </View>
          ) : null}

          <ErrorNote message={error} />
          <BigButton label="Ortaklığı kullan" icon="✓" onPress={applyPartnership} />
          <SecondaryButton label="Geri" onPress={() => setStep("details")} />
        </>
      ) : null}

      {step === "done" ? (
        <View style={styles.done}>
          <View style={styles.doneMark}><Text style={styles.doneIcon}>✓</Text></View>
          <PageTitle hint="Kayıt telefonunda duruyor.">Deftere işlendi</PageTitle>
          <BigButton label="Deftere dön" icon="←" onPress={() => router.replace("/home")} />
        </View>
      ) : null}
    </Screen>
  );
}

function SimpleOption(props: {
  readonly label: string;
  readonly selected: boolean;
  readonly leading?: React.ReactNode;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      style={({ pressed }) => [styles.simpleOption, props.selected && styles.simpleOptionSelected, pressed && styles.pressed]}
    >
      {props.leading}
      <Text style={styles.simpleOptionText}>{props.label}</Text>
      <View style={[styles.dot, props.selected && styles.dotSelected]} />
    </Pressable>
  );
}

function ScopeButton(props: { readonly label: string; readonly selected: boolean; readonly onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      style={({ pressed }) => [styles.scopeButton, props.selected && styles.scopeButtonSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.scopeButtonText, props.selected && styles.scopeButtonTextSelected]}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  selectionList: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.divider
  },
  simpleOption: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.divider,
    paddingVertical: 8
  },
  simpleOptionSelected: { backgroundColor: theme.color.primarySoft },
  simpleOptionText: { flex: 1, color: theme.color.text, fontSize: 16, fontWeight: "800" },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: theme.color.borderStrong },
  dotSelected: { borderWidth: 5, borderColor: theme.color.primary },
  pressed: { opacity: 0.65 },
  scopeToggle: {
    minHeight: 48,
    flexDirection: "row",
    backgroundColor: theme.color.surfaceMuted,
    borderRadius: theme.radius.md,
    padding: 4,
    gap: 4
  },
  scopeButton: { flex: 1, minHeight: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  scopeButtonSelected: { backgroundColor: theme.color.surface },
  scopeButtonText: { color: theme.color.textMuted, fontSize: 14, fontWeight: "700" },
  scopeButtonTextSelected: { color: theme.color.text, fontWeight: "900" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  categoryTile: {
    width: "48%",
    minHeight: 58,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    paddingHorizontal: 13,
    paddingVertical: 10
  },
  categoryText: { color: theme.color.text, fontSize: 14, fontWeight: "800", lineHeight: 18 },
  amount: { color: theme.color.text, fontSize: 38, fontWeight: "900", letterSpacing: -1.1, marginVertical: 6 },
  partnerLine: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.color.divider },
  partnerAvatar: { width: 42, height: 42, borderRadius: 13, backgroundColor: theme.color.primarySoft, alignItems: "center", justifyContent: "center" },
  partnerAvatarText: { color: theme.color.primaryInk, fontSize: 15, fontWeight: "900" },
  partnerCopy: { flex: 1, gap: 2 },
  partnerName: { color: theme.color.text, fontSize: 15, fontWeight: "900" },
  partnerMeta: { color: theme.color.textMuted, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  link: { color: theme.color.primary, fontSize: 13, fontWeight: "800" },
  removePartner: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  removePartnerText: { color: theme.color.expense, fontSize: 13, fontWeight: "700" },
  sharePreview: { color: theme.color.textMuted, fontSize: 14, fontWeight: "700", textAlign: "center" },
  saving: { color: theme.color.textMuted, fontSize: 14, fontWeight: "700", textAlign: "center" },
  warningText: { color: theme.color.warning, fontSize: 13, fontWeight: "700", lineHeight: 19 },
  done: { flex: 1, justifyContent: "center", gap: theme.spacing.md },
  doneMark: { width: 68, height: 68, borderRadius: 22, backgroundColor: theme.color.incomeSoft, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  doneIcon: { fontSize: 35, color: theme.color.income, fontWeight: "900" }
});
