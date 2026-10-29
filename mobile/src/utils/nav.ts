import type { Ionicons } from "@expo/vector-icons";
import { Coord, distanceMeters } from "./distance";

export type IconName = keyof typeof Ionicons.glyphMap;

// One turn-by-turn instruction. `from` and `to` are indexes into the route path.
export type Step = {
  instruction: string;
  name: string;
  type: number; // OpenRouteService maneuver code (0 left, 1 right, 10 arrive, 11 depart ...)
  distance: number; // metres
  duration: number; // seconds
  from: number;
  to: number;
};

// Cumulative distance (metres) from the start of the path to every vertex.
export function buildCumulative(path: Coord[]): number[] {
  const cum: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    cum.push(cum[i - 1] + distanceMeters(path[i - 1], path[i]));
  }
  return cum;
}

export type Snap = {
  index: number; // segment the user is on (between vertex index and index + 1)
  along: number; // metres travelled along the route so far
  offRoute: number; // metres from the route line
  point: Coord; // the closest point on the route
};

// Finds the closest point on the route line to `p`. It projects onto the line
// segments (not just the vertices), because routes have long straight stretches
// with few vertices, and a vertex-only check would think you are off route.
export function snapToPath(path: Coord[], cum: number[], p: Coord): Snap {
  if (path.length === 0) {
    return { index: 0, along: 0, offRoute: Infinity, point: p };
  }
  if (path.length === 1) {
    return {
      index: 0,
      along: 0,
      offRoute: distanceMeters(p, path[0]),
      point: path[0],
    };
  }

  // Metres per degree, using the same Earth radius as distanceMeters() so the
  // two always agree.
  const kLat = (Math.PI / 180) * 6371000;
  const kLon = kLat * Math.cos((p.latitude * Math.PI) / 180);

  let bestIndex = 0;
  let bestT = 0;
  let bestDist = Infinity;

  for (let i = 0; i < path.length - 1; i++) {
    const ax = (path[i].longitude - p.longitude) * kLon;
    const ay = (path[i].latitude - p.latitude) * kLat;
    const bx = (path[i + 1].longitude - p.longitude) * kLon;
    const by = (path[i + 1].latitude - p.latitude) * kLat;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;

    let t = len2 === 0 ? 0 : -(ax * dx + ay * dy) / len2;
    t = Math.max(0, Math.min(1, t));

    const d = Math.hypot(ax + t * dx, ay + t * dy);
    if (d < bestDist) {
      bestDist = d;
      bestIndex = i;
      bestT = t;
    }
  }

  const a = path[bestIndex];
  const b = path[bestIndex + 1];
  const point: Coord = {
    latitude: a.latitude + (b.latitude - a.latitude) * bestT,
    longitude: a.longitude + (b.longitude - a.longitude) * bestT,
  };
  const segLen = cum[bestIndex + 1] - cum[bestIndex];

  return {
    index: bestIndex,
    along: cum[bestIndex] + bestT * segLen,
    offRoute: bestDist,
    point,
  };
}

// The step the user is currently on (the last step that has already started).
export function stepIndexAt(steps: Step[], segmentIndex: number): number {
  let k = 0;
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].from <= segmentIndex) k = i;
    else break;
  }
  return k;
}

export function formatDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatArrival(secondsFromNow: number): string {
  return new Date(Date.now() + secondsFromNow * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function stepIcon(type: number): IconName {
  switch (type) {
    case 0: // left
    case 2: // sharp left
    case 4: // slight left
    case 12: // keep left
      return "arrow-back";
    case 1: // right
    case 3: // sharp right
    case 5: // slight right
    case 13: // keep right
      return "arrow-forward";
    case 7: // enter roundabout
    case 8: // exit roundabout
      return "sync";
    case 9: // u-turn
      return "return-down-back";
    case 10: // arrive
      return "flag";
    case 11: // depart
      return "navigate";
    default:
      return "arrow-up";
  }
}
