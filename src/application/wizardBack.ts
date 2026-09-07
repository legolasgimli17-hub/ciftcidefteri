export type OnboardingStep = "welcome" | "name" | "place" | "area" | "crops";
export type CreateTransactionStep = "amount" | "crop" | "category" | "done";
export type EditTransactionStep = "details" | "scope" | "category" | "done";

export type OnboardingBackAction = "exit" | OnboardingStep;
export type CreateBackAction = "exit" | "amount" | "crop" | "home";
export type EditBackAction = "exit" | "details" | "scope" | "home";

export function previousOnboardingStep(step: OnboardingStep): OnboardingBackAction {
  switch (step) {
    case "welcome": return "exit";
    case "name": return "welcome";
    case "place": return "name";
    case "area": return "place";
    case "crops": return "area";
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
