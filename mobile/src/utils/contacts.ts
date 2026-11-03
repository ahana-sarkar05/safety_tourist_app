import AsyncStorage from "@react-native-async-storage/async-storage";

export type Contact = { id: string; name: string; phone: string };

const KEY = "emergency_contacts";

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