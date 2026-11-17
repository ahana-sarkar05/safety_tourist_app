import { ReactNode } from "react";
import { ScrollView, View, Text, StyleSheet, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../constants/app-theme";

// The peach-to-cream page background used across the app.
export function PeachBackground({ children, style }: { children?: ReactNode; style?: ViewStyle }) {
  return (
    <LinearGradient
      colors={[theme.colors.bgTop, theme.colors.bg, theme.colors.bg]}
      locations={[0, 0.45, 1]}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </LinearGradient>
  );
}

export function Screen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <PeachBackground>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 32,
        }}
      >
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </ScrollView>
    </PeachBackground>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function IconBadge({
  name,
  bg = theme.colors.primarySoft,
  color = theme.colors.primary,
}: {
  name: keyof typeof Ionicons.glyphMap;
  bg?: string;
  color?: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Ionicons name={name} size={22} color={color} />
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.section}>{children}</Text>;
}

const styles = StyleSheet.create({
  title: {
    fontSize: 32,
    fontWeight: "700",
    fontFamily: theme.fonts.serif,
    color: theme.colors.heading,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.muted,
    marginTop: 4,
    marginBottom: 20,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.card,
    padding: 16,
    marginBottom: 14,
    ...theme.shadow,
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.ink,
    marginTop: 12,
    marginBottom: 12,
  },
});