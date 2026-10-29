import { Tabs } from "expo-router";
import FloatingTabBar from "../../components/floating-tab-bar";
import { theme } from "../../constants/app-theme";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.bg },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="safety" />
      <Tabs.Screen name="profile" />
      {/* Real screen, opened from the Home card, hidden from the tab bar */}
      <Tabs.Screen name="assistant" options={{ href: null }} />
    </Tabs>
  );
}
