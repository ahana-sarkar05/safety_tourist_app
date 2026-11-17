import type { Ionicons } from "@expo/vector-icons";
import type { Coord } from "./distance";
import { searchNearby, type Place } from "./places";

export type CategoryId = "museums" | "temples" | "parks" | "markets" | "food" | "cafes";

type Category = {
  id: CategoryId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  query: string;
};

// The place search matches on names, so each category is a word that real
// places of that kind usually have in theirs. One request per category keeps
// us well inside the free search quota.
export const CATEGORIES: Category[] = [
  { id: "museums", label: "Museums", icon: "business", query: "museum" },
  { id: "temples", label: "Temples", icon: "flower", query: "temple" },
  { id: "parks", label: "Parks", icon: "leaf", query: "park" },
  { id: "markets", label: "Markets", icon: "basket", query: "market" },
  { id: "food", label: "Food", icon: "restaurant", query: "restaurant" },
  { id: "cafes", label: "Cafés", icon: "cafe", query: "cafe" },
];

export const SUGGESTION_RADIUS_KM = 8;

export function suggestNearby(
  query: string,
  near: Coord,
  signal?: AbortSignal
): Promise<Place[]> {
  return searchNearby(query, near, SUGGESTION_RADIUS_KM, signal);
}
