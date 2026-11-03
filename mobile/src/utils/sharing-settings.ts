import AsyncStorage from "@react-native-async-storage/async-storage";

// How long an SOS keeps sharing your live location. The user picks one of
// these on the Safety tab; 1 hour is the default.
export const DURATION_OPTIONS = [
  { minutes: 15, label: "15 min" },
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
  { minutes: 240, label: "4 hours" },
  { minutes: 480, label: "8 hours" },
] as const;

export const DEFAULT_DURATION_MIN = 60;

const KEY = "live_share_duration_min";

export async function loadDuration(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const n = raw ? Number(raw) : NaN;
    return DURATION_OPTIONS.some((o) => o.minutes === n) ? n : DEFAULT_DURATION_MIN;
  } catch {
    return DEFAULT_DURATION_MIN;
  }
}

export async function saveDuration(minutes: number): Promise<void> {
  await AsyncStorage.setItem(KEY, String(minutes));
}

// 60 -> "1 hour", 90 -> "1 h 30 min", 15 -> "15 min"
export function formatDuration(minutes: number): string {
  const preset = DURATION_OPTIONS.find((o) => o.minutes === minutes);
  if (preset) return preset.label;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
}
