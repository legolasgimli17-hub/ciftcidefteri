export const theme = {
  color: {
    background: "#F3F1EB",
    surface: "#FFFFFF",
    surfaceRaised: "#FBFAF7",
    surfaceMuted: "#EAE7DE",
    surfaceStrong: "#183027",
    text: "#17231D",
    textMuted: "#66706A",
    textSubtle: "#89918C",
    border: "#DDDAD1",
    borderStrong: "#CBC7BC",
    primary: "#255D42",
    primaryPressed: "#1D4934",
    primarySoft: "#E7F0EA",
    primaryInk: "#173D2B",
    income: "#247A50",
    incomeSoft: "#E3F3E9",
    expense: "#B54843",
    expenseSoft: "#F8E7E5",
    warning: "#A87824",
    warningSoft: "#F5EEDC",
    gold: "#C6A25A",
    divider: "#ECE9E1",
    white: "#FFFFFF",
    black: "#0D1410"
  },
  radius: {
    sm: 12,
    md: 18,
    lg: 24,
    xl: 30,
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
    button: 18,
    section: 19,
    title: 31,
    amount: 40,
    heroAmount: 44
  },
  shadow: {
    card: {
      shadowColor: "#17231D",
      shadowOpacity: 0.06,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 5 },
      elevation: 2
    },
    floating: {
      shadowColor: "#17231D",
      shadowOpacity: 0.11,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5
    }
  }
} as const;
