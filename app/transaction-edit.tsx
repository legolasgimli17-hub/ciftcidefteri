import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { loadFarmIdentity, type FarmIdentity } from "@/src/application/appSnapshot";
import { loadLedgerPartnershipDetails } from "@/src/application/ledgerDetails";
import { LocalPartnershipRepository } from "@/src/application/localPartnershipRepository";
import { LocalTransactionCorrections } from "@/src/application/transactionCorrections";
import { transactionAmountFromInput } from "@/src/application/transactionFlow";
import { previousEditTransactionStep, type EditTransactionStep } from "@/src/application/wizardBack";
import {
  commonExpenseCategories,
  commonIncomeCategories,
  isTaxExemptPublicAgriculturalSupport
} from "@/src/domain/categories";
import { cropTemplates, expenseSuggestionsFor, type CropCode } from "@/src/domain/crops";
import { type FarmPartner } from "@/src/domain/partner";
import {
  BASIS_POINTS_TOTAL,
  basisPointsFromUserInput,
  createTransactionPartnership,
  percentLabelFromBasisPoints,
  type PartnershipCashActor,
  type TransactionPartnership
} from "@/src/domain/partnership";
import { createFarmTransaction, type FarmTransaction } from "@/src/domain/transaction";
import { mobileDatabase } from "@/src/mobile/database";
import { dateInputFromIso, isoDateFromTurkishInput } from "@/src/mobile/date";
import { BigButton, ErrorNote, Field, PageTitle, Screen, SecondaryButton } from "@/src/ui/components";
import { CropArtwork } from "@/src/ui/cropArtwork";
import { theme } from "@/src/ui/theme";

type Step = EditTransactionStep;
type ReturnPath = "/home" | "/transactions";

export default function TransactionEditScreen() {
  const params = useLocalSearchParams<{ id?: string; returnTo?: string }>();
  const sqlite = useSQLiteContext();
  const [identity, setIdentity] = useState<FarmIdentity | null>(null);
  const [original, setOriginal] = useState<FarmTransaction | null>(null);
  const [partners, setPartners] = useState<readonly FarmPartner[]>([]);
  const [originalPartnership, setOriginalPartnership] = useState<TransactionPartnership>();
  const [originalPartnerName, setOriginalPartnerName] = useState<string>();
  const [partnershipUpdate, setPartnershipUpdate] = useState<TransactionPartnership | null | undefined>(undefined);
  const [step, setStep] = useState<Step>("details");
  const [amountText, setAmountText] = useState("");
  const [dateText, setDateText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [cropCode, setCropCode] = useState<CropCode>();
  const [partnerId, setPartnerId] = useState<string>();
  const [ownerShareText, setOwnerShareText] = useState("50");
  const [cashActor, setCashActor] = useState<PartnershipCashActor>("owner");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const returnPath: ReturnPath = params.returnTo === "transactions" ? "/transactions" : "/home";

  const leaveEdit = useCallback(() => {
    router.dismissTo(returnPath);
  }, [returnPath]);

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

        const detail = (await loadLedgerPartnershipDetails(database, loadedIdentity.farmId, [transactionId])).get(transactionId);
        const loadedPartnership = detail === undefined ? undefined : createTransactionPartnership({
          partnerId: detail.partnerId,
          ownerShareBasisPoints: detail.ownerShareBasisPoints,
          cashActor: detail.cashActor
        });
        const activePartners = await new LocalPartnershipRepository(database).listActivePartners(loadedIdentity.farmId);
        if (!active) return;

        setIdentity(loadedIdentity);
        setOriginal(loadedTransaction);
        setPartners(activePartners);
        setOriginalPartnership(loadedPartnership);
        setOriginalPartnerName(detail?.partnerName);
        setPartnershipUpdate(undefined);
        setAmountText(amountTextFromKurus(loadedTransaction.amountKurus));
        setDateText(dateInputFromIso(loadedTransaction.occurredOn));
        setNoteText(loadedTransaction.note ?? "");
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
        leaveEdit();
        return true;
      }
      setError(undefined);
      setStep(action);
      return true;
    };
    const subscription = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => subscription.remove();
  }, [leaveEdit, step]));

  const categories = useMemo(() => {
    if (original === null) return [];
    const base = original.kind === "income"
      ? [...commonIncomeCategories]
      : [...(cropCode ? expenseSuggestionsFor(cropCode) : []), ...commonExpenseCategories];
    const keepOriginal = original.kind === "income" || original.cropCode === cropCode;
    return [...new Set([...(keepOriginal ? [original.category] : []), ...base])];
  }, [cropCode, original]);

  const effectivePartnership = partnershipUpdate === undefined
    ? originalPartnership
    : partnershipUpdate === null ? undefined : partnershipUpdate;
  const selectedPartner = partners.find((item) => item.id === partnerId);
  const effectivePartnerName = partnershipUpdate === undefined
    ? originalPartnerName
    : partnershipUpdate === null ? undefined : partners.find((item) => item.id === partnershipUpdate.partnerId)?.name;

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

  const openPartnership = () => {
    if (effectivePartnership !== undefined) {
      setPartnerId(effectivePartnership.partnerId);
      setOwnerShareText(percentLabelFromBasisPoints(effectivePartnership.ownerShareBasisPoints).slice(1));
      setCashActor(effectivePartnership.cashActor);
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
      setError("Aktif bir ortak seç.");
      return;
    }
    try {
      setPartnershipUpdate(createTransactionPartnership({
        partnerId,
        ownerShareBasisPoints: basisPointsFromUserInput(ownerShareText),
        cashActor
      }));
      setStep("details");
    } catch {
      setError("Ortaklık payını kontrol et.");
    }
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
        ...(noteText.trim().length === 0 ? {} : { note: noteText }),
        isTaxExemptSupport: isTaxExemptPublicAgriculturalSupport(original.kind, category)
      });
      const corrections = new LocalTransactionCorrections(mobileDatabase(sqlite));
      const updated = await corrections.updateTransaction({
        farmId: identity.farmId,
        transaction: updatedTransaction,
        ...(partnershipUpdate === undefined ? {} : { partnership: partnershipUpdate }),
        nowIso: new Date().toISOString()
      });
      if (!updated) {
        setError("Bu kayıt artık bulunamadı. Deftere dönüp tekrar kontrol et.");
        return;
      }

      if (partnershipUpdate !== undefined) {
        setOriginalPartnership(partnershipUpdate === null ? undefined : partnershipUpdate);
        setOriginalPartnerName(partnershipUpdate === null
          ? undefined
          : partners.find((item) => item.id === partnershipUpdate.partnerId)?.name);
        setPartnershipUpdate(undefined);
      }
      setOriginal(updatedTransaction);
      setStep("done");
    } catch {
      setError("Kaydı şu an düzeltemedik. Bilgileri kontrol edip tekrar dene.");
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
        <BigButton label="Deftere dön" icon="←" onPress={leaveEdit} />
      </Screen>
    );
  }

  return (
    <Screen>
      {step === "details" ? (
        <>
          <PageTitle hint={original.kind === "income" ? "Gelir kaydını düzeltiyorsun." : "Gider kaydını düzeltiyorsun."}>
            Kaydı düzelt
          </PageTitle>
          <Field label="Tutar" keyboardType="decimal-pad" value={amountText} onChangeText={setAmountText} placeholder="0,00 TL" autoFocus />
          <Field label="Tarih" keyboardType="numeric" value={dateText} onChangeText={setDateText} placeholder="GG.AA.YYYY" />
          <Field label="Not" hint="İsteğe bağlı" value={noteText} onChangeText={setNoteText} placeholder="Kısa not" multiline maxLength={240} />

          {effectivePartnership !== undefined && effectivePartnerName !== undefined ? (
            <View style={styles.partnerLine}>
              <View style={styles.partnerCopy}>
                <Text style={styles.partnerName}>{effectivePartnerName}</Text>
                <Text style={styles.partnerMeta}>
                  Sen {percentLabelFromBasisPoints(effectivePartnership.ownerShareBasisPoints)} · Ortak {percentLabelFromBasisPoints(BASIS_POINTS_TOTAL - effectivePartnership.ownerShareBasisPoints)}
                </Text>
                <Text style={styles.partnerMeta}>{cashActorLabel(original.kind, effectivePartnership.cashActor)}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Ortaklığı değiştir" onPress={openPartnership} hitSlop={8}>
                <Text style={styles.link}>Değiştir</Text>
              </Pressable>
            </View>
          ) : partners.length > 0 ? (
            <SecondaryButton label="Ortaklık ekle" onPress={openPartnership} />
          ) : null}

          {effectivePartnership !== undefined ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ortaklığı kaldır"
              onPress={() => setPartnershipUpdate(null)}
              style={styles.removePartner}
            >
              <Text style={styles.removePartnerText}>Ortaklığı kaldır</Text>
            </Pressable>
          ) : null}

          <ErrorNote message={error} />
          <BigButton label="Devam" icon="→" onPress={afterDetails} />
          <SecondaryButton label="Vazgeç" onPress={leaveEdit} />
        </>
      ) : null}

      {step === "partnership" ? (
        <>
          <PageTitle hint="Yalnız bu kaydın ortak hesabını düzelt.">Ortaklık</PageTitle>
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
          <Field label="Benim payım" hint="Yüzde" keyboardType="decimal-pad" value={ownerShareText} onChangeText={setOwnerShareText} placeholder="50" />
          {sharePreview ? <Text style={styles.sharePreview}>Sen {sharePreview.owner} · Ortak {sharePreview.partner}</Text> : null}
          <View style={styles.scopeToggle}>
            <ScopeButton
              label={original.kind === "expense" ? "Ben ödedim" : "Ben aldım"}
              selected={cashActor === "owner"}
              onPress={() => setCashActor("owner")}
            />
            <ScopeButton
              label={original.kind === "expense" ? "Ortak ödedi" : "Ortak aldı"}
              selected={cashActor === "partner"}
              onPress={() => setCashActor("partner")}
            />
          </View>
          <ErrorNote message={error} />
          <BigButton label="Ortaklığı kullan" icon="✓" onPress={applyPartnership} />
          <SecondaryButton label="Geri" onPress={() => setStep("details")} />
        </>
      ) : null}

      {step === "scope" ? (
        <>
          <PageTitle hint="Bir ürüne ait değilse Genel'i seç.">Hangi ürün?</PageTitle>
          <View style={styles.selectionList}>
            <SimpleOption label="Genel" selected={cropCode === undefined} onPress={() => { setCropCode(undefined); setStep("category"); }} />
            {identity.cropCodes.map((crop: CropCode) => (
              <SimpleOption
                key={crop}
                label={cropTemplates[crop].label}
                selected={cropCode === crop}
                leading={<CropArtwork cropCode={crop} compact />}
                onPress={() => { setCropCode(crop); setStep("category"); }}
              />
            ))}
          </View>
          <SecondaryButton label="Geri" onPress={() => setStep("details")} />
        </>
      ) : null}

      {step === "category" ? (
        <>
          <PageTitle hint="Doğru kalemi seçtiğinde kayıt güncellenecek.">
            {original.kind === "income" ? "Gelir nereden geldi?" : "Neye harcadın?"}
          </PageTitle>
          <View style={styles.categoryGrid}>
            {categories.map((category: string) => (
              <Pressable
                key={category}
                accessibilityRole="button"
                accessibilityLabel={category}
                disabled={saving}
                onPress={() => void save(category)}
                style={({ pressed }) => [styles.categoryTile, pressed && styles.pressed, saving && styles.disabled]}
              >
                <Text style={styles.categoryText}>{category}</Text>
              </Pressable>
            ))}
          </View>
          <ErrorNote message={error} />
          {saving ? <Text style={styles.saving}>Düzeltiliyor…</Text> : null}
          <SecondaryButton label="Geri" disabled={saving} onPress={() => setStep("scope")} />
        </>
      ) : null}

      {step === "done" ? (
        <View style={styles.done}>
          <View style={styles.doneMark}><Text style={styles.doneIcon}>✓</Text></View>
          <PageTitle hint="Değişiklik deftere kaydedildi.">Düzeltildi</PageTitle>
          <BigButton label="Deftere dön" icon="←" onPress={leaveEdit} />
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
      style={({ pressed }) => [styles.option, props.selected && styles.optionSelected, pressed && styles.pressed]}
    >
      {props.leading}
      <Text style={styles.optionText}>{props.label}</Text>
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

function cashActorLabel(kind: FarmTransaction["kind"], actor: PartnershipCashActor): string {
  if (kind === "expense") return actor === "owner" ? "Ödemeyi sen yaptın" : "Ödemeyi ortak yaptı";
  return actor === "owner" ? "Para sana geldi" : "Para ortağa geldi";
}

function amountTextFromKurus(amountKurus: number): string {
  const whole = Math.floor(amountKurus / 100);
  const fraction = String(amountKurus % 100).padStart(2, "0");
  return `${whole},${fraction}`;
}

const styles = StyleSheet.create({
  partnerLine: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.color.divider },
  partnerCopy: { flex: 1, gap: 2 },
  partnerName: { color: theme.color.text, fontSize: 15, fontWeight: "900" },
  partnerMeta: { color: theme.color.textMuted, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  link: { color: theme.color.primary, fontSize: 13, fontWeight: "800" },
  removePartner: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  removePartnerText: { color: theme.color.expense, fontSize: 13, fontWeight: "700" },
  selectionList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.color.divider },
  option: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: theme.color.divider, paddingVertical: 8 },
  optionSelected: { backgroundColor: theme.color.primarySoft },
  optionText: { flex: 1, color: theme.color.text, fontSize: 16, fontWeight: "800" },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: theme.color.borderStrong },
  dotSelected: { borderWidth: 5, borderColor: theme.color.primary },
  scopeToggle: { minHeight: 48, flexDirection: "row", backgroundColor: theme.color.surfaceMuted, borderRadius: theme.radius.md, padding: 4, gap: 4 },
  scopeButton: { flex: 1, minHeight: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  scopeButtonSelected: { backgroundColor: theme.color.surface },
  scopeButtonText: { color: theme.color.textMuted, fontSize: 14, fontWeight: "700" },
  scopeButtonTextSelected: { color: theme.color.text, fontWeight: "900" },
  sharePreview: { color: theme.color.textMuted, fontSize: 14, fontWeight: "700", textAlign: "center" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  categoryTile: { width: "48%", minHeight: 58, justifyContent: "center", borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, backgroundColor: theme.color.surface, paddingHorizontal: 13, paddingVertical: 10 },
  categoryText: { color: theme.color.text, fontSize: 14, fontWeight: "800", lineHeight: 18 },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.45 },
  saving: { color: theme.color.textMuted, fontSize: 14, fontWeight: "700", textAlign: "center" },
  done: { flex: 1, justifyContent: "center", gap: theme.spacing.md },
  doneMark: { width: 68, height: 68, borderRadius: 22, backgroundColor: theme.color.incomeSoft, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  doneIcon: { fontSize: 35, color: theme.color.income, fontWeight: "900" }
});
