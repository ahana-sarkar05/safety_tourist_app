import { Stack } from "expo-router";
import { LocationProvider } from "../context/location-context";

export default function RootLayout() {
  return (
    <LocationProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </LocationProvider>
  );
}