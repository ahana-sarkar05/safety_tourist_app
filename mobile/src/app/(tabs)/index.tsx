import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../constants/app-theme";
import { PeachBackground } from "../../components/ui";
import Skyline from "../../components/skyline";
import SosCard from "../../components/sos-card";
import LiveShareBanner from "../../components/live-share-banner";
import { useAuth } from "../../context/auth-context";
import { useLiveShare } from "../../context/live-share-context";
import { loadItinerary, progress } from "../../utils/itinerary";
import { verifyTourist, type VerifyStatus } from "../../utils/trust";

type Tile = {
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

// What the "Your Safety Status" card says, from the real blockchain check.
function safetyLook(status: VerifyStatus | null) {
  switch (status) {
    case "verified":
      return { text: "All Good!", color: theme.colors.success, icon: "shield-checkmark" as const };
    case "failed":
      return { text: "Check your ID", color: theme.colors.coral, icon: "warning" as const };
    case "revoked":
      return { text: "ID revoked", color: theme.colors.coral, icon: "ban" as const };
    case "unverified":
      return { text: "Setting up…", color: theme.colors.primary, icon: "time" as const };
    default:
      return { text: "Checking…", color: theme.colors.muted, icon: "time" as const };
  }
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { identity } = useAuth();
  const { session: liveSession } = useLiveShare();

  const [trip, setTrip] = useState({ done: 0, total: 0 });
  const [idStatus, setIdStatus] = useState<VerifyStatus | null>(null);

  // Refresh when coming back from the itinerary screen.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadItinerary().then((it) => {
        if (alive) setTrip(progress(it));
      });
      return () => {
        alive = false;
      };
    }, [])
  );

  // Keep the safety status in step with the blockchain check.
  const touristId = identity?.touristId;
  useEffect(() => {
    if (!touristId) return;
    let alive = true;
    const load = async () => {
      const r = await verifyTourist(touristId);
      if (alive && r.ok) setIdStatus(r.data.status);
    };
    void load();
    const timer = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [touristId]);

  const firstName = identity?.profile.fullName.trim().split(/\s+/)[0] ?? "Traveller";
  const percent = trip.total === 0 ? 0 : Math.round((trip.done / trip.total) * 100);
  const safety = safetyLook(idStatus);

  const tiles: Tile[] = [
    {
      label: "AI Travel\nAssistant",
      sub: "Ask anything about your trip",
      icon: "chatbubble-ellipses",
      onPress: () => router.navigate("/assistant"),
    },
    {
      label: "Live Map &\nNavigation",
      sub: "Navigate and share your location",
      icon: "navigate",
      onPress: () => router.navigate("/map"),
    },
    {
      label: "Safety\nAlerts",
      sub: "Check scores and live incidents",
      icon: "shield-checkmark",
      onPress: () => router.navigate("/safety"),
    },
    {
      label: "Your\nItinerary",
      sub: "View and update your plans",
      icon: "calendar",
      onPress: () => router.push("/trip"),
    },
  ];

  return (
    <PeachBackground>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <View style={{ paddingTop: insets.top + 18, paddingHorizontal: 22 }}>
          <Text style={styles.hi}>Hello, {firstName}! 👋</Text>
          <Text style={styles.subtitle}>Your Trevora travel companion</Text>
        </View>
        <View style={{ marginTop: -6 }}>
          <Skyline height={92} opacity={0.26} />
        </View>

        <View style={styles.statusCard}>
          <Pressable
            style={styles.statusContent}
            onPress={() => router.push("/tourist-id")}
            accessibilityRole="button"
            accessibilityLabel={`Your Safety Status: ${safety.text}`}
          >
            <View style={styles.statusIcon}>
              <Ionicons name={safety.icon} size={28} color={safety.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusLabel}>Your Safety Status</Text>
              <Text style={[styles.statusValue, { color: safety.color }]}>{safety.text}</Text>
            </View>
          </Pressable>
          <Pressable
            style={styles.bell}
            onPress={() => Alert.alert("Notifications", "No new alerts yet.")}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.navigate("/safety")}
          style={styles.safetyBanner}
          accessibilityRole="button"
          accessibilityLabel="Open live safety radar"
        >
          <View style={styles.safetyBadge}>
            <Ionicons name="shield-checkmark" size={24} color={theme.colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.safetyTitle}>India Safety Radar</Text>
            <Text style={styles.safetySub}>Live safety scores and incident alerts</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
        </Pressable>

        {/* Emergency SOS */}
        <View style={styles.sos}>
          <SosCard />
          <View style={styles.banner}>
            <LiveShareBanner />
          </View>
        </View>

        {/* Identity features */}
        <View style={styles.grid}>
          {tiles.map((tile) => (
            <Pressable
              key={tile.label}
              onPress={tile.onPress}
              style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
              accessibilityRole="button"
              accessibilityLabel={tile.label}
            >
              <View style={styles.tileIcon}>
                <Ionicons name={tile.icon} size={26} color={theme.colors.primary} />
              </View>
              <View>
                <Text style={styles.tileLabel}>{tile.label}</Text>
                <Text style={styles.tileSub}>{tile.sub}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Live location */}
        <Pressable
          style={styles.liveCard}
          onPress={() => router.navigate("/map")}
          accessibilityRole="button"
          accessibilityLabel="Live Location"
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.liveTitle}>Live Location</Text>
            <Text style={styles.liveSub}>
              {liveSession ? "Sharing your location with your contacts" : "Open the map and navigation"}
            </Text>
          </View>
          <View style={[styles.livePill, liveSession ? styles.livePillOn : styles.livePillOff]}>
            <View style={[styles.liveDot, { backgroundColor: liveSession ? theme.colors.success : theme.colors.muted }]} />
            <Text style={styles.livePillText}>{liveSession ? "Active" : "Map"}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={theme.colors.muted} />
        </Pressable>

        {/* Trip */}
        <Pressable
          style={styles.progressCard}
          onPress={() => router.push("/trip")}
          accessibilityRole="button"
          accessibilityLabel="Open your itinerary"
        >
          <Text style={styles.cardTitle}>Your itinerary progress</Text>
          {trip.total === 0 ? (
            <Text style={[styles.progressText, { marginTop: 10 }]}>No plans yet. Tap to start your itinerary.</Text>
          ) : (
            <>
              <View style={styles.progressRow}>
                <Text style={styles.progressText}>
                  {trip.done} / {trip.total} days completed
                </Text>
                <Text style={styles.progressPct}>{percent}%</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${percent}%` }]} />
              </View>
            </>
          )}
        </Pressable>

        <View style={styles.shortcuts}>
          <Pressable style={styles.shortcut} onPress={() => router.navigate("/assistant")} accessibilityRole="button" accessibilityLabel="AI Travel Assistant">
            <Ionicons name="chatbubble-ellipses" size={20} color={theme.colors.primary} />
            <Text style={styles.shortcutText}>AI Assistant</Text>
          </Pressable>
          <Pressable style={styles.shortcut} onPress={() => router.navigate("/safety")} accessibilityRole="button" accessibilityLabel="Safety Alerts">
            <Ionicons name="alert-circle" size={20} color={theme.colors.primary} />
            <Text style={styles.shortcutText}>Safety Alerts</Text>
          </Pressable>
        </View>
      </ScrollView>
    </PeachBackground>
  );
}

const styles = StyleSheet.create({
  hi: { fontSize: 32, fontWeight: "700", fontFamily: theme.fonts.serif, color: theme.colors.heading },
  subtitle: { fontSize: 15, color: theme.colors.ink, marginTop: 4, opacity: 0.8 },

  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginHorizontal: 20,
    marginTop: 8,
    padding: 16,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.card,
    ...theme.shadow,
  },
  statusContent: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  statusIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  statusLabel: { fontSize: 13, color: theme.colors.muted },
  statusValue: { fontSize: 17, fontWeight: "800", marginTop: 2 },
  bell: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.primary },
  safetyBanner: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 20, marginTop: 14, padding: 14, backgroundColor: theme.colors.card, borderRadius: theme.radius.card, ...theme.shadow },
  safetyBadge: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.mint },
  safetyTitle: { fontSize: 15, fontWeight: "800", color: theme.colors.ink },
  safetySub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  sos: { marginHorizontal: 20, marginTop: 16 },
  banner: { marginTop: 12 },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    paddingHorizontal: 20,
    marginTop: 22,
  },
  tile: {
    flexBasis: "45%",
    flexGrow: 1,
    minHeight: 132,
    padding: 16,
    justifyContent: "space-between",
    backgroundColor: theme.colors.card,
    borderRadius: 22,
    ...theme.shadow,
  },
  tilePressed: { opacity: 0.8 },
  tileIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center" },
  tileLabel: { fontSize: 16, fontWeight: "800", color: theme.colors.ink },
  tileSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },

  liveCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.card,
    ...theme.shadow,
  },
  liveTitle: { fontSize: 17, fontWeight: "800", color: theme.colors.ink },
  liveSub: { color: theme.colors.muted, fontSize: 13, marginTop: 2 },
  livePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.pill },
  livePillOn: { backgroundColor: theme.colors.mint },
  livePillOff: { backgroundColor: theme.colors.primarySoft },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  livePillText: { fontSize: 12, fontWeight: "800", color: theme.colors.ink },

  progressCard: { marginHorizontal: 20, marginTop: 16, padding: 18, backgroundColor: theme.colors.card, borderRadius: theme.radius.card, ...theme.shadow },
  cardTitle: { fontSize: 17, fontWeight: "700", color: theme.colors.ink },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  progressText: { color: theme.colors.muted, fontSize: 14 },
  progressPct: { color: theme.colors.ink, fontWeight: "700" },
  track: { height: 10, borderRadius: 5, backgroundColor: theme.colors.primarySoft, marginTop: 8, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 5, backgroundColor: theme.colors.primary },

  shortcuts: { flexDirection: "row", gap: 14, paddingHorizontal: 20, marginTop: 14 },
  shortcut: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50, borderRadius: 25, backgroundColor: theme.colors.primarySoft },
  shortcutText: { color: theme.colors.ink, fontWeight: "700" },
});
