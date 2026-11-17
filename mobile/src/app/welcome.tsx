import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Logo from "../components/logo";
import Skyline from "../components/skyline";
import { theme } from "../constants/app-theme";

// First screen for anyone who isn't logged in.
export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={["#B9552E", "#E08D63", "#F6CDAE", "#FDEBDD"]}
      locations={[0, 0.38, 0.72, 1]}
      style={styles.page}
    >
      <View style={[styles.top, { paddingTop: insets.top + 40 }]}>
        <Logo size={104} color="#FFF3E8" />
        <Text style={styles.title}>Trevora</Text>
        <Text style={styles.tagline}>Travel Smart. Stay Safe.</Text>
      </View>

      <Skyline color="#6E2A14" opacity={0.4} height={150} />

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        <Text style={styles.sheetText}>
          Your complete travel companion with real-time safety intelligence
        </Text>

        <Pressable
          onPress={() => router.push("/signup")}
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Get Started"
        >
          <Text style={styles.primaryText}>Get Started</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/login")}
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Log In"
        >
          <Text style={styles.secondaryText}>Log In</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  top: { flex: 1, alignItems: "center", paddingHorizontal: 24 },
  title: {
    marginTop: 18,
    fontSize: 40,
    fontWeight: "700",
    fontFamily: theme.fonts.serif,
    color: "#FFF6EE",
    textAlign: "center",
  },
  tagline: { marginTop: 8, fontSize: 17, color: "#FDE6D4", letterSpacing: 0.3 },
  sheet: {
    backgroundColor: "rgba(255,247,240,0.96)",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 14,
  },
  sheetText: { textAlign: "center", color: theme.colors.ink, fontSize: 15, lineHeight: 22, marginBottom: 4 },
  primary: { height: 54, borderRadius: 27, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  secondary: {
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: theme.colors.primary, fontSize: 17, fontWeight: "700" },
});
