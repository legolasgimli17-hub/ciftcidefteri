import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { loadFarmIdentity } from "@/src/application/appSnapshot";
import { LocalPartnershipRepository } from "@/src/application/localPartnershipRepository";
import { createFarmPartner } from "@/src/domain/partner";
import { mobileDatabase } from "@/src/mobile/database";
import { createLocalId } from "@/src/mobile/id";
import { BigButton, Card, ErrorNote, Field, PageTitle, Screen, SecondaryButton } from "@/src/ui/components";
import { theme } from "@/src/ui/theme";

export default function PartnerNewScreen() {
  const sqlite = useSQLiteContext();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(undefined);
    try {
      const db = mobileDatabase(sqlite);
      const identity = await loadFarmIdentity(db);
      if (identity === null) {
        router.replace("/onboarding");
        return;
      }
      const partner = createFarmPartner({ id: createLocalId("partner"), name });
      await new LocalPartnershipRepository(db).addPartner({
        farmId: identity.farmId,
        partner,
        nowIso: new Date().toISOString()
      });
      router.replace("/partners");
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("zaten var")) {
        setError("Bu isimde bir ortak zaten var.");
      } else {
        setError("Ortağı kaydedemedik. İsmi kontrol edip tekrar dene.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <PageTitle hint="Telefon numarası istemiyoruz. Ortak adı yalnız defter hesabını ayırmak için tutulur.">
        Ortak ekle
      </PageTitle>
      <Card tone="soft">
        <Text style={styles.infoTitle}>Bir kez ekle, kayıtlarda seç</Text>
        <Text style={styles.infoCopy}>Örneğin Mehmet ile pamuk işini ortak yapıyorsan sadece “Mehmet” veya “Mehmet Kaya” yazman yeterli.</Text>
      </Card>
      <Field
        label="Ortağın adı"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        placeholder="Örnek: Mehmet Kaya"
        returnKeyType="done"
        onSubmitEditing={() => void save()}
      />
      <ErrorNote message={error} />
      <BigButton label={saving ? "Kaydediliyor…" : "Ortağı kaydet"} icon="+" disabled={saving} onPress={() => void save()} />
      <SecondaryButton label="Vazgeç" disabled={saving} onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  infoTitle: { color: theme.color.text, fontSize: 17, fontWeight: "900" },
  infoCopy: { color: theme.color.textMuted, fontSize: 15, fontWeight: "600", lineHeight: 22 }
});
