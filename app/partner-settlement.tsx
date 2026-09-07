import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { loadFarmIdentity } from "@/src/application/appSnapshot";
import { LocalPartnershipRepository, type PartnerBalance } from "@/src/application/localPartnershipRepository";
import { formatTry, moneyFromUserInput } from "@/src/domain/money";
import { createPartnershipSettlement } from "@/src/domain/partnershipSettlement";
import { mobileDatabase } from "@/src/mobile/database";
import { dateInputFromIso, isoDateFromTurkishInput, todayIsoLocal } from "@/src/mobile/date";
import { createLocalId } from "@/src/mobile/id";
import { BigButton, Card, ErrorNote, Field, PageTitle, Pill, Screen, SecondaryButton } from "@/src/ui/components";
import { theme } from "@/src/ui/theme";

export default function PartnerSettlementScreen() {
  const params = useLocalSearchParams<{ partnerId?: string }>();
  const sqlite = useSQLiteContext();
  const [balance, setBalance] = useState<PartnerBalance>();
  const [amountText, setAmountText] = useState("");
  const [dateText, setDateText] = useState(() => dateInputFromIso(todayIsoLocal()));
  const [noteText, setNoteText] = useState("");
  const [farmId, setFarmId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    const partnerId = params.partnerId;
    if (!partnerId) {
      setError("Ortak bilgisi bulunamadı.");
      return;
    }
    try {
      const db = mobileDatabase(sqlite);
      const identity = await loadFarmIdentity(db);
      if (identity === null) {
        router.replace("/onboarding");
        return;
      }
      const item = (await new LocalPartnershipRepository(db).balances(identity.farmId))
        .find((row) => row.partnerId === partnerId);
      if (item === undefined) {
        setError("Ortak hesabı bulunamadı.");
        return;
      }
      setFarmId(identity.farmId);
      setBalance(item);
      const openAmount = item.netKurus > 0 ? item.receivableKurus : item.payableKurus;
      if (amountText.length === 0 && openAmount > 0) {
        setAmountText(String(openAmount / 100).replace(".", ","));
      }
      setError(undefined);
    } catch {
      setError("Ortak hesabını şu an okuyamadık. Defter kayıtların değiştirilmedi.");
    }
  }, [amountText.length, params.partnerId, sqlite]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const save = async () => {
    if (saving || balance === undefined || farmId === undefined || balance.netKurus === 0) return;
    setSaving(true);
    setError(undefined);
    try {
      const settlement = createPartnershipSettlement({
        id: createLocalId("settlement"),
        partnerId: balance.partnerId,
        amountKurus: moneyFromUserInput(amountText),
        occurredOn: isoDateFromTurkishInput(dateText),
        direction: balance.netKurus > 0 ? "partner_to_owner" : "owner_to_partner",
        ...(noteText.trim().length === 0 ? {} : { note: noteText })
      });
      await new LocalPartnershipRepository(mobileDatabase(sqlite)).addSettlement({
        farmId,
        settlement,
        nowIso: new Date().toISOString()
      });
      router.replace("/partners");
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("aşıyor")) {
        setError("Ödeme açık hesaptan büyük olamaz.");
      } else {
        setError("Ödemeyi kaydedemedik. Tutarı ve tarihi kontrol et.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (balance === undefined) {
    return (
      <Screen>
        <PageTitle hint="Ortak hesabı hazırlanıyor.">Hesap kapatma</PageTitle>
        <ErrorNote message={error} />
        <SecondaryButton label="Ortak hesaplarına dön" onPress={() => router.replace("/partners")} />
      </Screen>
    );
  }

  const isReceivable = balance.netKurus > 0;
  const openAmount = isReceivable ? balance.receivableKurus : balance.payableKurus;

  return (
    <Screen>
      <PageTitle hint="Gerçek bir ödeme olduğunda buraya yaz. Bu hareket kâr-zarara eklenmez.">
        Hesap kapatma
      </PageTitle>

      <Card tone="strong">
        <Text style={styles.eyebrow}>ORTAK HESABI</Text>
        <Text style={styles.partnerName}>{balance.partnerName}</Text>
        <Pill label={isReceivable ? "Sana ödenecek" : balance.netKurus < 0 ? "Sen ödeyeceksin" : "Hesap kapalı"} tone={isReceivable ? "income" : balance.netKurus < 0 ? "expense" : "neutral"} />
        <Text style={styles.openLabel}>Açık tutar</Text>
        <Text style={[styles.openAmount, isReceivable ? styles.receivable : styles.payable]}>{formatTry(openAmount)}</Text>
      </Card>

      {balance.netKurus === 0 ? (
        <Card tone="soft">
          <Text style={styles.closedTitle}>Açık hesap yok</Text>
          <Text style={styles.closedCopy}>Bu ortakla hesap şu an sıfır. Ödeme kaydı eklemene gerek yok.</Text>
        </Card>
      ) : (
        <>
          <Field label="Ödenen tutar" keyboardType="decimal-pad" value={amountText} onChangeText={setAmountText} placeholder="0,00 TL" />
          <Field label="Tarih" keyboardType="numeric" value={dateText} onChangeText={setDateText} placeholder="GG.AA.YYYY" />
          <Field label="Not" hint="İsteğe bağlı" value={noteText} onChangeText={setNoteText} placeholder="Örnek: Elden ödeme" maxLength={180} />
          <Card tone="soft">
            <Text style={styles.ruleTitle}>Bu kayıt ne yapar?</Text>
            <Text style={styles.ruleCopy}>Yalnız {balance.partnerName} ile açık hesabı azaltır. Gelir veya gider toplamını değiştirmez.</Text>
          </Card>
          <ErrorNote message={error} />
          <BigButton label={saving ? "Kaydediliyor…" : "Ödemeyi kaydet"} icon="✓" disabled={saving} onPress={() => void save()} />
        </>
      )}

      <SecondaryButton label="Ortak hesaplarına dön" disabled={saving} onPress={() => router.replace("/partners")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: theme.color.gold, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  partnerName: { color: theme.color.white, fontSize: 23, fontWeight: "900", letterSpacing: -0.35 },
  openLabel: { color: "#B8C7BF", fontSize: 13, fontWeight: "700" },
  openAmount: { fontSize: 32, fontWeight: "900", letterSpacing: -0.8 },
  receivable: { color: "#8DE0AC" },
  payable: { color: "#FFAAA4" },
  closedTitle: { color: theme.color.text, fontSize: 18, fontWeight: "900" },
  closedCopy: { color: theme.color.textMuted, fontSize: 15, fontWeight: "600", lineHeight: 22 },
  ruleTitle: { color: theme.color.text, fontSize: 16, fontWeight: "900" },
  ruleCopy: { color: theme.color.textMuted, fontSize: 14, fontWeight: "600", lineHeight: 21 }
});
