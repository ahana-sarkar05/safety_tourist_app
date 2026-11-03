import { Alert } from "react-native";
import * as Location from "expo-location";
import * as SMS from "expo-sms";
import { Coord } from "./distance";
import { loadContacts } from "./contacts";

async function composeSOS(phones: string[], fallback: Coord | null) {
  try {
    if (!(await SMS.isAvailableAsync())) {
      Alert.alert("SMS not available", "This device can't send SMS messages.");
      return;
    }

    // Use a fresh GPS reading if we can, otherwise the last known one.
    let here = fallback;
    try {
      const fresh = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      here = {
        latitude: fresh.coords.latitude,
        longitude: fresh.coords.longitude,
      };
    } catch {
      // keep the fallback
    }

    if (!here) {
      Alert.alert(
        "Location not ready",
        "We couldn't find your location yet. Try again in a moment."
      );
      return;
    }

    const link = `https://maps.google.com/?q=${here.latitude},${here.longitude}`;
    const message = `SOS! I need help. My location: ${link} (sent ${new Date().toLocaleTimeString()})`;
    await SMS.sendSMSAsync(phones, message);
  } catch (e) {
    Alert.alert(
      "Couldn't prepare the SOS",
      e instanceof Error ? e.message : "Something went wrong."
    );
  }
}

export async function sendSOS(opts: {
  fallback: Coord | null;
  onNeedContacts: () => void;
}) {
  const contacts = await loadContacts();

  if (contacts.length === 0) {
    Alert.alert("No emergency contacts", "Add at least one contact first.", [
      { text: "Add contacts", onPress: opts.onNeedContacts },
      { text: "Cancel", style: "cancel" },
    ]);
    return;
  }

void composeSOS(
  contacts.map((c) => c.phone),
  opts.fallback
);
}
