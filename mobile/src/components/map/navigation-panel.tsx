import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../constants/app-theme";
import { formatDistance } from "../../utils/distance";
import { formatArrival, formatDuration, type IconName } from "../../utils/nav";

export type UpcomingStep = {
  icon: IconName;
  text: string;
  distance: number; // metres from the user's current position
};

type Props = {
  icon: IconName;
  instruction: string;
  distanceToTurn: number;
  remainingMeters: number;
  remainingSeconds: number;
  upcoming: UpcomingStep[];
  rerouting: boolean;
  onEnd: () => void;
};

export default function NavigationPanel({
  icon,
  instruction,
  distanceToTurn,
  remainingMeters,
  remainingSeconds,
  upcoming,
  rerouting,
  onEnd,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View
        style={styles.hero}
        accessibilityRole="header"
        accessibilityLabel={`In ${formatDistance(distanceToTurn)}: ${instruction}`}
      >
        <View style={styles.heroIcon}>
          <Ionicons name={icon} size={30} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroDist}>
            {rerouting ? "Rerouting…" : `In ${formatDistance(distanceToTurn)}`}
          </Text>
          <Text style={styles.heroText} numberOfLines={3}>
            {instruction}
          </Text>
        </View>
      </View>

      <View style={styles.stats}>
        <Stat label="Remaining" value={formatDistance(remainingMeters)} />
        <View style={styles.divider} />
        <Stat label="Time" value={formatDuration(remainingSeconds)} />
        <View style={styles.divider} />
        <Stat label="Arrive" value={formatArrival(remainingSeconds)} />
      </View>

      {upcoming.length > 0 && (
        <View style={styles.list}>
          <Text style={styles.listTitle}>Then</Text>
          {upcoming.map((s, i) => (
            <View key={`${i}-${s.text}`} style={styles.step}>
              <View style={styles.stepIcon}>
                <Ionicons name={s.icon} size={16} color={theme.colors.primary} />
              </View>
              <Text style={styles.stepText} numberOfLines={2}>
                {s.text}
              </Text>
              <Text style={styles.stepDist}>{formatDistance(s.distance)}</Text>
            </View>
          ))}
        </View>
      )}

      <Pressable
        onPress={onEnd}
        style={({ pressed }) => [styles.end, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
        accessibilityLabel="End navigation"
      >
        <Ionicons name="stop-circle" size={20} color={theme.colors.coral} />
        <Text style={styles.endText}>End navigation</Text>
      </Pressable>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.primary,
    ...theme.shadow,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  heroDist: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: "600" },
  heroText: { color: "#FFFFFF", fontSize: 19, fontWeight: "800", marginTop: 2 },

  stats: {
    flexDirection: "row",
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    paddingVertical: 14,
    ...theme.shadow,
  },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 16, fontWeight: "800", color: theme.colors.ink },
  statLabel: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  divider: { width: 1, backgroundColor: theme.colors.border },

  list: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 14,
    gap: 10,
  },
  listTitle: { fontSize: 13, fontWeight: "700", color: theme.colors.muted },
  step: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { flex: 1, fontSize: 14, color: theme.colors.ink },
  stepDist: { fontSize: 12, fontWeight: "700", color: theme.colors.muted },

  end: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: theme.colors.coral,
    backgroundColor: theme.colors.card,
  },
  endText: { color: theme.colors.coral, fontSize: 15, fontWeight: "700" },
});
