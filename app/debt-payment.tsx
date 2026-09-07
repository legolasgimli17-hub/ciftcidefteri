import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { loadFarmIdentity } from "@/src/application/appSnapshot";
import { LocalDebtRepository, type DebtBalance } from "@/src/application/localDebtRepository";
import { createDebtPayment } from "@/src/domain/debt";
import { formatTry, moneyFromUserInput } from "@/src/domain/money";
import { mobileDatabase } from "@/src/mobile/database";
import { dateInputFromIso, isoDateFromTurkishInput, todayIsoLocal } from "@/src/mobile/date";
import { createLocalId } from "@/src/mobile/id";
import { BigButton, ErrorNote, Field, PageTitle, Screen, SecondaryButton } from "@/src/ui/components";
import { theme } from "@/src/ui/theme";

export default function DebtPaymentScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const sqlite = useSQLiteContext();
  const [balance, setBalance] = useState<DebtBalance>();
  const [farmId, setFarmId] = useState<string>();
  const [amountText, setAmountText] = useState("");
  const [dateText, setDateText] = useState(() => dateInputFromIso(todayIsoLocal()));
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const savingRef = useRef(false);

  const refresh = useCallback(async () => {
    const debtId = params.id;
    if (!debtId) {
      setError("Borç bilgisi bulunamadı.");
      return;
    }
    try {
      const db = mobileDatabase(sqlite);
      const identity = await loadFarmIdentity(db);
      if (identity === null) {
        router.replace("/onboarding");
        return;
      }
      const item = (await new LocalDebtRepository(db).listBalances(identity.farmId))
        .find((row) => row.debt.id === debtId);
      if (item === undefined) {
        setError("Borç kaydı bulunamadı.");
        return;
      }
      setFarmId(identity.farmId);
      setBalance(item);
      setError(undefined);
    } catch {
      setError("Borç hesabını şu an okuyamadık. Kayıtların değiştirilmedi.");
    }
  }, [params.id, sqlite]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const save = async () => {
    if (savingRef.current || balance === undefined || farmId === undefined || balance.remainingKurus <= 0) return;
    setError(undefined);

    let payment: ReturnType<typeof createDebtPayment>;
    try {
      const amountKurus = moneyFromUserInput(amountText);
      if (amountKurus > balance.remainingKurus) {
        throw new Error("Ödeme kalan borçtan büyük olamaz.");
      }
      payment = createDebtPayment({
        id: createLocalId("debtpay"),
        amountKurus,
        occurredOn: isoDateFromTurkishInput(dateText),
        ...(noteText.trim().length === 0 ? {} : { note: noteText })
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ödeme bilgilerini kontrol et.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      await new LocalDebtRepository(mobileDatabase(sqlite)).addPayment({
        farmId,
        debtId: balance.debt.id,
        payment,
        nowIso: new Date().toISOString()
      });
      router.replace("/debts");
    } catch {
      setError("Ödemeyi şu an kaydedemedik. Tutarı ve tarihi kontrol et.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (balance === undefined) {
    return (
      <Screen>
        <PageTitle hint="Borç hesabı hazırlanıyor.">Ödeme kaydet</PageTitle>
        <ErrorNote message={error} />
        <SecondaryButton label="Borçlara dön" onPress={() => router.replace("/debts")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <PageTitle hint={balance.debt.creditorName}>Ödeme kaydet</PageTitle>

      <View style={styles.balanceBlock}>
        <Text style={styles.balanceLabel}>Kalan borç</Text>
        <Text style={styles.balanceAmount}>{formatTry(balance.remainingKurus)}</Text>
        {balance.nextDueOn && balance.nextDueAmountKurus ? (
          <Text style={styles.nextText}>
            Sıradaki: {dateInputFromIso(balance.nextDueOn)} · {formatTry(balance.nextDueAmountKurus)}
          </Text>
        ) : null}
        <Text style={styles.explanation}>
          Bu ödeme borcu azaltır; Defterindeki gelir ve gider toplamını değiştirmez.
        </Text>
      </View>

      {balance.remainingKurus > 0 ? (
        <>
          <Field
            label="Ne kadar ödedin?"
            value={amountText}
            onChangeText={setAmountText}
            placeholder="Örnek: 25.000"
            keyboardType="decimal-pad"
          />
          <Field
            label="Ödeme tarihi"
            value={dateText}
            onChangeText={setDateText}
            placeholder="GG.AA.YYYY"
            keyboardType="numbers-and-punctuation"
          />
          <Field
            label="Not"
            hint="İsteğe bağlı"
            value={noteText}
            onChangeText={setNoteText}
            placeholder="Örnek: Bankadan yatırdım"
            maxLength={180}
          />
          <ErrorNote message={error} />
          <BigButton
            label={saving ? "Kaydediliyor…" : "Ödemeyi kaydet"}
            icon="✓"
            disabled={saving}
            onPress={() => void save()}
          />
        </>
      ) : (
        <View style={styles.closedBox}>
          <Text style={styles.closedTitle}>Bu borç kapandı</Text>
          <Text style={styles.closedText}>Yeni ödeme kaydı gerekmiyor.</Text>
        </View>
      )}

      <SecondaryButton label="Borçlara dön" disabled={saving} onPress={() => router.replace("/debts")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  balanceBlock: {
    gap: 6,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.divider
  },
  balanceLabel: { color: theme.color.textMuted, fontSize: 13, fontWeight: "700" },
  balanceAmount: { color: theme.color.expense, fontSize: 36, lineHeight: 44, fontWeight: "900", letterSpacing: -1 },
  nextText: { color: theme.color.text, fontSize: 14, fontWeight: "800", marginTop: 3 },
  explanation: { color: theme.color.textMuted, fontSize: 13, fontWeight: "600", lineHeight: 19, marginTop: 5 },
  closedBox: { minHeight: 110, justifyContent: "center", gap: 5 },
  closedTitle: { color: theme.color.income, fontSize: 18, fontWeight: "900" },
  closedText: { color: theme.color.textMuted, fontSize: 14, fontWeight: "600" }
});
