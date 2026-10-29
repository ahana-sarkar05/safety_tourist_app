import { Coord, distanceMeters } from "./distance";

export type ZoneType = "danger" | "restricted" | "caution";

export type Zone = {
  id: string;
  name: string;
  type: ZoneType;
  center: Coord;
  radius: number; // metres
  message: string;
};

// SAMPLE DATA: replace with your own zones
export const ZONES: Zone[] = [
  {
    id: "test-danger",
    name: "Test danger zone",
    type: "danger",
    center: { latitude: 12.92008, longitude: 77.65096 },
    radius: 50,
    message: "High-risk area. Avoid walking here alone, especially after dark.",
  },
  {
    id: "test-caution",
    name: "Crowded area",
    type: "caution",
    center: { latitude: 12.91908, longitude: 77.65196 },
    radius: 50,
    message: "Busy area. Watch your pockets and bags.",
  },
];

export const ZONE_COLORS: Record<
  ZoneType,
  { stroke: string; fill: string; banner: string; soft: string }
> = {
  danger: {
    stroke: "#C93C3C",
    fill: "rgba(201,60,60,0.18)",
    banner: "#C93C3C",
    soft: "#FCE3DF",
  },
  restricted: {
    stroke: "#8B3A62",
    fill: "rgba(139,58,98,0.18)",
    banner: "#8B3A62",
    soft: "#F3E1EA",
  },
  caution: {
    stroke: "#D98A1F",
    fill: "rgba(217,138,31,0.20)",
    banner: "#D98A1F",
    soft: "#FBEBD2",
  },
};

const PRIORITY: Record<ZoneType, number> = {
  danger: 3,
  restricted: 2,
  caution: 1,
};

// Returns every zone the point is inside, most severe first
export function zonesContaining(point: Coord): Zone[] {
  return ZONES.filter((z) => distanceMeters(point, z.center) <= z.radius).sort(
    (a, b) => PRIORITY[b.type] - PRIORITY[a.type]
  );
}

// The closest zone and how far its edge is from the point, in metres.
// A value of 0 or less means the point is inside the zone.
export function nearestZoneEdge(
  point: Coord
): { zone: Zone; edge: number } | null {
  let best: { zone: Zone; edge: number } | null = null;
  for (const zone of ZONES) {
    const edge = distanceMeters(point, zone.center) - zone.radius;
    if (!best || edge < best.edge) best = { zone, edge };
  }
  return best;
}
