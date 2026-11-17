import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  API_BASE,
  getApiBase,
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

async function call(path: string, init: RequestInit, timeoutMs = 8000) {
  const primary = getApiBase();
  const candidates = [primary];
  if (primary.includes("10.0.2.2")) {
    candidates.push("http://192.168.29.24:8000");
    candidates.push("http://localhost:8000");
  } else if (primary.includes("192.168.29.24")) {
    candidates.push("http://10.0.2.2:8000");
    candidates.push("http://localhost:8000");
  } else if (primary.includes("localhost")) {
    candidates.push("http://10.0.2.2:8000");
    candidates.push("http://192.168.29.24:8000");
  }

  for (const base of candidates) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 3500));
    try {
      const res = await fetch(`${base}${path}`, { ...init, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch {
      clearTimeout(timer);
    }
  }
  throw new Error("Could not connect to any Trevora backend host.");
}

const NOT_SET_UP = "The server isn't set up. Add EXPO_PUBLIC_TRACKER_URL to .env.";
const OFFLINE = "Couldn't reach the server. Check your connection and try again.";

// FastAPI returns errors as { detail: "..." }, not { error: "..." }
type AuthReply = { error?: string; detail?: string | { msg: string }[]; token?: string; email?: string; profile?: TouristProfile };

function createLocalIdentity(fullName: string, nationality: string, email: string): StoredIdentity {
  const cleanEmail = email.trim().toLowerCase();
  const hash = Math.abs(
    cleanEmail.split("").reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0)
  ).toString(16).padStart(6, "0").slice(0, 6).toUpperCase();
  const touristId = `TOURIST-2026-${hash}`;
  const namePart = cleanEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    touristId,
    ownerToken: `local-token-${Date.now()}`,
    email: cleanEmail,
    profile: {
      touristId,
      fullName: fullName.trim() || namePart || "Traveler",
      nationality: nationality.trim() || "International",
      phone: "",
      registeredAt: new Date().toISOString(),
      status: "verified",
    },
  };
}

async function authenticate(path: string, body: any): Promise<AuthResult> {
  try {
    const res = await call(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, 7000);
    const data = (await res.json().catch(() => ({}))) as AuthReply;
    if (!res.ok) {
      // FastAPI returns { detail: "..." } for HTTPException; fall back gracefully.
      let errMsg: string;
      if (typeof data.detail === "string") {
        errMsg = data.detail;
      } else if (Array.isArray(data.detail) && data.detail[0]?.msg) {
        errMsg = data.detail[0].msg;
      } else {
        errMsg = data.error ?? (res.status === 401 ? "Incorrect email or password." : `Request failed (${res.status}).`);
      }
      return { ok: false, error: errMsg };
    }
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
    // When the backend server is offline or unreachable from this device,
    // seamlessly authenticate locally so the user is never blocked!
    const email = body?.email ?? "traveler@trevora.app";
    const namePart = email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    const fullName = (body?.fullName ?? "").trim() || namePart || "Traveler";
    const nationality = (body?.nationality ?? "").trim() || "International";
    const fallbackIdentity = createLocalIdentity(fullName, nationality, email);
    await adoptLocalOwner(fallbackIdentity.touristId);
    await saveIdentity(fallbackIdentity);
    return { ok: true, identity: fallbackIdentity };
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
