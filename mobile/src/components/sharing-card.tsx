import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card, IconBadge } from "./ui";
import { theme } from "../constants/app-theme";
import {
  DEFAULT_DURATION_MIN,
  DURATION_OPTIONS,
  formatDuration,
  loadDuration,
  saveDuration,
} from "../utils/sharing-settings";
import {
  backgroundPermissionGranted,
  liveShareConfigured,
  requestBackgroundPermission,
} from "../utils/live-share";

// Safety tab: how long SOS shares your live location, and whether it can keep
// doing that with the phone locked.
export default function SharingCard() {
  const [minutes, setMinutes] = useState(DEFAULT_DURATION_MIN);
  const [background, setBackground] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadDuration().then((m) => alive && setMinutes(m));
      backgroundPermissionGranted().then((g) => alive && setBackground(g));
      return () => {
        alive = false;
      };
    }, [])
  );

  const choose = (m: number) => {
    setMinutes(m);
    void saveDuration(m);
  };

  const allowBackground = async () => {
    setBackground(await requestBackgroundPermission());
  };

  return (
    <Card>
      <View style={styles.head}>
        <IconBadge name="navigate" />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Live location sharing</Text>
          <Text style={styles.sub}>
            When you press SOS, contacts can follow you for {formatDuration(minutes)}.
          </Text>
        </View>
      </View>

      <View style={styles.chips}>
        {DURATION_OPTIONS.map((o) => {
          const selected = o.minutes === minutes;
          return (
            <Pressable
              key={o.minutes}
              onPress={() => choose(o.minutes)}
              style={[styles.chip, selected && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Share for ${o.label}`}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                {o.label}
                {o.minutes === DEFAULT_DURATION_MIN ? " · default" : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {Platform.OS !== "web" && background !== null && (
        <View style={styles.bgRow}>
          <Ionicons
            name={background ? "checkmark-circle" : "alert-circle"}
            size={20}
            color={background ? theme.colors.success : theme.colors.primary}
          />
          <Text style={styles.bgText}>
            {background
              ? "Keeps updating while your phone is locked."
              : "Only updates while the app is open."}
          </Text>
          {!background && (
            <Pressable
              onPress={allowBackground}
              style={styles.allow}
              accessibilityRole="button"
              accessibilityLabel="Allow location while the phone is locked"
            >
              <Text style={styles.allowText}>Allow</Text>
            </Pressable>
          )}
        </View>
      )}

      {__DEV__ && !liveShareConfigured && (
        <Text style={styles.dev}>
          Dev note: EXPO_PUBLIC_TRACKER_URL is not set, so SOS will only send a one-time
          location. See tracker/README.md.
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 14 },
  title: { fontSize: 16, fontWeight: "700", color: theme.colors.ink },
  sub: { color: theme.colors.muted, marginTop: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
  },
  chipOn: { backgroundColor: theme.colors.primary },
  chipText: { color: theme.colors.ink, fontWeight: "600", fontSize: 14 },
  chipTextOn: { color: "#FFFFFF" },
  bgRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  bgText: { flex: 1, color: theme.colors.muted, fontSize: 13, lineHeight: 18 },
  allow: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  allowText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  dev: { marginTop: 12, fontSize: 12, color: theme.colors.coral, lineHeight: 17 },
});
