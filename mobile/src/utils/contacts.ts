import AsyncStorage from "@react-native-async-storage/async-storage";

export type Contact = { id: string; name: string; phone: string };

const KEY = "emergency_contacts";

export const MAX_CONTACTS = 5;

export async function loadContacts(): Promise<Contact[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveContacts(contacts: Contact[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(contacts));
}

// "+91 98765-43210", "(0674) 123 4567", "0091 98765 43210" -> digits with an
// optional leading "+". Phonebook numbers come formatted in all sorts of ways.
export function normalizePhone(input: string): string {
  let s = input.trim().replace(/[^\d+]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`; // 0091... -> +91...
  const plus = s.startsWith("+") ? "+" : "";
  return plus + s.replace(/\+/g, "");
}

export function isValidPhone(phone: string): boolean {
  return /^\+?\d{7,15}$/.test(phone);
}

// A number without a country code only works for contacts in the country you
// are in. For a tourist texting home, that matters.
export function hasCountryCode(phone: string): boolean {
  return phone.startsWith("+");
}

export function samePhone(a: string, b: string): boolean {
  const digits = (p: string) => p.replace(/\D/g, "");
  const x = digits(a);
  const y = digits(b);
  // Compare the last 10 digits so "+91 98765 43210" matches "098765 43210".
  return x.slice(-10) === y.slice(-10);
}

// Not called during render, so Date.now() is fine here.
export function newContactId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}
