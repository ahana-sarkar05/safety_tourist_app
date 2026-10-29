import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Card, IconBadge, SectionLabel } from "../../components/ui";
import ContactsModal from "../../components/contacts-modal";
import { loadContacts } from "../../utils/contacts";
import { ZONES, ZONE_COLORS } from "../../utils/zones";
import { theme } from "../../constants/app-theme";

export default function Safety() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    loadContacts().then((c) => setCount(c.length));
  }, [open]); // reload the count whenever the modal closes

  return (
    <Screen title="Safety" subtitle="Contacts and alerts that keep you safe">
      <Pressable onPress={() => setOpen(true)}>
        <Card style={styles.row}>
          <IconBadge
            name="people"
            bg={theme.colors.coralSoft}
            color={theme.colors.coral}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Emergency contacts</Text>
            <Text style={styles.cardSub}>
              {count === 0
                ? "Add people who get your SOS"
                : `${count} contact${count > 1 ? "s" : ""} will get your SOS`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
        </Card>
      </Pressable>

      <SectionLabel>Alert zones</SectionLabel>
      {ZONES.map((z) => (
        <Card key={z.id} style={styles.row}>
          <IconBadge
            name="warning"
            bg={ZONE_COLORS[z.type].fill}
            color={ZONE_COLORS[z.type].stroke}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{z.name}</Text>
            <Text style={styles.cardSub}>{z.message}</Text>
            <Text style={styles.meta}>
              {z.type.toUpperCase()} · {z.radius} m radius
            </Text>
          </View>
        </Card>
      ))}

      <ContactsModal visible={open} onClose={() => setOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.ink },
  cardSub: { color: theme.colors.muted, marginTop: 2 },
  meta: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
});