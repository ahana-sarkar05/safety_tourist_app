import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import type { Coord } from "./distance";

// Tracker server port. The main API (FastAPI) is on 8000; tracker is on 8080.
const TRACKER_PORT = 8080;

/**
 * Resolves the tracker base URL at runtime, mirroring how identity.ts resolves
 * the API URL. Priority:
 *  1. EXPO_PUBLIC_TRACKER_URL env var (if set to a non-localhost address)
 *  2. Expo Metro hostUri LAN IP  → used when running on a physical device via Expo Go
 *  3. Android emulator loopback  → 10.0.2.2:8080
 *  4. localhost fallback         → web / iOS simulator
 */
function getTrackerBase(): string {
  // Web: use window.location.hostname so the web preview works
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.hostname) {
    const host = window.location.hostname;
    return `http://${host === "localhost" || host === "127.0.0.1" ? "localhost" : host}:${TRACKER_PORT}`;
  }

  // If the user has set an explicit non-localhost URL (e.g. a tunnel or remote server), use it.
  const envUrl = (process.env.EXPO_PUBLIC_TRACKER_URL ?? "").trim().replace(/\/+$/, "");
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl;
  }

  // On a physical device running under Expo Go, Metro advertises the PC's LAN IP via hostUri.
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri && !hostUri.includes("ngrok") && !hostUri.includes("expo.dev")) {
    const hostIp = hostUri.split(":")[0];
    return `http://${hostIp}:${TRACKER_PORT}`;
  }

  // Android emulator: 10.0.2.2 routes to the host PC's localhost.
  if (Platform.OS === "android") {
    return `http://10.0.2.2:${TRACKER_PORT}`;
  }

  // iOS simulator / web / fallback
  return `http://localhost:${TRACKER_PORT}`;
}

const BASE = getTrackerBase();
export const liveShareConfigured = true;

export type LiveSession = {
  id: string;
  token: string; // secret: only this phone can push locations
  url: string; // public link that goes in the SMS
  expiresAt: number; // epoch ms
  durationMin: number;
};

const SESSION_KEY = "live_share_session";
export const LOCATION_TASK = "sos-live-location";

const isNative = Platform.OS !== "web";

// ---------- small fetch helper with a hard timeout ----------
async function call(path: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${BASE}${path}`, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------- stored session ----------
async function readStored(): Promise<LiveSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as LiveSession) : null;
  } catch {
    return null;
  }
}

// The session if it is still running. If it has run out, tidy up and return null.
export async function getActiveSession(): Promise<LiveSession | null> {
  const s = await readStored();
  if (!s) return null;
  if (Date.now() >= s.expiresAt) {
    await endLocally();
    return null;
  }
  return s;
}

async function endLocally() {
  await stopBackgroundUpdates();
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    // nothing else to do
  }
}

// ---------- talking to the server ----------

// Never throws and never waits long: an SOS must not hang because the server
// is slow or the signal is bad. Returns null if live sharing isn't possible.
export async function createSession(
  coord: Coord,
  accuracy: number | null,
  durationMin: number
): Promise<LiveSession | null> {
  if (!liveShareConfigured) return null;
  try {
    const res = await call(
      "/api/sessions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: coord.latitude,
          lng: coord.longitude,
          accuracy,
          durationMin,
        }),
      },
      4000
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { id?: string; token?: string; expiresAt?: number };
    if (!j.id || !j.token || typeof j.expiresAt !== "number") return null;

    const session: LiveSession = {
      id: j.id,
      token: j.token,
      // Built here, not taken from the server, so it always matches the
      // address this phone actually reached.
      url: `${BASE}/t/${j.id}`,
      expiresAt: j.expiresAt,
      durationMin,
    };
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  } catch {
    return null;
  }
}

export type PushResult = "ok" | "over" | "failed";

// "over" means the server says this session is finished (stopped, expired or
// unknown). "failed" is a network blip: just try again on the next update.
export async function pushLocation(
  session: LiveSession,
  coord: Coord,
  accuracy: number | null,
  timestamp: number
): Promise<PushResult> {
  try {
    const res = await call(
      `/api/sessions/${session.id}/location`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          lat: coord.latitude,
          lng: coord.longitude,
          accuracy,
          ts: timestamp,
        }),
      },
      8000
    );
    if (res.ok) return "ok";
    return res.status === 404 || res.status === 410 || res.status === 401 ? "over" : "failed";
  } catch {
    return "failed";
  }
}

// Stops sharing now: tells the server (best effort) and stops local tracking.
export async function stopSession(): Promise<void> {
  const s = await readStored();
  if (s && liveShareConfigured) {
    try {
      await call(
        `/api/sessions/${s.id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${s.token}` } },
        3000
      );
    } catch {
      // The server will expire it on its own at the end time.
    }
  }
  await endLocally();
}

// ---------- keeping it alive while the phone is locked ----------

// Must be requested in advance (Safety tab). Android 11+ sends the user to a
// settings page for this, which is not something to spring on someone mid-SOS.
export async function backgroundPermissionGranted(): Promise<boolean> {
  if (!isNative) return false;
  try {
    return (await Location.getBackgroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export async function requestBackgroundPermission(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) return false;
    return (await Location.requestBackgroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export async function startBackgroundUpdates(): Promise<boolean> {
  if (!isNative) return false;
  try {
    if (!(await backgroundPermissionGranted())) return false;
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 10_000,
      distanceInterval: 10,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "SOS is sharing your location",
        notificationBody: "Your emergency contacts can follow you. Open the app to stop.",
        notificationColor: "#E5584F",
      },
    });
    return true;
  } catch {
    // Expo Go, or the OS refused. Foreground tracking still works.
    return false;
  }
}

export async function stopBackgroundUpdates(): Promise<void> {
  if (!isNative) return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch {
    // already stopped
  }
}

export async function backgroundRunning(): Promise<boolean> {
  if (!isNative) return false;
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    return false;
  }
}

// Runs even when the app is closed or the phone is locked. Tasks have to be
// defined at the top level of a module that loads at startup (see _layout.tsx).
if (isNative) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
    LOCATION_TASK,
    async ({ data, error }) => {
      if (error || !data?.locations?.length) return;

      const session = await getActiveSession(); // also stops itself at expiry
      if (!session) return;

      const latest = data.locations[data.locations.length - 1];
      const result = await pushLocation(
        session,
        { latitude: latest.coords.latitude, longitude: latest.coords.longitude },
        latest.coords.accuracy ?? null,
        latest.timestamp
      );
      if (result === "over") await endLocally();
    }
  );
}
