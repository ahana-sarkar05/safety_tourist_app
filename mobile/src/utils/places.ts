import { Coord, distanceMeters } from "./distance";

const API_KEY = process.env.EXPO_PUBLIC_ORS_KEY;
const BASE = "https://api.openrouteservice.org/geocode";

export type Place = {
  id: string;
  name: string;
  subtitle: string;
  coord: Coord;
  kind: "search" | "pin" | "safe";
  distance?: number; // metres from the user, when known
};

type Feature = {
  geometry?: { coordinates?: number[] };
  properties?: {
    gid?: string;
    id?: string;
    name?: string;
    label?: string;
    layer?: string;
  };
};

export function isAbortError(e: unknown): boolean {
  return (e as { name?: string } | null)?.name === "AbortError";
}

function toPlace(f: Feature, near: Coord | null): Place | null {
  const c = f.geometry?.coordinates;
  const p = f.properties;
  if (!c || c.length < 2 || !p) return null;

  const name = p.name ?? p.label ?? "Unnamed place";
  const label = p.label ?? name;
  const subtitle = label.startsWith(`${name}, `)
    ? label.slice(name.length + 2)
    : label === name
      ? ""
      : label;
  const coord: Coord = { latitude: c[1], longitude: c[0] };

  return {
    id: p.gid ?? p.id ?? `${c[0]},${c[1]}`,
    name,
    subtitle,
    coord,
    kind: "search",
    distance: near ? distanceMeters(near, coord) : undefined,
  };
}

async function request(
  path: string,
  params: Record<string, string | number | undefined>,
  signal?: AbortSignal
): Promise<Feature[]> {
  if (!API_KEY) throw new Error("Missing EXPO_PUBLIC_ORS_KEY in your .env file.");

  let query = `api_key=${encodeURIComponent(API_KEY)}`;
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      query += `&${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
    }
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}?${query}`, { signal });
  } catch (e) {
    if (isAbortError(e)) throw e;
    throw new Error("No internet connection.");
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("The search key was rejected. Check EXPO_PUBLIC_ORS_KEY in .env.");
    }
    if (res.status === 429) {
      throw new Error("Search limit reached for now. Try again in a minute.");
    }
    throw new Error(`Search failed (error ${res.status}).`);
  }

  const data = (await res.json()) as { features?: Feature[] };
  return Array.isArray(data.features) ? data.features : [];
}

function clean(places: (Place | null)[]): Place[] {
  return places.filter((p): p is Place => p !== null);
}

// Suggestions while the user types.
export async function autocompletePlaces(
  text: string,
  near: Coord | null,
  signal?: AbortSignal
): Promise<Place[]> {
  const features = await request(
    "/autocomplete",
    {
      text,
      size: 6,
      "focus.point.lat": near?.latitude,
      "focus.point.lon": near?.longitude,
    },
    signal
  );
  return clean(features.map((f) => toPlace(f, near)));
}

// Closest matches around the user, e.g. "hospital" within 5 km. Nearest first.
export async function searchNearby(
  text: string,
  near: Coord,
  radiusKm = 5,
  signal?: AbortSignal
): Promise<Place[]> {
  const features = await request(
    "/search",
    {
      text,
      size: 15,
      "boundary.circle.lat": near.latitude,
      "boundary.circle.lon": near.longitude,
      "boundary.circle.radius": radiusKm,
      "focus.point.lat": near.latitude,
      "focus.point.lon": near.longitude,
    },
    signal
  );

  // Prefer real points of interest; fall back to everything if none came back.
  const venues = features.filter((f) => f.properties?.layer === "venue");
  const chosen = venues.length > 0 ? venues : features;

  return clean(chosen.map((f) => toPlace(f, near)))
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
    .slice(0, 8);
}

// Turns a spot on the map into an address.
export async function reverseGeocode(
  coord: Coord,
  signal?: AbortSignal
): Promise<Place | null> {
  const features = await request(
    "/reverse",
    { "point.lat": coord.latitude, "point.lon": coord.longitude, size: 1 },
    signal
  );
  const place = features.length > 0 ? toPlace(features[0], null) : null;
  return place ? { ...place, coord, kind: "pin" } : null;
}
