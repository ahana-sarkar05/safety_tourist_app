import { Stack } from "expo-router";
import { LocationProvider } from "../context/location-context";
import { LiveShareProvider } from "../context/live-share-context";
// Imported for its side effect: registers the background location task, which
// has to exist as soon as the app (or a background wake-up) loads.
import "../utils/live-share";

export default function RootLayout() {
  return (
    <LocationProvider>
      <LiveShareProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </LiveShareProvider>
    </LocationProvider>
  );
}
