import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "./ui";
import { theme } from "../constants/app-theme";
import { formatDistance, type Coord } from "../utils/distance";
import { isAbortError, type Place } from "../utils/places";
import { sameStop, type Stop } from "../utils/itinerary";
import { CATEGORIES, suggestNearby, type CategoryId } from "../utils/suggestions";

type Props = {
  near: Coord | null;
  existing: Stop[]; // stops already in the day being planned
  dayLabel: string;
  onAdd: (place: Place) => void;
};

type Loaded = { key: string; items: Place[]; error: string | null };

export default function Suggestions({ near, existing, dayLabel, onAdd }: Props) {
  const [category, setCategory] = useState<CategoryId>("museums");
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  // GPS fixes arrive every few seconds. Search again only when you've moved
  // about a kilometre (two decimal places), not on every tick.
  const cell = near ? `${near.latitude.toFixed(2)},${near.longitude.toFixed(2)}` : null;
  const requestKey = cell ? `${category}|${cell}` : null;
  const query = CATEGORIES.find((c) => c.id === category)?.query ?? "museum";

  const nearRef = useRef(near);
  useEffect(() => {
    nearRef.current = near;
  }, [near]);

  useEffect(() => {
    const here = nearRef.current;
    if (!requestKey || !here) return;
    const controller = new AbortController();

    suggestNearby(query, here, controller.signal)
      .then((items) => setLoaded({ key: requestKey, items, error: null }))
      .catch((e: unknown) => {
        if (isAbortError(e)) return;
        setLoaded({
          key: requestKey,
          items: [],
          error: e instanceof Error ? e.message : "Couldn't load suggestions.",
        });
      });

    return () => controller.abort();
  }, [requestKey, query]);

  // Results belong to the request that made them, so there is no separate
  // "loading" flag to keep in sync.
  const current = loaded && loaded.key === requestKey ? loaded : null;
  const loading = requestKey !== null && current === null;
  const items = (current?.items ?? []).slice(0, 6);

  return (
    <View>
      <Text style={styles.heading}>Suggested near you</Text>
      <Text style={styles.sub}>Tap + to add a place to {dayLabel}.</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {CATEGORIES.map((c) => {
          const selected = c.id === category;
          return (
            <Pressable
              key={c.id}
              onPress={() => setCategory(c.id)}
              style={[styles.chip, selected && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Ionicons
                name={c.icon}
                size={16}
                color={selected ? "#FFFFFF" : theme.colors.primary}
              />
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {!near ? (
        <Card style={styles.note}>
          <Text style={styles.noteText}>
            Turn on location to see places near you.
          </Text>
        </Card>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : current?.error ? (
        <Card style={styles.note}>
          <Text style={styles.noteText}>{current.error}</Text>
        </Card>
      ) : items.length === 0 ? (
        <Card style={styles.note}>
          <Text style={styles.noteText}>
            Nothing found within a few km. Try another category.
          </Text>
        </Card>
      ) : (
        items.map((p) => {
          const added = existing.some((s) => sameStop(s, { name: p.name, coord: p.coord }));
          return (
            <View key={p.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {p.distance !== undefined ? `${formatDistance(p.distance)} away` : ""}
                  {p.distance !== undefined && p.subtitle ? " · " : ""}
                  {p.subtitle}
                </Text>
              </View>
              <Pressable
                onPress={() => onAdd(p)}
                disabled={added}
                style={[styles.add, added && styles.addDone]}
                accessibilityRole="button"
                accessibilityLabel={added ? `${p.name} already added` : `Add ${p.name}`}
              >
                <Ionicons
                  name={added ? "checkmark" : "add"}
                  size={22}
                  color={added ? theme.colors.success : "#FFFFFF"}
                />
              </Pressable>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: "800", color: theme.colors.ink, marginTop: 8 },
  sub: { color: theme.colors.muted, marginTop: 2, marginBottom: 12 },
  chips: { gap: 8, paddingBottom: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
  },
  chipOn: { backgroundColor: theme.colors.primary },
  chipText: { color: theme.colors.ink, fontWeight: "600", fontSize: 14 },
  chipTextOn: { color: "#FFFFFF" },
  center: { paddingVertical: 28, alignItems: "center" },
  note: { paddingVertical: 20, alignItems: "center" },
  noteText: { color: theme.colors.muted, textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    marginBottom: 10,
    borderRadius: 18,
    backgroundColor: theme.colors.card,
  },
  name: { fontSize: 16, fontWeight: "700", color: theme.colors.ink },
  meta: { color: theme.colors.muted, fontSize: 13, marginTop: 2 },
  add: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  addDone: { backgroundColor: theme.colors.mint },
});
