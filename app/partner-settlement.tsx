import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { loadFarmIdentity } from "@/src/application/appSnapshot";
import { LocalPartnershipRepository, type PartnerBalance } from "@/src/application/localPartnershipRepository";
import { formatTry, moneyFromUserInput } from "@/src/domain/money";
import { createPartnershipSettlement } from "@/src/domain/partnershipSettlement";
import { mobileDatabase } from "@/src/mobile/database";
import { dateInputFromIso, isoDateFromTurkishInput, todayIsoLocal } from "@/src/mobile/date";
import { createLocalId } from "@/src/mobile/id";
import { BigButton, ErrorNote, Field, PageTitle, Screen, SecondaryButton } from "@/src/ui/components";
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
      const amountKurus = moneyFromUserInput(amountText);
      const openAmount = balance.netKurus > 0 ? balance.receivableKurus : balance.payableKurus;
      if (amountKurus > openAmount) {
        setError("Ödeme açık hesaptan büyük olamaz.");
        return;
      }

      const settlement = createPartnershipSettlement({
        id: createLocalId("settlement"),
        partnerId: balance.partnerId,
        amountKurus,
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
    } catch {
      setError("Ödemeyi kaydedemedik. Tutarı ve tarihi kontrol et.");
    } finally {
      setSaving(false);
    }
  };

  if (balance === undefined) {
    return (
      <Screen>
        <PageTitle hint="Ortak hesabı hazırlanıyor.">Ödeme</PageTitle>
        <ErrorNote message={error} />
        <SecondaryButton label="Ortaklara dön" onPress={() => router.replace("/partners")} />
      </Screen>
    );
  }

  const isReceivable = balance.netKurus > 0;
  const openAmount = isReceivable ? balance.receivableKurus : balance.payableKurus;

  return (
    <Screen>
      <PageTitle hint={balance.partnerName}>Ödeme kaydet</PageTitle>

      <View style={styles.openBalance}>
        <Text style={styles.openLabel}>{isReceivable ? "Bana ödeyecek" : balance.netKurus < 0 ? "Ben ödeyeceğim" : "Hesap kapalı"}</Text>
        <Text style={[styles.openAmount, isReceivable ? styles.receivable : styles.payable]}>{formatTry(openAmount)}</Text>
        <Text style={styles.explanation}>Bu ödeme yalnız ortak hesabını azaltır; gelir ve gider toplamını değiştirmez.</Text>
      </View>

      {balance.netKurus === 0 ? (
        <View style={styles.closed}>
          <Text style={styles.closedTitle}>Açık hesap yok</Text>
          <Text style={styles.closedCopy}>Bu ortakla hesap şu an sıfır.</Text>
        </View>
      ) : (
        <>
          <Field label="Ödenen tutar" keyboardType="decimal-pad" value={amountText} onChangeText={setAmountText} placeholder="0,00 TL" />
          <Field label="Tarih" keyboardType="numeric" value={dateText} onChangeText={setDateText} placeholder="GG.AA.YYYY" />
          <Field label="Not" hint="İsteğe bağlı" value={noteText} onChangeText={setNoteText} placeholder="Örnek: Elden ödeme" maxLength={180} />
          <ErrorNote message={error} />
          <BigButton label={saving ? "Kaydediliyor…" : "Ödemeyi kaydet"} icon="✓" disabled={saving} onPress={() => void save()} />
        </>
      )}

      <SecondaryButton label="Ortaklara dön" disabled={saving} onPress={() => router.replace("/partners")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  openBalance: {
    gap: 6,
    paddingVertical: 22,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.divider
  },
  openLabel: { color: theme.color.textMuted, fontSize: 13, fontWeight: "700" },
  openAmount: { fontSize: 36, fontWeight: "900", letterSpacing: -1 },
  receivable: { color: theme.color.income },
  payable: { color: theme.color.expense },
  explanation: { color: theme.color.textMuted, fontSize: 13, fontWeight: "600", lineHeight: 19, marginTop: 5 },
  closed: { minHeight: 110, justifyContent: "center", gap: 5, borderBottomWidth: 1, borderBottomColor: theme.color.divider },
  closedTitle: { color: theme.color.text, fontSize: 18, fontWeight: "900" },
  closedCopy: { color: theme.color.textMuted, fontSize: 14, fontWeight: "600" }
});
