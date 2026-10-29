import { View, Text, StyleSheet } from "react-native";
import { Screen, Card, IconBadge } from "../../components/ui";
import { theme } from "../../constants/app-theme";

export default function Profile() {
  return (
    <Screen title="Profile" subtitle="Your traveller details">
      <Card style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>T</Text>
        </View>
        <View>
          <Text style={styles.name}>Tourist</Text>
          <Text style={styles.sub}>Add your name soon</Text>
        </View>
      </Card>

      <Card style={styles.row}>
        <IconBadge name="id-card" />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>Digital tourist ID</Text>
          <Text style={styles.sub}>Blockchain-verified, coming later</Text>
        </View>
      </Card>

      <Card style={styles.row}>
        <IconBadge
          name="medkit"
          bg={theme.colors.mint}
          color="#0F766E"
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>Medical info</Text>
          <Text style={styles.sub}>Blood group and allergies, coming soon</Text>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "white", fontSize: 24, fontWeight: "800" },
  name: { fontSize: 16, fontWeight: "700", color: theme.colors.ink },
  sub: { color: theme.colors.muted, marginTop: 2 },
});