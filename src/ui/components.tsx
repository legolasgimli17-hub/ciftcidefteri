import { type PropsWithChildren } from "react";
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
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function PageTitle({ children, hint }: PropsWithChildren<{ readonly hint?: string }>) {
  return (
    <View style={styles.titleBlock}>
      <Text style={styles.title}>{children}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
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
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }: PressableStateCallbackType) => [
        styles.secondaryButton,
        pressed && !props.disabled && styles.pressed,
        props.disabled && styles.disabled
      ]}
    >
      <Text style={styles.secondaryButtonText}>{props.label}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps & { readonly label: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={theme.color.textMuted}
        style={[styles.field, props.style]}
      />
    </View>
  );
}

export function ChoiceCard(props: {
  readonly label: string;
  readonly icon: string;
  readonly selected?: boolean;
  readonly onPress: () => void;
  readonly style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: props.selected === true }}
      onPress={props.onPress}
      style={({ pressed }: PressableStateCallbackType) => [
        styles.choice,
        props.selected && styles.choiceSelected,
        pressed && styles.choicePressed,
        props.style
      ]}
    >
      <Text style={styles.choiceIcon}>{props.icon}</Text>
      <Text style={styles.choiceText}>{props.label}</Text>
    </Pressable>
  );
}

export function ErrorNote({ message }: { readonly message: string | undefined }) {
  return message ? <Text style={styles.error}>{message}</Text> : null;
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.color.background },
  screen: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: 48,
    backgroundColor: theme.color.background,
    gap: theme.spacing.md
  },
  titleBlock: { gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  title: { color: theme.color.text, fontSize: theme.type.title, fontWeight: "800", lineHeight: 36 },
  hint: { color: theme.color.textMuted, fontSize: theme.type.body, lineHeight: 24 },
  bigButton: {
    minHeight: uxPolicy.primaryActionHeightPx,
    borderRadius: theme.radius.md,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  primary: { backgroundColor: theme.color.primary },
  income: { backgroundColor: theme.color.income },
  expense: { backgroundColor: theme.color.expense },
  neutral: { backgroundColor: theme.color.text },
  pressed: { opacity: 0.86 },
  disabled: { opacity: 0.45 },
  bigButtonIcon: { fontSize: 22 },
  bigButtonText: { color: "#FFFFFF", fontSize: theme.type.button, fontWeight: "800" },
  secondaryButton: {
    minHeight: uxPolicy.standardControlHeightPx,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  secondaryButtonText: { color: theme.color.text, fontSize: 17, fontWeight: "800" },
  fieldWrap: { gap: 8 },
  fieldLabel: { color: theme.color.text, fontSize: 16, fontWeight: "700" },
  field: {
    minHeight: uxPolicy.standardControlHeightPx,
    borderWidth: 1.5,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 16,
    fontSize: 18,
    color: theme.color.text
  },
  choice: {
    minHeight: uxPolicy.primaryActionHeightPx,
    borderWidth: 1.5,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    gap: 12
  },
  choiceSelected: { borderColor: theme.color.primary, borderWidth: 2.5, backgroundColor: "#EAF2EC" },
  choicePressed: { opacity: 0.82 },
  choiceIcon: { fontSize: 24 },
  choiceText: { fontSize: 18, color: theme.color.text, fontWeight: "700", flexShrink: 1 },
  error: { color: theme.color.expense, fontSize: 16, fontWeight: "700", lineHeight: 22 },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.md
  }
});
