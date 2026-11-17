import { View, Text, Pressable, StyleSheet, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../constants/app-theme";
import { directionsUrl, type Stop } from "../utils/itinerary";
import { notify } from "../utils/dialog";

type Props = {
  stop: Stop;
  onToggle: () => void;
  onEdit: () => void;
};

export default function StopCard({ stop, onToggle, onEdit }: Props) {
  const openDirections = async () => {
    if (!stop.coord) return;
    try {
      await Linking.openURL(directionsUrl(stop.coord));
    } catch {
      notify("Couldn't open maps", "No maps app was found on this device.");
    }
  };

  return (
    <Pressable
      onPress={onEdit}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${stop.name}`}
    >
      <Pressable
        onPress={onToggle}
        hitSlop={8}
        style={[styles.check, stop.visited && styles.checkOn]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: stop.visited }}
        accessibilityLabel={`Mark ${stop.name} as ${stop.visited ? "not visited" : "visited"}`}
      >
        {stop.visited && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
      </Pressable>

      <View style={{ flex: 1 }}>
        {stop.time && (
          <View style={styles.timePill}>
            <Ionicons name="time-outline" size={12} color={theme.colors.primary} />
            <Text style={styles.timeText}>{stop.time}</Text>
          </View>
        )}
        <Text style={[styles.name, stop.visited && styles.done]} numberOfLines={2}>
          {stop.name}
        </Text>
        {stop.subtitle ? (
          <Text style={styles.meta} numberOfLines={1}>
            {stop.subtitle}
          </Text>
        ) : null}
        {stop.notes ? (
          <Text style={styles.notes} numberOfLines={2}>
            {stop.notes}
          </Text>
        ) : null}
      </View>

      {stop.coord && (
        <Pressable
          onPress={openDirections}
          hitSlop={8}
          style={styles.directions}
          accessibilityRole="button"
          accessibilityLabel={`Directions to ${stop.name}`}
        >
          <Ionicons name="navigate" size={20} color={theme.colors.primary} />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    marginBottom: 10,
    borderRadius: 18,
    backgroundColor: theme.colors.card,
    ...theme.shadow,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  timePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
    marginBottom: 4,
  },
  timeText: { color: theme.colors.primary, fontSize: 12, fontWeight: "700" },
  name: { fontSize: 16, fontWeight: "700", color: theme.colors.ink },
  done: { textDecorationLine: "line-through", color: theme.colors.muted },
  meta: { color: theme.colors.muted, fontSize: 13, marginTop: 2 },
  notes: { color: theme.colors.ink, fontSize: 13, marginTop: 4, opacity: 0.8 },
  directions: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
