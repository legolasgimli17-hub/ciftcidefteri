import { router, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { loadFarmIdentity, type FarmIdentity } from "@/src/application/appSnapshot";
import { loadLedgerCategoryOptions } from "@/src/application/ledgerFilterOptions";
import { LocalPartnershipRepository } from "@/src/application/localPartnershipRepository";
import { cropTemplates, type CropCode } from "@/src/domain/crops";
import { type FarmPartner } from "@/src/domain/partner";
import { mobileDatabase } from "@/src/mobile/database";
import { dateInputFromIso, isoDateFromTurkishInput } from "@/src/mobile/date";
import { BigButton, ErrorNote, Field, PageTitle, Screen, SecondaryButton } from "@/src/ui/components";
import { theme } from "@/src/ui/theme";

type KindChoice = "all" | "expense" | "income";
type CropChoice = "all" | "general" | CropCode;

export default function LedgerFilterScreen() {
  const params = useLocalSearchParams<{
    kind?: string;
    crop?: string;
    category?: string;
    partnerId?: string;
    from?: string;
    to?: string;
  }>();
  const sqlite = useSQLiteContext();
  const [identity, setIdentity] = useState<FarmIdentity | null>(null);
  const [categories, setCategories] = useState<readonly string[]>([]);
  const [partners, setPartners] = useState<readonly FarmPartner[]>([]);
  const [kind, setKind] = useState<KindChoice>(validKind(params.kind));
  const [crop, setCrop] = useState<CropChoice>(validCrop(params.crop));
  const [category, setCategory] = useState(params.category ?? "");
  const [partnerId, setPartnerId] = useState(params.partnerId ?? "");
  const [fromText, setFromText] = useState(() => safeDateText(params.from));
  const [toText, setToText] = useState(() => safeDateText(params.to));
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const db = mobileDatabase(sqlite);
        const loaded = await loadFarmIdentity(db);
        if (!active) return;
        if (loaded === null) {
          router.replace("/onboarding");
          return;
        }
        const [loadedCategories, loadedPartners] = await Promise.all([
          loadLedgerCategoryOptions(db, loaded.farmId),
          new LocalPartnershipRepository(db).listActivePartners(loaded.farmId)
        ]);
        if (!active) return;
        setIdentity(loaded);
        setCategories(loadedCategories);
        setPartners(loadedPartners);
      } catch {
        if (active) setError("Filtre seçeneklerini şu an açamadık. Defter kayıtların değişmedi.");
      }
    })();
    return () => { active = false; };
  }, [sqlite]);

  const apply = () => {
    setError(undefined);
    try {
      const from = fromText.trim().length === 0 ? undefined : isoDateFromTurkishInput(fromText);
      const to = toText.trim().length === 0 ? undefined : isoDateFromTurkishInput(toText);
      if (from !== undefined && to !== undefined && from > to) {
        setError("İlk tarih son tarihten sonra olamaz.");
        return;
      }

      router.replace({
        pathname: "/transactions",
        params: {
          ...(kind === "all" ? {} : { kind }),
          ...(crop === "all" ? {} : { crop }),
          ...(category.length === 0 ? {} : { category }),
          ...(partnerId.length === 0 ? {} : { partnerId }),
          ...(from === undefined ? {} : { from }),
          ...(to === undefined ? {} : { to })
        }
      });
    } catch {
      setError("Tarihleri GG.AA.YYYY olarak kontrol et.");
    }
  };

  const clear = () => {
    setKind("all");
    setCrop("all");
    setCategory("");
    setPartnerId("");
    setFromText("");
    setToText("");
    setError(undefined);
  };

  return (
    <Screen>
      <PageTitle hint="Yalnız ihtiyacın olan kayıtları göster.">Defteri filtrele</PageTitle>

      <FilterSection title="Tür">
        <Chip label="Tümü" selected={kind === "all"} onPress={() => setKind("all")} />
        <Chip label="Gider" selected={kind === "expense"} onPress={() => setKind("expense")} />
        <Chip label="Gelir" selected={kind === "income"} onPress={() => setKind("income")} />
      </FilterSection>

      {identity ? (
        <FilterSection title="Ürün">
          <Chip label="Tümü" selected={crop === "all"} onPress={() => setCrop("all")} />
          <Chip label="Genel" selected={crop === "general"} onPress={() => setCrop("general")} />
          {identity.cropCodes.map((code) => (
            <Chip
              key={code}
              label={cropTemplates[code].label}
              selected={crop === code}
              onPress={() => setCrop(code)}
            />
          ))}
        </FilterSection>
      ) : null}

      {categories.length > 0 ? (
        <FilterSection title="Gider / gelir kalemi">
          <Chip label="Tümü" selected={category.length === 0} onPress={() => setCategory("")} />
          {categories.map((item) => (
            <Chip key={item} label={item} selected={category === item} onPress={() => setCategory(item)} />
          ))}
        </FilterSection>
      ) : null}

      {partners.length > 0 ? (
        <FilterSection title="Ortak">
          <Chip label="Tümü" selected={partnerId.length === 0} onPress={() => setPartnerId("")} />
          {partners.map((item) => (
            <Chip key={item.id} label={item.name} selected={partnerId === item.id} onPress={() => setPartnerId(item.id)} />
          ))}
        </FilterSection>
      ) : null}

      <View style={styles.dateBlock}>
        <Text style={styles.sectionTitle}>Tarih aralığı</Text>
        <Field label="İlk tarih" hint="İsteğe bağlı" keyboardType="numeric" value={fromText} onChangeText={setFromText} placeholder="GG.AA.YYYY" />
        <Field label="Son tarih" hint="İsteğe bağlı" keyboardType="numeric" value={toText} onChangeText={setToText} placeholder="GG.AA.YYYY" />
      </View>

      <ErrorNote message={error} />
      <BigButton label="Filtreleri uygula" icon="✓" onPress={apply} />
      <SecondaryButton label="Tümünü temizle" onPress={clear} />
      <SecondaryButton label="Deftere dön" onPress={() => router.back()} />
    </Screen>
  );
}

function FilterSection(props: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{props.title}</Text>
      <View style={styles.chips}>{props.children}</View>
    </View>
  );
}

function Chip(props: { readonly label: string; readonly selected: boolean; readonly onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      style={({ pressed }) => [styles.chip, props.selected && styles.chipSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, props.selected && styles.chipTextSelected]}>{props.label}</Text>
    </Pressable>
  );
}

function validKind(value: string | undefined): KindChoice {
  return value === "expense" || value === "income" ? value : "all";
}

function validCrop(value: string | undefined): CropChoice {
  if (value === "general") return "general";
  if (value === "cotton" || value === "corn" || value === "wheat" || value === "hazelnut" || value === "tobacco" || value === "vegetable" || value === "other") return value;
  return "all";
}

function safeDateText(value: string | undefined): string {
  if (value === undefined) return "";
  try {
    return dateInputFromIso(value);
  } catch {
    return "";
  }
}

const styles = StyleSheet.create({
  section: { gap: 10, paddingVertical: 4 },
  sectionTitle: { color: theme.color.text, fontSize: 16, fontWeight: "900" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 48,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.color.borderStrong,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.surface,
    paddingHorizontal: 15,
    paddingVertical: 9
  },
  chipSelected: { borderColor: theme.color.primary, backgroundColor: theme.color.primarySoft },
  chipText: { color: theme.color.textMuted, fontSize: 14, fontWeight: "700" },
  chipTextSelected: { color: theme.color.primaryInk, fontWeight: "900" },
  pressed: { opacity: 0.65 },
  dateBlock: { gap: 12, paddingTop: 4 }
});
