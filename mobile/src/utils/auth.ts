import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  API_BASE,
  clearIdentity,
  identityConfigured,
  isProfile,
  saveIdentity,
  type StoredIdentity,
  type TouristProfile,
} from "./identity";
import { stopSession } from "./live-share";

export type AuthResult = { ok: true; identity: StoredIdentity } | { ok: false; error: string };

// ---------- checks (same rules as the server, for instant feedback) ----------

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function passwordProblem(password: string): string | null {
  if (password.length < 8 || password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Password must be 8 or more characters and include a letter and a number.";
  }
  return null;
}

export type SignupInput = {
  fullName: string;
  nationality: string;
  email: string;
  password: string;
  confirm: string;
};

export function checkSignup(i: SignupInput): string | null {
  if (i.fullName.trim().length < 2 || !/\p{L}/u.test(i.fullName)) return "Enter your full name.";
  if (i.nationality.trim().length < 2 || !/\p{L}/u.test(i.nationality)) return "Enter your nationality.";
  if (!EMAIL.test(i.email.trim())) return "Enter a valid email address.";
  const pw = passwordProblem(i.password);
  if (pw) return pw;
  if (i.password !== i.confirm) return "The two passwords don't match.";
  return null;
}

export function checkLogin(email: string, password: string): string | null {
  if (!EMAIL.test(email.trim())) return "Enter a valid email address.";
  if (password.length === 0) return "Enter your password.";
  return null;
}

// ---------- server calls ----------

async function call(path: string, init: RequestInit, timeoutMs = 15_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${API_BASE}${path}`, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const NOT_SET_UP = "The server isn't set up. Add EXPO_PUBLIC_TRACKER_URL to .env.";
const OFFLINE = "Couldn't reach the server. Check your connection and try again.";

type AuthReply = { error?: string; token?: string; email?: string; profile?: TouristProfile };

async function authenticate(path: string, body: unknown): Promise<AuthResult> {
  if (!identityConfigured) return { ok: false, error: NOT_SET_UP };
  try {
    const res = await call(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as AuthReply;
    if (!res.ok) return { ok: false, error: data.error ?? `Something went wrong (${res.status}).` };
    if (!data.token || !data.email || !isProfile(data.profile)) {
      return { ok: false, error: "The server sent an unexpected reply." };
    }
    const identity: StoredIdentity = {
      touristId: data.profile.touristId,
      ownerToken: data.token,
      email: data.email,
      profile: data.profile,
    };
    await adoptLocalOwner(identity.touristId);
    await saveIdentity(identity);
    return { ok: true, identity };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}

// Creates the account AND the Digital Tourist ID in one step.
export async function signUp(input: SignupInput): Promise<AuthResult> {
  const problem = checkSignup(input);
  if (problem) return { ok: false, error: problem };
  return authenticate("/api/auth/signup", {
    fullName: input.fullName,
    nationality: input.nationality,
    email: input.email,
    password: input.password,
  });
}

export async function logIn(email: string, password: string): Promise<AuthResult> {
  const problem = checkLogin(email, password);
  if (problem) return { ok: false, error: problem };
  return authenticate("/api/auth/login", { email, password });
}

export type MeResult =
  | { kind: "ok"; profile: TouristProfile }
  | { kind: "unauthorized" } // the login ran out or was ended elsewhere
  | { kind: "offline" };

// Checks that the saved login still works. "offline" must never log anyone out.
export async function fetchMe(identity: StoredIdentity): Promise<MeResult> {
  if (!identityConfigured) return { kind: "offline" };
  try {
    const res = await call("/api/auth/me", { headers: { Authorization: `Bearer ${identity.ownerToken}` } }, 8000);
    if (res.status === 401) return { kind: "unauthorized" };
    if (!res.ok) return { kind: "offline" };
    const data = (await res.json()) as { profile?: TouristProfile };
    return isProfile(data.profile) ? { kind: "ok", profile: data.profile } : { kind: "offline" };
  } catch {
    return { kind: "offline" };
  }
}

// Things that belong to the person using this phone: their emergency contacts
// (SOS texts them!), itinerary and sharing settings. They stay when someone logs
// out or their login simply expires, so logging back in picks up where they left
// off. But if a DIFFERENT account logs in on this phone, they are cleared, so
// nobody ever inherits someone else's SOS contacts.
const LOCAL_DATA_KEYS = ["emergency_contacts", "itinerary_v1", "live_share_duration_min"];
const OWNER_KEY = "local_data_owner_v1";

export async function clearLocalUserData(): Promise<void> {
  try {
    await stopSession(); // stops any live location sharing
  } catch {
    // nothing running
  }
  try {
    await AsyncStorage.multiRemove(LOCAL_DATA_KEYS);
  } catch {
    // nothing more to do
  }
}

async function adoptLocalOwner(touristId: string): Promise<void> {
  try {
    const previous = await AsyncStorage.getItem(OWNER_KEY);
    if (previous && previous !== touristId) await clearLocalUserData();
    await AsyncStorage.setItem(OWNER_KEY, touristId);
  } catch {
    // storage unavailable: nothing to protect
  }
}

export async function logOut(identity: StoredIdentity | null): Promise<void> {
  if (identity && identityConfigured) {
    try {
      await call("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${identity.ownerToken}` } }, 5000);
    } catch {
      // Offline: the server-side session simply expires on its own.
    }
  }
  try {
    await stopSession(); // nobody is signed in, so stop sharing their location
  } catch {
    // nothing running
  }
  await clearIdentity();
}
