import { API_BASE, identityConfigured, parseQrPayload, type StoredIdentity } from "./identity";

// ---------- types (mirror the backend's responses) ----------

export type VerifyStatus = "verified" | "failed" | "unverified" | "revoked" | "not_found";
export type RecordStatus = "verified" | "tampered" | "pending" | "unconfirmed";

export type VerifyCheck = { id: string; label: string; ok: boolean | null };

export type VerifyResult = {
  status: VerifyStatus;
  message: string;
  touristId: string;
  displayName?: string;
  nationality?: string;
  registeredAt?: string;
  checks: VerifyCheck[];
  chain?: {
    available: boolean;
    network: string;
    reason: string | null;
    fingerprint: string;
    anchoredAt: string | null;
    txHash: string | null;
  };
  records: { type: string; kind: string | null; createdAt: string; status: RecordStatus }[];
  demoMode?: boolean;
};

// The kinds of travel record, with how they are shown.
export const TRAVEL_KINDS = {
  flight: { label: "Flight booking", icon: "airplane" },
  hotel: { label: "Hotel reservation", icon: "bed" },
  permit: { label: "Travel permit", icon: "ticket" },
  booking: { label: "Other booking", icon: "bookmark" },
} as const;

export type TravelKind = keyof typeof TRAVEL_KINDS;

export type TravelDetails = {
  kind: TravelKind;
  title: string;
  reference: string;
  validFrom?: string;
  validTo?: string;
};

export type RecordItem = {
  recordId: string;
  type: string;
  createdAt: string;
  summary: string;
  details: TravelDetails | null;
  status: RecordStatus;
  reason: string | null;
  fingerprint: string;
  anchor: { status: string; txHash: string | null; anchoredAt: string | null };
};

export type EmergencyInfo = { contactName: string; contactPhone: string; notes: string };

export type EmergencyState = {
  info: EmergencyInfo | null;
  updatedAt: string | null;
  anchor: { status: string; txHash: string | null } | null;
};

export type Grant = {
  grantId: string;
  label: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  uses: number;
  lastUsedAt: string | null;
  active: boolean;
};

export type CreatedGrant = Grant & { code: string };

export type AccessResult = {
  touristId: string;
  fullName: string;
  nationality: string;
  grantLabel: string;
  expiresAt: string;
  emergency: EmergencyInfo | null;
  emergencyUpdatedAt: string | null;
};

export type ChainInfo = {
  configured: boolean;
  available: boolean;
  reason: string | null;
  contract: string | null;
  chainId: number | null;
  network: string;
  demoMode: boolean;
};

// ---------- request helper ----------

// Called when the server says our login is no longer valid (401), so the app
// can send the person back to the login screen.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: string };

async function request<T>(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; timeoutMs?: number } = {}
): Promise<ApiResult<T>> {
  if (!identityConfigured) {
    return { ok: false, status: 0, error: "The server isn't set up. Add EXPO_PUBLIC_TRACKER_URL to .env." };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12_000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (res.status === 401 && opts.token) onUnauthorized?.();
    if (!res.ok) {
      const fallback =
        res.status === 404 ? "Not found." : res.status === 429 ? "Too many attempts. Try again later." : `Request failed (${res.status}).`;
      return { ok: false, status: res.status, error: data?.error ?? fallback };
    }
    return { ok: true, status: res.status, data };
  } catch {
    return { ok: false, status: 0, error: "Couldn't reach the server. Check your connection and try again." };
  } finally {
    clearTimeout(timer);
  }
}

const own = (identity: StoredIdentity) => `/api/identity/${identity.touristId}`;

// ---------- public ----------

export const verifyTourist = (touristId: string) =>
  request<VerifyResult>("GET", `/api/verify/${encodeURIComponent(touristId)}`);

export const getChainInfo = () => request<ChainInfo>("GET", "/api/chain", { timeoutMs: 6000 });

export const accessEmergency = (touristId: string, code: string) =>
  request<AccessResult>("POST", "/api/emergency/access", { body: { touristId, code } });

// ---------- owner ----------

export const getRecords = (identity: StoredIdentity) =>
  request<{ records: RecordItem[] }>("GET", `${own(identity)}/records`, { token: identity.ownerToken });

export const addTravelRecord = (identity: StoredIdentity, data: Partial<TravelDetails>) =>
  request<{ recordId: string; fingerprint: string }>("POST", `${own(identity)}/records`, {
    token: identity.ownerToken,
    body: { type: "travel_permit", data },
  });

export const getEmergency = (identity: StoredIdentity) =>
  request<EmergencyState>("GET", `${own(identity)}/emergency`, { token: identity.ownerToken });

export const saveEmergency = (identity: StoredIdentity, info: EmergencyInfo) =>
  request<{ updatedAt: string }>("PUT", `${own(identity)}/emergency`, { token: identity.ownerToken, body: info });

export const listGrants = (identity: StoredIdentity) =>
  request<{ grants: Grant[] }>("GET", `${own(identity)}/grants`, { token: identity.ownerToken });

export const createGrant = (identity: StoredIdentity, label: string, hours: number) =>
  request<CreatedGrant>("POST", `${own(identity)}/grants`, { token: identity.ownerToken, body: { label, hours } });

export const revokeGrant = (identity: StoredIdentity, grantId: string) =>
  request<Grant>("DELETE", `${own(identity)}/grants/${grantId}`, { token: identity.ownerToken });

export const revokeIdentity = (identity: StoredIdentity) =>
  request<{ status: string }>("POST", `${own(identity)}/revoke`, { token: identity.ownerToken });

// ---------- demo tools (only exist when the server runs with DEMO_MODE=1) ----------

export const demoTamper = (touristId: string, recordId?: string) =>
  request<{ ok: boolean }>("POST", `/api/demo/tamper/${touristId}`, { body: recordId ? { recordId } : {} });

export const demoRestore = (touristId: string) =>
  request<{ ok: boolean }>("POST", `/api/demo/restore/${touristId}`, { body: {} });

// ---------- helpers ----------

// Accepts a scanned QR payload, or an ID typed by hand ("tourist-2026-001").
export function resolveTouristId(text: string): string | null {
  const fromQr = parseQrPayload(text);
  if (fromQr) return fromQr;
  const t = text.trim().toUpperCase();
  return /^TOURIST-\d{4}-\d{3,}$/.test(t) ? t : null;
}

export const shortHash = (hex: string) => (hex.length > 14 ? `${hex.slice(0, 8)}…${hex.slice(-6)}` : hex);

export function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
