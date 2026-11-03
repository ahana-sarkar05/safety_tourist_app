import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../constants/app-theme";
import { formatDistance } from "../../utils/distance";
import { formatDuration } from "../../utils/nav";
import type { Place } from "../../utils/places";
import type { Route, TravelMode } from "../../utils/routes";

type Props = {
  place: Place;
  route: Route | null;
  loading: boolean;
  error: string | null;
  mode: TravelMode;
  onModeChange: (mode: TravelMode) => void;
  onStart: () => void;
  onRetry: () => void;
  onClose: () => void;
};

const KIND_ICON: Record<Place["kind"], keyof typeof Ionicons.glyphMap> = {
  search: "location",
  pin: "pin",
  safe: "home",
};

export default function PlaceCard({
  place,
  route,
  loading,
  error,
  mode,
  onModeChange,
  onStart,
  onRetry,
  onClose,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.tile}>
          <Ionicons name={KIND_ICON[place.kind]} size={26} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={2}>
            {place.name}
          </Text>
          {place.subtitle ? (
            <Text style={styles.sub} numberOfLines={1}>
              {place.subtitle}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel="Remove destination"
        >
          <Ionicons name="close" size={20} color={theme.colors.muted} />
        </Pressable>
      </View>

      <View style={styles.modes}>
        {(["walk", "drive"] as const).map((m) => {
          const active = mode === m;
          return (
            <Pressable
              key={m}
              onPress={() => onModeChange(m)}
              style={[styles.mode, active && styles.modeActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={m === "walk" ? "Walk" : "Drive"}
            >
              <Ionicons
                name={m === "walk" ? "walk" : "car"}
                size={18}
                color={active ? "#FFFFFF" : theme.colors.muted}
              />
              <Text style={[styles.modeText, active && styles.modeTextActive]}>
                {m === "walk" ? "Walk" : "Drive"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.meta}>
        {loading ? (
          <View style={styles.metaRow}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.metaMuted}>Finding the best route…</Text>
          </View>
        ) : error ? (
          <View style={styles.metaRow}>
            <Ionicons name="alert-circle" size={18} color={theme.colors.coral} />
            <Text style={styles.metaError}>{error}</Text>
            <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
              <Text style={styles.retry}>Retry</Text>
            </Pressable>
          </View>
        ) : route ? (
          <Text style={styles.summary}>
            {formatDuration(route.durationSeconds)}
            <Text style={styles.summaryMuted}>
              {"  ·  "}
              {formatDistance(route.distanceMeters)}
            </Text>
          </Text>
        ) : (
          <Text style={styles.metaMuted}>Waiting for your location…</Text>
        )}
      </View>

      <Pressable
        onPress={onStart}
        disabled={!route}
        style={({ pressed }) => [
          styles.start,
          !route && styles.startDisabled,
          pressed && route ? styles.startPressed : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Start navigation"
        accessibilityState={{ disabled: !route }}
      >
        <Ionicons name="navigate" size={20} color="#FFFFFF" />
        <Text style={styles.startText}>Start navigation</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.card,
    padding: 16,
    ...theme.shadow,
  },
  top: { flexDirection: "row", alignItems: "center", gap: 14 },
  tile: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 17, fontWeight: "800", color: theme.colors.ink },
  sub: { fontSize: 13, color: theme.colors.muted, marginTop: 2 },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },

  modes: {
    flexDirection: "row",
    backgroundColor: theme.colors.bg,
    borderRadius: 14,
    padding: 4,
    marginTop: 14,
  },
  mode: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 11,
  },
  modeActive: { backgroundColor: theme.colors.primary },
  modeText: { fontSize: 14, fontWeight: "600", color: theme.colors.muted },
  modeTextActive: { color: "#FFFFFF" },

  meta: { minHeight: 30, justifyContent: "center", marginTop: 14 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaMuted: { color: theme.colors.muted, fontSize: 14 },
  metaError: { flex: 1, color: theme.colors.coral, fontSize: 13 },
  retry: { color: theme.colors.primary, fontWeight: "700" },
  summary: { fontSize: 22, fontWeight: "800", color: theme.colors.ink },
  summaryMuted: { fontSize: 16, fontWeight: "600", color: theme.colors.muted },

  start: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.primary,
    marginTop: 14,
  },
  startPressed: { opacity: 0.85 },
  startDisabled: { opacity: 0.45 },
  startText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
