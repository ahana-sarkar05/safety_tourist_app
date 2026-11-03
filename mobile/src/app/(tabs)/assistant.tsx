import { Text, StyleSheet } from "react-native";
import { Screen, Card, IconBadge } from "../../components/ui";
import { theme } from "../../constants/app-theme";

export default function Assistant() {
  return (
    <Screen title="Assistant" subtitle="Your personal travel companion">
      <Card style={{ alignItems: "center", paddingVertical: 32 }}>
        <IconBadge name="sparkles" />
        <Text style={styles.heading}>Coming soon</Text>
        <Text style={styles.body}>
          Ask about places, food and safety, and get a personalised itinerary.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.ink,
    marginTop: 14,
  },
  body: { color: theme.colors.muted, textAlign: "center", marginTop: 6 },
});