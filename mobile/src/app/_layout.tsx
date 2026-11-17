import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { LocationProvider } from "../context/location-context";
import { LiveShareProvider } from "../context/live-share-context";
import { AuthProvider, useAuth } from "../context/auth-context";
import { PeachBackground } from "../components/ui";
import Logo from "../components/logo";
import { theme } from "../constants/app-theme";
// Imported for its side effect: registers the background location task, which
// has to exist as soon as the app (or a background wake-up) loads.
import "../utils/live-share";

// Shown for a moment while the saved login is being read.
function Splash() {
  return (
    <PeachBackground>
      <View style={styles.splash}>
        <Logo size={96} color={theme.colors.primary} />
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 24 }} />
      </View>
    </PeachBackground>
  );
}

// Signed-out visitors can only reach the welcome / log in / sign up screens.
// Signed-in people can only reach the app. Expo Router redirects automatically
// when the login state changes.
function Gate() {
  const { status } = useAuth();
  if (status === "loading") return <Splash />;
  const signedIn = status === "signedIn";

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn} redirectTo="/welcome">
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="trip" />
        <Stack.Screen name="tourist-id" />
        <Stack.Screen name="verify" />
        <Stack.Screen name="travel-records" />
        <Stack.Screen name="emergency" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn} redirectTo="/(tabs)">
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <LocationProvider>
        <LiveShareProvider>
          <Gate />
        </LiveShareProvider>
      </LocationProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: "center", justifyContent: "center" },
});
