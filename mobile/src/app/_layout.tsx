import { View, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { LocationProvider } from "../context/location-context";
import { AuthProvider, useAuth } from "../context/auth-context";
import AuthScreen from "../components/auth/auth-screen";
import { theme } from "../constants/app-theme";

function NavigationGate() {
  const { isLoading, isOnboarded } = useAuth();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.colors.bg,
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!isOnboarded) {
    return <AuthScreen />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <LocationProvider>
        <NavigationGate />
      </LocationProvider>
    </AuthProvider>
  );
}
