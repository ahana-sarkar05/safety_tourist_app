import { Platform } from "react-native";
import {
  Contact,
  ContactField,
  getPermissionsAsync,
  requestPermissionsAsync,
} from "expo-contacts";

export type PhonebookNumber = { label: string; number: string };

export type PhonebookResult =
  | { kind: "picked"; name: string; phones: PhonebookNumber[] }
  | { kind: "cancelled" }
  | { kind: "denied"; canAskAgain: boolean }
  | { kind: "unavailable" };

// Opens the phone's own contact picker, but only if the user allows access.
// Anything other than "picked" means the screen should fall back to typing.
export async function pickFromPhonebook(): Promise<PhonebookResult> {
  if (Platform.OS === "web") return { kind: "unavailable" };

  try {
    let permission = await getPermissionsAsync();
    if (permission.status !== "granted") {
      permission = await requestPermissionsAsync();
    }
    if (permission.status !== "granted") {
      return { kind: "denied", canAskAgain: permission.canAskAgain };
    }

    const picked = await Contact.presentPicker();
    if (!picked) return { kind: "cancelled" };

    const details = await picked.getDetails([ContactField.FULL_NAME, ContactField.PHONES]);

    const seen = new Set<string>();
    const phones: PhonebookNumber[] = [];
    for (const p of details.phones ?? []) {
      const number = p.number?.trim();
      if (!number || seen.has(number)) continue;
      seen.add(number);
      phones.push({ label: p.label || "mobile", number });
    }

    return {
      kind: "picked",
      name: details.fullName?.trim() || "Unnamed contact",
      phones,
    };
  } catch {
    return { kind: "unavailable" };
  }
}
