import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../constants/app-theme";
import { formatDistance } from "../../utils/distance";
import { Zone, ZONE_COLORS } from "../../utils/zones";

const APPROACH_METERS = 150; // warn when this close to a zone's edge
const NEARBY_METERS = 2000; // mention the nearest zone within this distance

type Props = {
  activeZones: Zone[];
  nearest: { zone: Zone; edge: number } | null;
};

type View_ = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  bg: string;
  border: string;
  tint: string;
};

function describe({ activeZones, nearest }: Props): View_ {
  // 1. Inside a zone: most severe one leads.
  if (activeZones.length > 0) {
    const z = activeZones[0];
    const c = ZONE_COLORS[z.type];
    const extra =
      activeZones.length > 1 ? ` (+${activeZones.length - 1} more here)` : "";
    return {
      icon: "warning",
      title: `${z.name}${extra}`,
      body: z.message,
      bg: c.soft,
      border: c.stroke,
      tint: c.stroke,
    };
  }

  // 2. Close to a zone's edge.
  if (nearest && nearest.edge <= APPROACH_METERS) {
    const c = ZONE_COLORS.caution;
    return {
      icon: "alert-circle",
      title: `Approaching ${nearest.zone.name}`,
      body: `${Math.max(1, Math.round(nearest.edge))} m from the edge. ${nearest.zone.message}`,
      bg: c.soft,
      border: c.stroke,
      tint: c.stroke,
    };
  }

  // 3. All clear. Worded carefully: this only reflects the alert zones we know about.
  return {
    icon: "shield-checkmark",
    title: "No alert zones nearby",
    body:
      nearest && nearest.edge <= NEARBY_METERS
        ? `Nearest: ${nearest.zone.name}, ${formatDistance(nearest.edge)} away.`
        : "You're outside all restricted and high-risk areas.",
    bg: theme.colors.mint,
    border: "#B9D8BF",
    tint: theme.colors.success,
  };
}

export default function SafetyStatusCard(props: Props) {
  const v = describe(props);
  return (
    <View
      style={[styles.card, { backgroundColor: v.bg, borderColor: v.border }]}
      accessibilityRole="summary"
      accessibilityLabel={`${v.title}. ${v.body}`}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={v.icon} size={22} color={v.tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{v.title}</Text>
        <Text style={styles.body}>{v.body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 15, fontWeight: "700", color: theme.colors.ink },
  body: { fontSize: 13, color: theme.colors.muted, marginTop: 2, lineHeight: 18 },
});
