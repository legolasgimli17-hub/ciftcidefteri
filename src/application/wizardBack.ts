export type OnboardingStep = "welcome" | "name" | "phone" | "place" | "area" | "crops" | "cks";
export type CreateTransactionStep = "amount" | "crop" | "category" | "done";
export type EditTransactionStep = "details" | "scope" | "category" | "done";

export type OnboardingBackAction = "exit" | Exclude<OnboardingStep, "cks">;
export type CreateBackAction = "exit" | "amount" | "crop" | "home";
export type EditBackAction = "exit" | "details" | "scope" | "home";

export function previousOnboardingStep(step: OnboardingStep): OnboardingBackAction {
  switch (step) {
    case "welcome": return "exit";
    case "name": return "welcome";
    case "phone": return "name";
    case "place": return "phone";
    case "area": return "place";
    case "crops": return "area";
    case "cks": return "crops";
  }
}

export function previousCreateTransactionStep(
  step: CreateTransactionStep,
  cropCount: number
): CreateBackAction {
  if (step === "amount") return "exit";
  if (step === "crop") return "amount";
  if (step === "done") return "home";
  return cropCount > 1 ? "crop" : "amount";
}

export function previousEditTransactionStep(step: EditTransactionStep): EditBackAction {
  if (step === "details") return "exit";
  if (step === "scope") return "details";
  if (step === "category") return "scope";
  return "home";
}
