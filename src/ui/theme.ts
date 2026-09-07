export const theme = {
  color: {
    background: "#F7F7F4",
    surface: "#FFFFFF",
    surfaceRaised: "#FFFFFF",
    surfaceMuted: "#F0F1ED",
    surfaceStrong: "#183027",
    text: "#16211B",
    textMuted: "#6C746F",
    textSubtle: "#939A95",
    border: "#E4E6E1",
    borderStrong: "#D5D8D2",
    primary: "#1F5A3E",
    primaryPressed: "#184730",
    primarySoft: "#EAF2ED",
    primaryInk: "#183F2E",
    income: "#237A4D",
    incomeSoft: "#EAF5EE",
    expense: "#AF4742",
    expenseSoft: "#F9ECEA",
    warning: "#9A742B",
    warningSoft: "#F6F0E2",
    gold: "#A98C52",
    divider: "#ECEEEA",
    white: "#FFFFFF",
    black: "#0C120F"
  },
  radius: {
    sm: 12,
    md: 16,
    lg: 20,
    xl: 26,
    pill: 999
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40
  },
  type: {
    caption: 13,
    body: 17,
    button: 17,
    section: 18,
    title: 30,
    amount: 42,
    heroAmount: 48
  },
  shadow: {
    card: {
      shadowColor: "#16211B",
      shadowOpacity: 0.025,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1
    },
    floating: {
      shadowColor: "#16211B",
      shadowOpacity: 0.06,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3
    }
  }
} as const;
