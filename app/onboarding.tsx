import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useMemo, useRef, useState } from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import { buildProfileFromOnboarding, toggleCrop, type OnboardingDraft } from "@/src/application/onboardingDraft";
import { LocalFarmRepository } from "@/src/application/localFarmRepository";
import { previousOnboardingStep, type OnboardingStep } from "@/src/application/wizardBack";
import { cropCodes, cropTemplates, type CropCode } from "@/src/domain/crops";
import { squareMetersFromUserInput } from "@/src/domain/landArea";
import { mobileDatabase } from "@/src/mobile/database";
import { createLocalId } from "@/src/mobile/id";
import { BigButton, ChoiceCard, ErrorNote, Field, PageTitle, Screen, SecondaryButton } from "@/src/ui/components";
import { theme } from "@/src/ui/theme";

const cropIcons: Record<CropCode, string> = {
  cotton: "☁️",
  corn: "🌽",
  wheat: "🌾",
  hazelnut: "🌰",
  tobacco: "🍃",
  vegetable: "🍅",
  other: "➕"
};

type Step = OnboardingStep;

const initialDraft: OnboardingDraft = {
  name: "",
  province: "",
  district: "",
  village: "",
  areaText: "",
  areaUnit: "decare",
  cropCodes: []
};

export default function OnboardingScreen() {
  const sqlite = useSQLiteContext();
  const [step, setStep] = useState<Step>("welcome");
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const stepNumber = useMemo(() => {
    const sequence: Step[] = ["name", "place", "area", "crops"];
    const index = sequence.indexOf(step);
    return index >= 0 ? `${index + 1}/${sequence.length}` : undefined;
  }, [step]);

  const next = (target: Step) => {
    setError(undefined);
    setStep(target);
  };

  useFocusEffect(useCallback(() => {
    const onBack = () => {
      if (savingRef.current) return true;
      const target = previousOnboardingStep(step);
      if (target === "exit") return false;
      next(target);
      return true;
    };
    const subscription = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => subscription.remove();
  }, [step]));

  const finish = async () => {
    if (savingRef.current) return;
    setError(undefined);

    let profile: ReturnType<typeof buildProfileFromOnboarding>;
    try {
      profile = buildProfileFromOnboarding({
        id: createLocalId("profile"),
        draft
      });
    } catch {
      setError("Bilgilerini kontrol et. Eksik veya hatalı bir alan var.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const repository = new LocalFarmRepository(mobileDatabase(sqlite));
      await repository.saveInitialFarm({
        profile,
        farmId: createLocalId("farm"),
        farmName: "Benim Çiftliğim",
        nowIso: new Date().toISOString()
      });
      router.replace("/home");
    } catch {
      setError("Bilgilerini şu an kaydedemedik. Tekrar dene.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Screen>
      {stepNumber ? <Text style={styles.step}>{stepNumber}</Text> : null}
      {step === "welcome" ? (
        <>
          <PageTitle hint="Ne kadar kazandığını, ne harcadığını ve elinde ne kaldığını kolayca gör.">
            Çiftçi Defteri
          </PageTitle>
          <View style={styles.hero}>
            <Text style={styles.heroIcon}>🌱</Text>
            <Text style={styles.heroText}>İnternet olmasa da kayıtların sende kalır.</Text>
          </View>
          <BigButton label="Başlayalım" icon="→" onPress={() => next("name")} />
        </>
      ) : null}

      {step === "name" ? (
        <>
          <PageTitle hint="Sadece sana hitap etmek için.">Adın ne?</PageTitle>
          <Field
            label="Adın"
            autoCapitalize="words"
            autoComplete="name"
            value={draft.name}
            onChangeText={(name: string) => setDraft({ ...draft, name })}
            placeholder="Örnek: Mehmet Kaya"
            returnKeyType="next"
          />
          <ErrorNote message={error} />
          <BigButton label="Devam" icon="→" onPress={() => draft.name.trim().length >= 2 ? next("place") : setError("Adını yaz.")} />
        </>
      ) : null}

      {step === "place" ? (
        <>
          <PageTitle hint="Üretim yerini defterinde tutmak için.">Nerede üretim yapıyorsun?</PageTitle>
          <Field label="İl" value={draft.province} onChangeText={(province: string) => setDraft({ ...draft, province })} placeholder="Diyarbakır" />
          <Field label="İlçe" value={draft.district} onChangeText={(district: string) => setDraft({ ...draft, district })} placeholder="Bismil" />
          <Field label="Köy / mahalle" value={draft.village} onChangeText={(village: string) => setDraft({ ...draft, village })} placeholder="Köy veya mahalle" />
          <ErrorNote message={error} />
          <BigButton label="Devam" icon="→" onPress={() => {
            if (draft.province.trim().length < 2 || draft.district.trim().length < 2 || draft.village.trim().length < 1) {
              setError("İl, ilçe ve köy/mahalle bilgisini tamamla.");
              return;
            }
            next("area");
          }} />
        </>
      ) : null}

      {step === "area" ? (
        <>
          <PageTitle hint="Dönüm ve dekar aynı büyüklükte hesaplanır.">Toplam kaç dönüm yerin var?</PageTitle>
          <Field label="Arazi" keyboardType="decimal-pad" value={draft.areaText} onChangeText={(areaText: string) => setDraft({ ...draft, areaText })} placeholder="Örnek: 120" />
          <ErrorNote message={error} />
          <BigButton label="Devam" icon="→" onPress={() => {
            try {
              squareMetersFromUserInput(draft.areaText, draft.areaUnit);
            } catch {
              setError("Arazi büyüklüğünü kontrol et.");
              return;
            }
            next("crops");
          }} />
        </>
      ) : null}

      {step === "crops" ? (
        <>
          <PageTitle hint="Birden fazla seçebilirsin.">Ne ekiyorsun?</PageTitle>
          {cropCodes.map((crop) => (
            <ChoiceCard
              key={crop}
              icon={cropIcons[crop]}
              label={cropTemplates[crop].label}
              selected={draft.cropCodes.includes(crop)}
              onPress={() => setDraft({ ...draft, cropCodes: toggleCrop(draft.cropCodes, crop) })}
            />
          ))}
          <ErrorNote message={error} />
          <BigButton
            label={saving ? "Defter hazırlanıyor…" : "Defteri aç"}
            icon="→"
            disabled={saving}
            onPress={() => draft.cropCodes.length > 0 ? void finish() : setError("En az bir ürün seç.")}
          />
        </>
      ) : null}

      {step !== "welcome" ? (
        <SecondaryButton
          label="Geri"
          disabled={saving}
          onPress={() => {
            const target = previousOnboardingStep(step);
            if (target !== "exit") next(target);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { color: theme.color.textMuted, fontSize: 15, fontWeight: "800", alignSelf: "flex-end" },
  hero: {
    minHeight: 200,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16
  },
  heroIcon: { fontSize: 58 },
  heroText: { color: theme.color.text, fontSize: 20, fontWeight: "800", textAlign: "center", lineHeight: 28 }
});
