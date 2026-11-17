import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearToken, getToken, setToken } from "./secure-token";

/**
 * Dynamically resolves Trevora API base URL.
 * Automatically handles web localhost, Android emulator (10.0.2.2), and physical devices via Expo host IP.
 */
export function getApiBase(): string {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.hostname) {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:8000";
    }
    return `http://${host}:8000`;
  }

  // Extract Metro host IP if running under Expo Go / dev client
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri && !hostUri.includes("ngrok") && !hostUri.includes("expo")) {
    const hostIp = hostUri.split(":")[0];
    return `http://${hostIp}:8000`;
  }

  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl;
  }

  // Android emulator fallback
  if (Platform.OS === "android") {
    return "http://10.0.2.2:8000";
  }

  return "http://192.168.29.24:8000";
}

export const API_BASE = getApiBase();
export const identityConfigured = true;

export type TouristProfile = {
  touristId: string;
  fullName: string;
  nationality: string;
  phone: string; // may be empty
  registeredAt: string; // ISO date
  status: string;
};

// What this phone keeps after logging in. `ownerToken` is the login token:
// the secret that proves who is asking when the app talks to the server.
export type StoredIdentity = {
  touristId: string;
  ownerToken: string;
  email: string;
  profile: TouristProfile;
};

// The profile (not a secret) is kept in ordinary storage; the token is kept
// separately in secure storage.
const PROFILE_KEY = "tourist_profile_v2";

function isProfile(p: unknown): p is TouristProfile {
  const x = p as TouristProfile | null;
  return (
    !!x &&
    typeof x.touristId === "string" &&
    typeof x.fullName === "string" &&
    typeof x.nationality === "string" &&
    typeof x.registeredAt === "string"
  );
}

// A bad value in storage means "not logged in", never a crash.
export async function loadIdentity(): Promise<StoredIdentity | null> {
  try {
    const [raw, token] = await Promise.all([AsyncStorage.getItem(PROFILE_KEY), getToken()]);
    if (!raw || !token) return null;
    const v = JSON.parse(raw) as { touristId?: string; email?: string; profile?: TouristProfile };
    if (typeof v?.touristId !== "string" || !isProfile(v?.profile)) return null;
    return {
      touristId: v.touristId,
      ownerToken: token,
      email: typeof v.email === "string" ? v.email : "",
      profile: {
        ...v.profile,
        phone: typeof v.profile.phone === "string" ? v.profile.phone : "",
        status: typeof v.profile.status === "string" ? v.profile.status : "active",
      },
    };
  } catch {
    return null;
  }
}

export async function saveIdentity(identity: StoredIdentity): Promise<void> {
  await setToken(identity.ownerToken);
  await AsyncStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({ touristId: identity.touristId, email: identity.email, profile: identity.profile })
  );
}

export async function clearIdentity(): Promise<void> {
  await clearToken();
  try {
    await AsyncStorage.removeItem(PROFILE_KEY);
  } catch {
    // nothing more to do
  }
}

export { isProfile };

// ---------- QR code ----------

// The QR holds only the ID, never personal details. Whoever scans it asks the
// server whether the ID is genuine.
const QR_PREFIX = "tourist-id:v1:";
const ID_PATTERN = /^TOURIST-\d{4}-\d{3,}$/;

export function qrPayload(touristId: string): string {
  return `${QR_PREFIX}${touristId}`;
}

export function parseQrPayload(text: string): string | null {
  const t = text.trim();
  if (!t.startsWith(QR_PREFIX)) return null;
  const id = t.slice(QR_PREFIX.length);
  return ID_PATTERN.test(id) ? id : null;
}
