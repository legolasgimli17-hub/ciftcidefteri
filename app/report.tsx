import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  loadCropFinanceReport,
  type CropFinanceReport,
  type CropFinanceRow,
  type FinanceAmounts
} from "@/src/application/cropFinanceReport";
import { formatTry } from "@/src/domain/money";
import { mobileDatabase } from "@/src/mobile/database";
import { Card, PageTitle, Screen, SecondaryButton } from "@/src/ui/components";
import { theme } from "@/src/ui/theme";

export default function CropFinanceReportScreen() {
  const sqlite = useSQLiteContext();
  const [report, setReport] = useState<CropFinanceReport | null>(null);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      const loaded = await loadCropFinanceReport(mobileDatabase(sqlite));
      if (loaded === null) {
        setReport(null);
        setError(undefined);
        router.replace("/onboarding");
        return;
      }
      setReport(loaded);
      setError(undefined);
    } catch {
      setReport(null);
      setError("Ürün özetini şu an açamadık. Kayıtların güvende.");
    }
  }, [sqlite]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  return (
    <Screen>
      <PageTitle hint="Paran hangi üründe nasıl gidiyor?">Ürünlere göre</PageTitle>

      {report ? (
        <>
          <SummaryCard label="Tüm defter" amounts={report.overall} />
          {report.rows.map((row) => <CropSummaryCard key={row.key} row={row} />)}
        </>
      ) : null}

      {error ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <SecondaryButton label="Deftere dön" onPress={() => router.replace("/home")} />
    </Screen>
  );
}

function CropSummaryCard({ row }: { readonly row: CropFinanceRow }) {
  let note: string | undefined;
  if (row.key === "general") {
    note = "Bir ürüne bağlanmayan kayıtlar.";
  } else if (row.isHistorical) {
    note = "Bu ürüne ait eski kayıtların toplamı.";
  }

  return <SummaryCard label={row.label} amounts={row} note={note} />;
}

function SummaryCard(props: {
  readonly label: string;
  readonly amounts: FinanceAmounts;
  readonly note?: string;
}) {
  return (
    <Card>
      <View style={styles.headingBlock}>
        <Text style={styles.cardTitle}>{props.label}</Text>
        {props.note ? <Text style={styles.note}>{props.note}</Text> : null}
      </View>
      <MoneyLine label="Giren" value={props.amounts.incomeKurus} tone="income" />
      <MoneyLine label="Çıkan" value={props.amounts.expenseKurus} tone="expense" />
      <MoneyLine label="Kalan" value={props.amounts.netKurus} tone="net" />
    </Card>
  );
}

function MoneyLine(props: {
  readonly label: string;
  readonly value: FinanceAmounts["netKurus"];
  readonly tone: "income" | "expense" | "net";
}) {
  const valueStyle = props.tone === "income"
    ? styles.income
    : props.tone === "expense"
      ? styles.expense
      : props.value > 0
        ? styles.income
        : props.value < 0
          ? styles.expense
          : styles.neutral;

  return (
    <View style={styles.moneyLine}>
      <Text style={styles.moneyLabel}>{props.label}</Text>
      <Text style={[styles.moneyValue, valueStyle]}>{formatTry(props.value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headingBlock: { gap: 4 },
  cardTitle: { color: theme.color.text, fontSize: 20, fontWeight: "900" },
  note: { color: theme.color.textMuted, fontSize: 15, lineHeight: 21 },
  moneyLine: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  moneyLabel: { color: theme.color.text, fontSize: 17, fontWeight: "800" },
  moneyValue: { fontSize: 18, fontWeight: "900", textAlign: "right", flexShrink: 1 },
  income: { color: theme.color.income },
  expense: { color: theme.color.expense },
  neutral: { color: theme.color.text },
  error: { color: theme.color.expense, fontSize: 16, fontWeight: "700", lineHeight: 22 }
});
