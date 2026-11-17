import { Platform } from "react-native";

export const theme = {
  colors: {
    bg: "#FDEBDD", // soft peach-cream page background
    bgTop: "#F7C9A6", // top of the peach gradient
    card: "#FFF7F0", // cream cards
    cardTint: "#F8DFCB", // peach tint for feature tiles
    ink: "#42200F", // deep brown text
    heading: "#8F3A1A", // serif titles
    muted: "#8C6A58",
    border: "#EBCDB6",
    primary: "#A8441F", // terracotta
    primarySoft: "#F5D7C0",
    coral: "#D9503F", // SOS / danger
    coralSoft: "#FADDD3",
    mint: "#D5E8C6", // safe / verified
    success: "#3B7D2E",
    nav: "#FFF8F1",
    navIcon: "#9A7B6E",
  },
  fonts: {
    // Titles use the phone's built-in serif face, like the design reference.
    serif: Platform.select({ ios: "Georgia", android: "serif", default: "Georgia, 'Times New Roman', serif" }) as string,
  },
  radius: { card: 24, small: 14, pill: 999 },
  shadow: {
    shadowColor: "#7A2E17",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
};
