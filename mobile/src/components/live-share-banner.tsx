import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../constants/app-theme";
import { useLiveShare } from "../context/live-share-context";
import { confirm } from "../utils/dialog";

function formatLeft(ms: number): string {
  const mins = Math.ceil(ms / 60000);
  if (mins <= 1) return "Less than a minute left";
  if (mins < 60) return `${mins} min left`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h left` : `${h} h ${m} min left`;
}

// Shown on Home while an SOS is sharing your location, with a way to stop it.
export default function LiveShareBanner() {
  const { session, remainingMs, background, stop } = useLiveShare();
  if (!session) return null;

  const confirmStop = async () => {
    const ok = await confirm({
      title: "Stop sharing?",
      message: "Your contacts will no longer be able to follow your location.",
      confirmText: "Stop sharing",
      cancelText: "Keep sharing",
      destructive: true,
    });
    if (ok) await stop();
  };

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.icon}>
        <Ionicons name="radio" size={22} color={theme.colors.success} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Sharing live location</Text>
        <Text style={styles.sub}>
          {formatLeft(remainingMs)}
          {background ? "" : " · keep the app open"}
        </Text>
      </View>
      <Pressable
        onPress={() => void confirmStop()}
        style={({ pressed }) => [styles.stop, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
        accessibilityLabel="Stop sharing live location"
      >
        <Text style={styles.stopText}>Stop</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.mint,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 16, fontWeight: "800", color: theme.colors.ink },
  sub: { fontSize: 13, color: theme.colors.muted, marginTop: 2 },
  stop: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  stopText: { color: theme.colors.coral, fontWeight: "800", fontSize: 14 },
});
