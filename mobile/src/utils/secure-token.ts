import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

// The login token is a secret, so on phones it lives in the system keychain /
// keystore (SecureStore). SecureStore doesn't exist in a browser, where the
// closest thing is ordinary storage.
const KEY = "auth_token_v1";

export async function getToken(): Promise<string | null> {
  try {
    return Platform.OS === "web" ? await AsyncStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  if (Platform.OS === "web") await AsyncStorage.setItem(KEY, token);
  else await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken(): Promise<void> {
  try {
    if (Platform.OS === "web") await AsyncStorage.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // nothing more to do
  }
}
