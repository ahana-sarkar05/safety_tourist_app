import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../constants/app-theme";

type Look = { label: string; icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string };

const AMBER = { bg: "#FBEFD5", fg: "#8A5A00" };

// One place that decides how each status looks, for identities and records.
const LOOKS: Record<string, Look> = {
  verified: { label: "Verified", icon: "shield-checkmark", bg: theme.colors.mint, fg: theme.colors.success },
  failed: { label: "Verification failed", icon: "close-circle", bg: theme.colors.coralSoft, fg: theme.colors.coral },
  tampered: { label: "Tampered", icon: "warning", bg: theme.colors.coralSoft, fg: theme.colors.coral },
  revoked: { label: "Revoked", icon: "ban", bg: theme.colors.coralSoft, fg: theme.colors.coral },
  unverified: { label: "Not verified yet", icon: "time", ...AMBER },
  pending: { label: "Pending", icon: "time", ...AMBER },
  unconfirmed: { label: "Unconfirmed", icon: "help-circle", ...AMBER },
  not_found: { label: "Not found", icon: "help-circle", bg: theme.colors.primarySoft, fg: theme.colors.muted },
};

export function statusLook(status: string): Look {
  return LOOKS[status] ?? LOOKS.not_found;
}

export default function StatusBadge({
  status,
  label,
  large = false,
}: {
  status: string;
  label?: string;
  large?: boolean;
}) {
  const look = statusLook(status);
  return (
    <View
      style={[styles.pill, { backgroundColor: look.bg }, large && styles.large]}
      accessibilityLabel={`Status: ${label ?? look.label}`}
    >
      <Ionicons name={look.icon} size={large ? 20 : 14} color={look.fg} />
      <Text style={[styles.text, { color: look.fg }, large && styles.textLarge]}>
        {label ?? look.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  large: { paddingHorizontal: 16, paddingVertical: 9, gap: 8 },
  text: { fontSize: 12, fontWeight: "800" },
  textLarge: { fontSize: 16 },
});
