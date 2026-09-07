import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { loadFarmIdentity } from "@/src/application/appSnapshot";
import { LocalDebtDetailsRepository, type DebtDetail } from "@/src/application/localDebtDetailsRepository";
import { debtSourceLabel, type DebtPayment } from "@/src/domain/debt";
import { formatTry } from "@/src/domain/money";
import { mobileDatabase } from "@/src/mobile/database";
import { dateInputFromIso } from "@/src/mobile/date";
import { BigButton, Card, ErrorNote, PageTitle, Screen, SecondaryButton, SectionTitle } from "@/src/ui/components";
import { theme } from "@/src/ui/theme";

export default function DebtDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const sqlite = useSQLiteContext();
  const [farmId, setFarmId] = useState<string>();
  const [detail, setDetail] = useState<DebtDetail>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

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
      const loaded = await new LocalDebtDetailsRepository(db).load(identity.farmId, debtId);
      setFarmId(identity.farmId);
      setDetail(loaded);
      setError(undefined);
    } catch {
      setError("Borç ayrıntılarını şu an gösteremedik. Kayıtların değiştirilmedi.");
    }
  }, [params.id, sqlite]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const reversePayment = async (paymentId: string) => {
    if (busyRef.current || farmId === undefined || detail === undefined) return;
    busyRef.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await new LocalDebtDetailsRepository(mobileDatabase(sqlite)).reversePayment({
        farmId,
        debtId: detail.balance.debt.id,
        paymentId,
        nowIso: new Date().toISOString()
      });
      await refresh();
    } catch {
      setError("Ödemeyi geri alamadık. Borç hesabı değiştirilmedi.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const deleteDebt = async () => {
    if (busyRef.current || farmId === undefined || detail === undefined) return;
    busyRef.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await new LocalDebtDetailsRepository(mobileDatabase(sqlite)).deleteDebtWithoutPayments({
        farmId,
        debtId: detail.balance.debt.id,
        nowIso: new Date().toISOString()
      });
      router.replace("/debts");
    } catch {
      setError("Borç kaydını silemedik. Aktif ödeme varsa önce yanlış ödeme kayıtlarını geri al.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const confirmReverse = (payment: DebtPayment) => {
    Alert.alert(
      "Ödeme geri alınsın mı?",
      `${dateInputFromIso(payment.occurredOn)} tarihli ${formatTry(payment.amountKurus)} ödeme borç hesabından kaldırılacak.`,
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Geri al", style: "destructive", onPress: () => void reversePayment(payment.id) }
      ]
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      "Borç kaydı silinsin mi?",
      "Borç ve ödeme planı listeden kaldırılacak. Aktif ödeme varsa silme yapılmaz.",
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Borcu sil", style: "destructive", onPress: () => void deleteDebt() }
      ]
    );
  };

  if (detail === undefined) {
    return (
      <Screen>
        <PageTitle hint="Borç hesabı hazırlanıyor.">Borç ayrıntısı</PageTitle>
        <ErrorNote message={error} />
        <SecondaryButton label="Borçlara dön" onPress={() => router.replace("/debts")} />
      </Screen>
    );
  }

  const { balance, installments, payments } = detail;

  return (
    <Screen>
      <PageTitle hint={debtSourceLabel(balance.debt.sourceKind)}>{balance.debt.creditorName}</PageTitle>

      <View style={styles.balanceBlock}>
        <Text style={styles.balanceLabel}>Kalan borç</Text>
        <Text style={balance.remainingKurus > 0 ? styles.balanceAmount : styles.closedAmount}>
          {balance.remainingKurus > 0 ? formatTry(balance.remainingKurus) : "Kapandı"}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Toplam {formatTry(balance.debt.totalKurus)}</Text>
          <Text style={styles.metaText}>Ödenen {formatTry(balance.paidKurus)}</Text>
        </View>
        {balance.debt.inKindDescription ? (
          <Text style={styles.description}>Mal olarak: {balance.debt.inKindDescription}</Text>
        ) : null}
        {balance.debt.note ? <Text style={styles.description}>{balance.debt.note}</Text> : null}
      </View>

      {balance.remainingKurus > 0 ? (
        <BigButton
          label="Ödeme kaydet"
          icon="+"
          disabled={busy}
          onPress={() => router.push({ pathname: "/debt-payment", params: { id: balance.debt.id } })}
        />
      ) : null}

      <SectionTitle detail={`${installments.length} ödeme`}>Ödeme planı</SectionTitle>
      {installments.map((installment, index) => (
        <View key={installment.id} style={[styles.row, index > 0 && styles.rowDivider]}>
          <Text style={styles.rowDate}>{dateInputFromIso(installment.dueOn)}</Text>
          <Text style={styles.rowAmount}>{formatTry(installment.amountKurus)}</Text>
        </View>
      ))}

      <SectionTitle detail={`${payments.length} kayıt`}>Yaptığın ödemeler</SectionTitle>
      {payments.length === 0 ? (
        <Card tone="soft">
          <Text style={styles.emptyTitle}>Henüz ödeme yok</Text>
          <Text style={styles.emptyText}>Ödeme yaptığında burada tarih ve tutarıyla görünecek.</Text>
        </Card>
      ) : null}

      {payments.map((payment) => (
        <Card key={payment.id}>
          <View style={styles.paymentHead}>
            <Text style={styles.rowDate}>{dateInputFromIso(payment.occurredOn)}</Text>
            <Text style={styles.paymentAmount}>{formatTry(payment.amountKurus)}</Text>
          </View>
          {payment.note ? <Text style={styles.description}>{payment.note}</Text> : null}
          <SecondaryButton
            label="Bu ödemeyi geri al"
            disabled={busy}
            onPress={() => confirmReverse(payment)}
          />
        </Card>
      ))}

      <ErrorNote message={error} />

      {payments.length === 0 ? (
        <SecondaryButton label="Bu borç kaydını sil" disabled={busy} onPress={confirmDelete} />
      ) : null}
      <SecondaryButton label="Borçlara dön" disabled={busy} onPress={() => router.replace("/debts")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  balanceBlock: {
    gap: 7,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.divider
  },
  balanceLabel: { color: theme.color.textMuted, fontSize: 13, fontWeight: "700" },
  balanceAmount: { color: theme.color.expense, fontSize: 36, lineHeight: 44, fontWeight: "900", letterSpacing: -1 },
  closedAmount: { color: theme.color.income, fontSize: 26, lineHeight: 34, fontWeight: "900" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", gap: 14 },
  metaText: { color: theme.color.textMuted, fontSize: 13, fontWeight: "700" },
  description: { color: theme.color.textMuted, fontSize: 13, fontWeight: "600", lineHeight: 19 },
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: theme.color.divider },
  rowDate: { color: theme.color.text, fontSize: 14, fontWeight: "800" },
  rowAmount: { color: theme.color.text, fontSize: 14, fontWeight: "900" },
  paymentHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  paymentAmount: { color: theme.color.income, fontSize: 16, fontWeight: "900" },
  emptyTitle: { color: theme.color.text, fontSize: 17, fontWeight: "900" },
  emptyText: { color: theme.color.textMuted, fontSize: 14, fontWeight: "600", lineHeight: 20 }
});
