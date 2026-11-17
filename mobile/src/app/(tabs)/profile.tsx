import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Card, IconBadge, SectionLabel } from "../../components/ui";
import { theme } from "../../constants/app-theme";
import { useAuth } from "../../context/auth-context";
import { confirm } from "../../utils/dialog";

export default function Profile() {
  const router = useRouter();
  const { identity, logOut } = useAuth();

  const name = identity?.profile.fullName ?? "Tourist";

  const askLogOut = async () => {
    const ok = await confirm({
      title: "Log out?",
      message: "Your Tourist ID stays safe on the server. Log back in any time to get it back.",
      confirmText: "Log out",
      cancelText: "Stay logged in",
      destructive: true,
    });
    if (ok) await logOut();
  };

  return (
    <Screen title="Profile" subtitle="Your traveller details">
      <Card style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name.trim()[0]?.toUpperCase() ?? "T"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.sub}>{identity?.profile.nationality}</Text>
          {identity?.email ? <Text style={styles.sub}>{identity.email}</Text> : null}
        </View>
      </Card>

      <SectionLabel>Identity</SectionLabel>
      <NavCard icon="id-card" title="Digital tourist ID" sub={identity ? `${identity.touristId} · tap to view` : ""} label="Open Digital Tourist ID" onPress={() => router.push("/tourist-id")} />
      <NavCard icon="scan" title="Verify identity" sub="Scan a Tourist ID QR code" label="Verify identity" onPress={() => router.push("/verify")} />
      <NavCard icon="document-text" title="Travel records" sub="Bookings and permits, tamper-checked" label="Travel records" onPress={() => router.push("/travel-records")} />
      <NavCard icon="medkit" title="Emergency sharing" sub="Choose who can see your emergency details" label="Emergency sharing" onPress={() => router.push("/emergency")} />

      <SectionLabel>Trip</SectionLabel>
      <NavCard icon="calendar" title="Itinerary" sub="Plan your days, tick off your stops" label="Itinerary" onPress={() => router.push("/trip")} />
      <NavCard icon="sparkles" title="AI travel assistant" sub="Ask for travel help" label="AI travel assistant" onPress={() => router.push("/assistant")} />

      <Pressable onPress={() => void askLogOut()} style={styles.logout} accessibilityRole="button" accessibilityLabel="Log out">
        <Ionicons name="log-out-outline" size={20} color={theme.colors.coral} />
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
      <View style={{ height: 24 }} />
    </Screen>
  );
}

function NavCard({
  icon,
  title,
  sub,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Card style={styles.row}>
        <IconBadge name={icon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{title}</Text>
          <Text style={styles.sub}>{sub}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFF3E8", fontSize: 24, fontWeight: "700", fontFamily: theme.fonts.serif },
  name: { fontSize: 17, fontWeight: "700", color: theme.colors.ink },
  sub: { color: theme.colors.muted, marginTop: 2, fontSize: 13 },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: theme.colors.coral, marginTop: 18 },
  logoutText: { color: theme.colors.coral, fontSize: 16, fontWeight: "700" },
});
