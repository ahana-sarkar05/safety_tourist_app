import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../constants/app-theme";
import SosCard from "../../components/sos-card";
import { getTouristProfile, TouristProfile } from "../../utils/blockchain";
import { useAuth } from "../../context/auth-context";

const ITINERARY = { done: 2, total: 5 };

type Tile = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<TouristProfile | null>(null);

  useEffect(() => {
    getTouristProfile().then(setProfile).catch(() => {});
  }, []);

  const travellerName = profile?.fullName ? profile.fullName.split(" ")[0] : "Traveller";
  const percent = Math.round((ITINERARY.done / ITINERARY.total) * 100);

  const confirmLogout = () => {
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm("Are you sure you want to log out of your Tourist ID?")
      ) {
        signOut();
      }
    } else {
      Alert.alert(
        "Log Out",
        "Are you sure you want to log out of your Tourist ID?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Log Out", style: "destructive", onPress: () => signOut() },
        ]
      );
    }
  };

  const tiles: Tile[] = [
    {
      label: "Blockchain\nTourist ID",
      icon: "card",
      onPress: () => router.navigate("/profile"),
    },
    {
      label: "AI Travel\nAssistant",
      icon: "chatbubble-ellipses",
      onPress: () => router.navigate("/assistant"),
    },
    {
      label: "Live Map &\nNavigation",
      icon: "navigate",
      onPress: () => router.navigate("/map"),
    },
    {
      label: "Safety\nAlerts",
      icon: "shield-checkmark",
      onPress: () => router.navigate("/safety"),
    },
    {
      label: "Your\nItinerary",
      icon: "calendar",
      onPress: () =>
        Alert.alert("Coming soon", "Your itinerary will live here."),
    },
  ];

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <LinearGradient
        colors={["#4A1D0E", "#9C4125", "#E0975F"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.sunLarge} />
        <View style={styles.sunSmall} />

        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.greetingRow}>
              <Text style={styles.hi}>Hi, {travellerName}</Text>
              <Ionicons name="sunny" size={24} color="#FFD38A" />
            </View>
            <Text style={styles.subtitle}>Ready for your next adventure?</Text>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              style={styles.bell}
              onPress={() => Alert.alert("Notifications", "No new alerts yet.")}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
            </Pressable>

            <Pressable
              style={styles.bell}
              onPress={confirmLogout}
              accessibilityRole="button"
              accessibilityLabel="Log Out"
            >
              <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      {/* Progress card, overlaps the hero */}
      <View style={styles.progressCard}>
        <Text style={styles.cardTitle}>Your itinerary progress</Text>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>
            {ITINERARY.done} / {ITINERARY.total} days completed
          </Text>
          <Text style={styles.progressPct}>{percent}%</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${percent}%` }]} />
        </View>
      </View>

      {/* Emergency SOS */}
      <View style={styles.sos}>
        <SosCard />
      </View>

      {/* Feature grid */}
      <View style={styles.grid}>
        {tiles.map((tile) => (
          <Pressable
            key={tile.label}
            onPress={tile.onPress}
            style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
            accessibilityRole="button"
            accessibilityLabel={tile.label.replace("\n", " ")}
          >
            <View style={styles.tileIcon}>
              <Ionicons name={tile.icon} size={24} color={theme.colors.primary} />
            </View>
            <Text style={styles.tileLabel}>{tile.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingBottom: 32 },

  hero: {
    paddingHorizontal: 22,
    paddingBottom: 84, // space for the progress card to overlap
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
  },
  sunLarge: {
    position: "absolute",
    right: -50,
    top: 40,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: "rgba(255, 214, 170, 0.20)",
  },
  sunSmall: {
    position: "absolute",
    right: 10,
    top: 100,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255, 226, 190, 0.28)",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  greetingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  hi: { color: "#FFFFFF", fontSize: 30, fontWeight: "800" },
  subtitle: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 15,
    marginTop: 6,
  },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  progressCard: {
    marginTop: -56,
    marginHorizontal: 20,
    padding: 18,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.card,
    ...theme.shadow,
  },
  cardTitle: { fontSize: 17, fontWeight: "700", color: theme.colors.ink },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  progressText: { color: theme.colors.muted, fontSize: 14 },
  progressPct: { color: theme.colors.ink, fontWeight: "700" },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primarySoft,
    marginTop: 8,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },

  sos: { marginHorizontal: 20, marginTop: 16 },
  
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
    minHeight: 136,
    padding: 16,
    justifyContent: "space-between",
    backgroundColor: theme.colors.cardTint,
    borderRadius: 22,
  },
  tilePressed: { opacity: 0.8 },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 21,
    color: theme.colors.ink,
  },
});
