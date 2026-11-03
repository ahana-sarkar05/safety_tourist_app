import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Coord } from "./distance";

export type Stop = {
  id: string;
  name: string;
  subtitle?: string; // address / area, from a place search
  coord?: Coord; // present when the stop was picked from a search or suggestion
  time?: string; // "HH:MM", 24 hour
  notes?: string;
  visited: boolean;
};

export type Day = { id: string; stops: Stop[] };

export type Itinerary = { days: Day[] };

const KEY = "itinerary_v1";

export const EMPTY: Itinerary = { days: [] };

// Not called during render, so Date.now() / Math.random() are fine here.
export function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ---------- storage ----------

function isCoord(c: unknown): c is Coord {
  const x = c as Coord | null;
  return (
    !!x && typeof x.latitude === "number" && typeof x.longitude === "number"
  );
}

// Defensive on purpose: a bad value in storage should give an empty plan,
// never a crash on the Home screen.
export async function loadItinerary(): Promise<Itinerary> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Itinerary;
    if (!Array.isArray(parsed?.days)) return EMPTY;

    const days: Day[] = parsed.days
      .filter((d) => d && typeof d.id === "string" && Array.isArray(d.stops))
      .map((d) => ({
        id: d.id,
        stops: d.stops
          .filter((s) => s && typeof s.id === "string" && typeof s.name === "string")
          .map((s) => ({
            id: s.id,
            name: s.name,
            subtitle: typeof s.subtitle === "string" ? s.subtitle : undefined,
            coord: isCoord(s.coord) ? s.coord : undefined,
            time: typeof s.time === "string" ? s.time : undefined,
            notes: typeof s.notes === "string" ? s.notes : undefined,
            visited: s.visited === true,
          })),
      }));
    return { days };
  } catch {
    return EMPTY;
  }
}

export async function saveItinerary(it: Itinerary): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(it));
  } catch {
    // Storage full or unavailable. The screen still has the data in memory.
  }
}

// ---------- progress ----------

// A day counts as completed once it has stops and every one is visited.
export function isDayDone(day: Day): boolean {
  return day.stops.length > 0 && day.stops.every((s) => s.visited);
}

export function progress(it: Itinerary): { done: number; total: number } {
  return { done: it.days.filter(isDayDone).length, total: it.days.length };
}

// ---------- updates (all return a new itinerary) ----------

export function addDay(it: Itinerary): Itinerary {
  return { days: [...it.days, { id: newId(), stops: [] }] };
}

export function removeDay(it: Itinerary, dayId: string): Itinerary {
  return { days: it.days.filter((d) => d.id !== dayId) };
}

function mapDay(it: Itinerary, dayId: string, fn: (d: Day) => Day): Itinerary {
  return { days: it.days.map((d) => (d.id === dayId ? fn(d) : d)) };
}

export function addStop(it: Itinerary, dayId: string, stop: Stop): Itinerary {
  return mapDay(it, dayId, (d) => ({ ...d, stops: [...d.stops, stop] }));
}

export function updateStop(it: Itinerary, dayId: string, stop: Stop): Itinerary {
  return mapDay(it, dayId, (d) => ({
    ...d,
    stops: d.stops.map((s) => (s.id === stop.id ? stop : s)),
  }));
}

export function removeStop(it: Itinerary, dayId: string, stopId: string): Itinerary {
  return mapDay(it, dayId, (d) => ({
    ...d,
    stops: d.stops.filter((s) => s.id !== stopId),
  }));
}

export function toggleVisited(it: Itinerary, dayId: string, stopId: string): Itinerary {
  return mapDay(it, dayId, (d) => ({
    ...d,
    stops: d.stops.map((s) => (s.id === stopId ? { ...s, visited: !s.visited } : s)),
  }));
}

export function moveStop(
  it: Itinerary,
  dayId: string,
  stopId: string,
  direction: -1 | 1
): Itinerary {
  return mapDay(it, dayId, (d) => {
    const from = d.stops.findIndex((s) => s.id === stopId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= d.stops.length) return d;
    const stops = [...d.stops];
    [stops[from], stops[to]] = [stops[to], stops[from]];
    return { ...d, stops };
  });
}

// ---------- small helpers ----------

// "9:5" is not a time; "9:05" and "09:05" are. Returns "" for empty input
// (a stop doesn't need a time) and null when the text is not a valid time.
export function normalizeTime(raw: string): string | "" | null {
  const t = raw.trim();
  if (t === "") return "";
  const m = t.match(/^([01]?\d|2[0-3])[:.]([0-5]\d)$/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

// Opens in whatever maps app the phone has. No API key needed.
export function directionsUrl(coord: Coord): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${coord.latitude},${coord.longitude}`;
}

export function sameStop(a: { name: string; coord?: Coord }, b: { name: string; coord?: Coord }) {
  if (a.coord && b.coord) {
    return (
      Math.abs(a.coord.latitude - b.coord.latitude) < 0.0002 &&
      Math.abs(a.coord.longitude - b.coord.longitude) < 0.0002
    );
  }
  return a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
}
