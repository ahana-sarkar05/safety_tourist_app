import { Coord } from "./distance";
import { Step, buildCumulative } from "./nav";

const API_KEY = process.env.EXPO_PUBLIC_ORS_KEY;

export type TravelMode = "walk" | "drive";

const PROFILE: Record<TravelMode, string> = {
  walk: "foot-walking",
  drive: "driving-car",
};

export type Route = {
  path: Coord[];
  cum: number[]; // cumulative metres along `path`
  distanceMeters: number;
  durationSeconds: number;
  steps: Step[];
};

type RawStep = {
  instruction?: string;
  name?: string;
  type?: number;
  distance?: number;
  duration?: number;
  way_points?: number[];
};

function friendlyError(status: number, data: unknown): string {
  const err = (data as { error?: unknown } | null)?.error;
  const code =
    typeof err === "object" && err !== null
      ? (err as { code?: number }).code
      : undefined;
  const message =
    typeof err === "string"
      ? err
      : typeof err === "object" && err !== null
        ? ((err as { message?: string }).message ?? "")
        : "";

  if (status === 401 || status === 403) {
    return "The routing key was rejected. Check EXPO_PUBLIC_ORS_KEY in your .env file.";
  }
  if (status === 429) {
    return "Routing limit reached for now. Try again in a minute.";
  }
  if (code === 2010 || /routable point/i.test(message)) {
    return "No road or path found near that spot. Try a nearby street.";
  }
  if (code === 2004 || /distance must not be greater/i.test(message)) {
    return "That's too far for this travel mode. Try a closer place.";
  }
  return message || `Couldn't get directions (error ${status}).`;
}

export async function fetchRoute(
  from: Coord,
  to: Coord,
  mode: TravelMode
): Promise<Route> {
  if (!API_KEY) throw new Error("Missing EXPO_PUBLIC_ORS_KEY in your .env file.");

  let res: Response;
  try {
    res = await fetch(
      `https://api.openrouteservice.org/v2/directions/${PROFILE[mode]}/geojson`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: API_KEY,
        },
        // This API wants [longitude, latitude], the opposite of the map.
        body: JSON.stringify({
          coordinates: [
            [from.longitude, from.latitude],
            [to.longitude, to.latitude],
          ],
          instructions: true,
          language: "en",
        }),
      }
    );
  } catch {
    throw new Error("No internet connection. Check your data or Wi-Fi.");
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // leave data as null; handled below
  }
  if (!res.ok) throw new Error(friendlyError(res.status, data));

  const feature = (
    data as {
      features?: {
        geometry: { coordinates: number[][] };
        properties: {
          summary: { distance: number; duration: number };
          segments?: { steps?: RawStep[] }[];
        };
      }[];
    }
  ).features?.[0];
  if (!feature) throw new Error("No route found to that place.");

  const path: Coord[] = feature.geometry.coordinates.map(([lon, lat]) => ({
    latitude: lat,
    longitude: lon,
  }));

  const steps: Step[] = (feature.properties.segments?.[0]?.steps ?? []).map(
    (s) => ({
      instruction: s.instruction ?? "Continue",
      name: s.name ?? "",
      type: s.type ?? 6,
      distance: s.distance ?? 0,
      duration: s.duration ?? 0,
      from: s.way_points?.[0] ?? 0,
      to: s.way_points?.[1] ?? 0,
    })
  );

  return {
    path,
    cum: buildCumulative(path),
    distanceMeters: feature.properties.summary.distance,
    durationSeconds: feature.properties.summary.duration,
    steps,
  };
}
