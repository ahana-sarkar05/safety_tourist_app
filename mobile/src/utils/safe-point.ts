import AsyncStorage from "@react-native-async-storage/async-storage";
import { Coord } from "./distance";

const KEY = "safe_point_v1";

export async function loadSafePoint(): Promise<Coord | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Coord> | null;
    if (typeof p?.latitude === "number" && typeof p?.longitude === "number") {
      return { latitude: p.latitude, longitude: p.longitude };
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveSafePoint(coord: Coord): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(coord));
}
