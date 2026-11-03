import { View, Text, StyleSheet } from "react-native";
import { theme } from "../../constants/app-theme";

const AMBER = "#D98A1F";

export default function GpsChip({
  accuracy,
  ready,
}: {
  accuracy: number | null;
  ready: boolean;
}) {
  let color: string = theme.colors.muted;
  let label = "Locating…";

  if (!ready) {
    color = theme.colors.coral;
    label = "GPS off";
  } else if (accuracy !== null) {
    if (accuracy <= 20) {
      color = theme.colors.success;
      label = "GPS good";
    } else if (accuracy <= 60) {
      color = AMBER;
      label = "GPS fair";
    } else {
      color = theme.colors.coral;
      label = "GPS weak";
    }
  }

  return (
    <View
      style={styles.chip}
      accessibilityLabel={`${label}${accuracy !== null && ready ? `, accurate to about ${Math.round(accuracy)} metres` : ""}`}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.text}>{label}</Text>
      {ready && accuracy !== null && (
        <Text style={styles.sub}>±{Math.round(accuracy)} m</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.card,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 12, fontWeight: "700", color: theme.colors.ink },
  sub: { fontSize: 12, color: theme.colors.muted },
});
