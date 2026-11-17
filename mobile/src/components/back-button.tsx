import { Pressable, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../constants/app-theme";

// Goes back to wherever the person came from, or Home if the page was opened
// directly (e.g. a browser refresh).
export default function BackButton({ label = "Back" }: { label?: string }) {
  const router = useRouter();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  return (
    <Pressable
      onPress={goBack}
      style={styles.back}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name="chevron-back" size={20} color={theme.colors.primary} />
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginLeft: -4,
    marginBottom: 8,
    paddingVertical: 6,
  },
  text: { color: theme.colors.primary, fontWeight: "700", fontSize: 15 },
});
