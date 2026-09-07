import { type PropsWithChildren, type ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type PressableStateCallbackType,
  type TextInputProps,
  View,
  type ViewStyle
} from "react-native";
import { uxPolicy } from "./policy";
import { theme } from "./theme";

export function Screen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function PageTitle({ children, hint }: PropsWithChildren<{ readonly hint?: string }>) {
  return (
    <View style={styles.titleBlock}>
      <Text accessibilityRole="header" style={styles.title}>{children}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function TopNav(props: {
  readonly active: "ledger" | "crops" | "partners";
  readonly onLedger: () => void;
  readonly onCrops: () => void;
  readonly onPartners: () => void;
}) {
  const items = [
    { key: "ledger" as const, label: "Defter", onPress: props.onLedger },
    { key: "crops" as const, label: "Ürünler", onPress: props.onCrops },
    { key: "partners" as const, label: "Ortaklar", onPress: props.onPartners }
  ];

  return (
    <View accessibilityRole="tablist" style={styles.topNav}>
      {items.map((item) => {
        const active = props.active === item.key;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
            onPress={item.onPress}
            style={({ pressed }) => [styles.topNavItem, active && styles.topNavItemActive, pressed && styles.topNavPressed]}
          >
            <Text style={[styles.topNavText, active && styles.topNavTextActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionTitle(props: {
  readonly children: ReactNode;
  readonly detail?: string;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{props.children}</Text>
      {props.detail ? <Text style={styles.sectionDetail}>{props.detail}</Text> : null}
    </View>
  );
}

export function BigButton(props: {
  readonly label: string;
  readonly icon: string;
  readonly onPress: () => void;
  readonly kind?: "primary" | "income" | "expense" | "neutral";
  readonly disabled?: boolean;
}) {
  const kind = props.kind ?? "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: props.disabled === true }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }: PressableStateCallbackType) => [
        styles.bigButton,
        kind === "primary" && styles.primary,
        kind === "income" && styles.income,
        kind === "expense" && styles.expense,
        kind === "neutral" && styles.neutral,
        pressed && !props.disabled && styles.pressed,
        props.disabled && styles.disabled
      ]}
    >
      <Text style={styles.bigButtonIcon}>{props.icon}</Text>
      <Text style={styles.bigButtonText}>{props.label}</Text>
    </Pressable>
  );
}

export function SecondaryButton(props: {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: props.disabled === true }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }: PressableStateCallbackType) => [
        styles.secondaryButton,
        pressed && !props.disabled && styles.secondaryPressed,
        props.disabled && styles.disabled
      ]}
    >
      <Text style={styles.secondaryButtonText}>{props.label}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps & { readonly label: string; readonly hint?: string }) {
  const { label, hint, ...inputProps } = props;
  return (
    <View style={styles.fieldWrap}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      </View>
      <TextInput
        {...inputProps}
        accessibilityLabel={inputProps.accessibilityLabel ?? label}
        placeholderTextColor={theme.color.textSubtle}
        selectionColor={theme.color.primary}
        style={[styles.field, inputProps.style]}
      />
    </View>
  );
}

export function ChoiceCard(props: {
  readonly label: string;
  readonly icon?: string;
  readonly leading?: ReactNode;
  readonly caption?: string;
  readonly selected?: boolean;
  readonly onPress: () => void;
  readonly style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ selected: props.selected === true }}
      onPress={props.onPress}
      style={({ pressed }: PressableStateCallbackType) => [
        styles.choice,
        props.selected && styles.choiceSelected,
        pressed && styles.choicePressed,
        props.style
      ]}
    >
      {props.leading ?? (props.icon ? (
        <View style={styles.choiceIconWrap}>
          <Text style={styles.choiceIcon}>{props.icon}</Text>
        </View>
      ) : null)}
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceText}>{props.label}</Text>
        {props.caption ? <Text style={styles.choiceCaption}>{props.caption}</Text> : null}
      </View>
      <View style={[styles.choiceIndicator, props.selected && styles.choiceIndicatorSelected]}>
        {props.selected ? <View style={styles.choiceIndicatorDot} /> : null}
      </View>
    </Pressable>
  );
}

export function Pill(props: {
  readonly label: string;
  readonly tone?: "neutral" | "income" | "expense" | "warning";
}) {
  const tone = props.tone ?? "neutral";
  return (
    <View style={[
      styles.pill,
      tone === "income" && styles.pillIncome,
      tone === "expense" && styles.pillExpense,
      tone === "warning" && styles.pillWarning
    ]}>
      <Text style={[
        styles.pillText,
        tone === "income" && styles.pillIncomeText,
        tone === "expense" && styles.pillExpenseText,
        tone === "warning" && styles.pillWarningText
      ]}>{props.label}</Text>
    </View>
  );
}

export function ErrorNote({ message }: { readonly message: string | undefined }) {
  return message ? (
    <View style={styles.errorBox}>
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
        {message}
      </Text>
    </View>
  ) : null;
}

export function Card(props: PropsWithChildren<{
  readonly tone?: "default" | "strong" | "soft";
  readonly style?: ViewStyle;
}>) {
  const tone = props.tone ?? "default";
  return (
    <View style={[
      styles.card,
      tone === "strong" && styles.cardStrong,
      tone === "soft" && styles.cardSoft,
      props.style
    ]}>
      {props.children}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.color.background },
  screen: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 48,
    backgroundColor: theme.color.background,
    gap: theme.spacing.md
  },
  titleBlock: { gap: 5, marginBottom: 2 },
  title: {
    color: theme.color.text,
    fontSize: theme.type.title,
    fontWeight: "900",
    lineHeight: 36,
    letterSpacing: -0.8
  },
  hint: { color: theme.color.textMuted, fontSize: 15, lineHeight: 21, fontWeight: "600" },
  topNav: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.color.surfaceMuted,
    borderRadius: theme.radius.md,
    padding: 4,
    gap: 3
  },
  topNavItem: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  topNavItemActive: { backgroundColor: theme.color.surface },
  topNavPressed: { opacity: 0.75 },
  topNavText: { color: theme.color.textMuted, fontSize: 14, fontWeight: "800" },
  topNavTextActive: { color: theme.color.text },
  sectionTitleRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 10
  },
  sectionTitle: { color: theme.color.text, fontSize: theme.type.section, fontWeight: "900", letterSpacing: -0.2 },
  sectionDetail: { color: theme.color.textMuted, fontSize: theme.type.caption, fontWeight: "700" },
  bigButton: {
    minHeight: 58,
    borderRadius: theme.radius.md,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  primary: { backgroundColor: theme.color.primary },
  income: { backgroundColor: theme.color.income },
  expense: { backgroundColor: theme.color.expense },
  neutral: { backgroundColor: theme.color.surfaceStrong },
  pressed: { transform: [{ scale: 0.995 }], opacity: 0.9 },
  secondaryPressed: { backgroundColor: theme.color.surfaceMuted },
  disabled: { opacity: 0.45 },
  bigButtonIcon: { color: theme.color.white, fontSize: 18, fontWeight: "900" },
  bigButtonText: { color: theme.color.white, fontSize: theme.type.button, fontWeight: "900", letterSpacing: -0.1 },
  secondaryButton: {
    minHeight: uxPolicy.standardControlHeightPx,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.borderStrong,
    backgroundColor: theme.color.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  secondaryButtonText: { color: theme.color.text, fontSize: 15, fontWeight: "800" },
  fieldWrap: { gap: 8 },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  fieldLabel: { color: theme.color.text, fontSize: 15, fontWeight: "800" },
  fieldHint: { color: theme.color.textSubtle, fontSize: 12, fontWeight: "700" },
  field: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: theme.color.borderStrong,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: "600",
    color: theme.color.text
  },
  choice: {
    minHeight: 68,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 12
  },
  choiceSelected: { borderColor: theme.color.primary, backgroundColor: theme.color.primarySoft },
  choicePressed: { opacity: 0.88 },
  choiceIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: theme.color.surfaceMuted,
    alignItems: "center",
    justifyContent: "center"
  },
  choiceIcon: { fontSize: 21 },
  choiceCopy: { flex: 1, gap: 3 },
  choiceText: { fontSize: 17, color: theme.color.text, fontWeight: "800", flexShrink: 1 },
  choiceCaption: { fontSize: 13, color: theme.color.textMuted, fontWeight: "600", lineHeight: 18 },
  choiceIndicator: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: theme.color.borderStrong,
    alignItems: "center",
    justifyContent: "center"
  },
  choiceIndicatorSelected: { borderColor: theme.color.primary },
  choiceIndicatorDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.color.primary },
  pill: {
    alignSelf: "flex-start",
    borderRadius: theme.radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: theme.color.surfaceMuted
  },
  pillIncome: { backgroundColor: theme.color.incomeSoft },
  pillExpense: { backgroundColor: theme.color.expenseSoft },
  pillWarning: { backgroundColor: theme.color.warningSoft },
  pillText: { color: theme.color.textMuted, fontSize: 11, fontWeight: "800" },
  pillIncomeText: { color: theme.color.income },
  pillExpenseText: { color: theme.color.expense },
  pillWarningText: { color: theme.color.warning },
  errorBox: {
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: theme.color.expenseSoft
  },
  error: { color: theme.color.expense, fontSize: 15, fontWeight: "700", lineHeight: 21 },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: 18,
    gap: theme.spacing.md
  },
  cardStrong: { backgroundColor: theme.color.surfaceStrong, borderColor: theme.color.surfaceStrong },
  cardSoft: { backgroundColor: theme.color.surfaceMuted, borderColor: theme.color.surfaceMuted }
});
