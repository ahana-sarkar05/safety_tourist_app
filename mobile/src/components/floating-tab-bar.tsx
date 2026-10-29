import { useEffect, type ComponentProps } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tabs } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../constants/app-theme";

// The props Expo Router hands to a custom tab bar.
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

type IconName = keyof typeof Ionicons.glyphMap;

// Only routes listed here appear in the bar. Anything else (e.g. "assistant")
// is still a real screen, just reached from a button instead of a tab.
const TABS: Record<string, { label: string; on: IconName; off: IconName }> = {
  index: { label: "Home", on: "home", off: "home-outline" },
  map: { label: "Map", on: "map", off: "map-outline" },
  safety: {
    label: "Safety",
    on: "shield-checkmark",
    off: "shield-checkmark-outline",
  },
  profile: {
    label: "More",
    on: "ellipsis-horizontal-circle",
    off: "ellipsis-horizontal-circle-outline",
  },
};

export default function FloatingTabBar({
  state,
  emitter,
  navigateToTab,
}: TabBarProps) {
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;

  // Home has a dark hero at the top, so it needs light status-bar icons.
  useEffect(() => {
    setStatusBarStyle(current === "index" ? "light" : "dark");
  }, [current]);

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, index) => {
        const meta = TABS[route.name];
        if (!meta) return null;
        const focused = state.index === index;

        const onPress = () => {
          const event = emitter.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigateToTab(route.key);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.item}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={meta.label}
          >
            <Ionicons
              name={focused ? meta.on : meta.off}
              size={24}
              color={focused ? theme.colors.primary : theme.colors.navIcon}
            />
            <Text
              style={[
                styles.label,
                { color: focused ? theme.colors.primary : theme.colors.navIcon },
                focused && styles.labelActive,
              ]}
            >
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: theme.colors.nav,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    shadowColor: "#7A2E17",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingVertical: 4,
  },
  label: { fontSize: 11 },
  labelActive: { fontWeight: "700" },
});