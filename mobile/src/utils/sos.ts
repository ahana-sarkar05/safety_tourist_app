import { Alert } from "react-native";
import * as Location from "expo-location";
import * as SMS from "expo-sms";
import { Coord } from "./distance";
import { loadContacts } from "./contacts";
import { formatDuration } from "./sharing-settings";
import { liveShareConfigured, type LiveSession } from "./live-share";

type Options = {
  fallback: Coord | null;
  fallbackAccuracy: number | null;
  durationMin: number;
  // Starts the live-share session. Resolves to null if it couldn't start.
  share: (
    coord: Coord,
    accuracy: number | null,
    durationMin: number
  ) => Promise<LiveSession | null>;
  // Called if the person backs out of the message, so we don't keep sharing
  // with nobody holding the link.
  onCancelled: () => void;
  onNeedContacts: () => void;
};

function within<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export async function sendSOS(opts: Options) {
  const contacts = await loadContacts();

  if (contacts.length === 0) {
    Alert.alert("No emergency contacts", "Add at least one contact first.", [
      { text: "Add contacts", onPress: opts.onNeedContacts },
      { text: "Cancel", style: "cancel" },
    ]);
    return;
  }

  try {
    if (!(await SMS.isAvailableAsync())) {
      Alert.alert("SMS not available", "This device can't send SMS messages.");
      return;
    }

    // A fresh GPS fix if one arrives within a few seconds, otherwise the
    // location the app already has.
    let here = opts.fallback;
    let accuracy = opts.fallbackAccuracy;
    const fresh = await within(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      4000
    );
    if (fresh) {
      here = { latitude: fresh.coords.latitude, longitude: fresh.coords.longitude };
      accuracy = fresh.coords.accuracy ?? accuracy;
    }

    if (!here) {
      Alert.alert(
        "Location not ready",
        "We couldn't find your location yet. Try again in a moment."
      );
      return;
    }

    const session = await opts.share(here, accuracy, opts.durationMin);

    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const mapLink = `https://maps.google.com/?q=${here.latitude},${here.longitude}`;
    const message = session
      ? `SOS! I need help. Follow my live location for the next ${formatDuration(
          opts.durationMin
        )}: ${session.url}\nIf that doesn't open, my location at ${time}: ${mapLink}`
      : `SOS! I need help. My location at ${time}: ${mapLink}\n(Live tracking wasn't available, so this is a one-time location.)`;

    const { result } = await SMS.sendSMSAsync(
      contacts.map((c) => c.phone),
      message
    );

    if (result === "cancelled") {
      if (session) opts.onCancelled();
      return;
    }

    if (!session) {
      Alert.alert(
        "Sent as a one-time location",
        liveShareConfigured
          ? "We couldn't start live tracking (no connection to the tracking service), so your contacts got a single location instead."
          : "Live tracking isn't set up yet, so your contacts got a single location instead."
      );
    }
  } catch (e) {
    Alert.alert(
      "Couldn't prepare the SOS",
      e instanceof Error ? e.message : "Something went wrong."
    );
  }
}
