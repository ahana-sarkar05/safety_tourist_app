import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Card, IconBadge } from "../../components/ui";
import StopCard from "../../components/stop-card";
import StopSheet from "../../components/stop-sheet";
import Suggestions from "../../components/suggestions";
import { theme } from "../../constants/app-theme";
import { useLocation } from "../../context/location-context";
import type { Place } from "../../utils/places";
import { confirm } from "../../utils/dialog";
import {
  addDay,
  addStop,
  isDayDone,
  loadItinerary,
  moveStop,
  newId,
  removeDay,
  removeStop,
  saveItinerary,
  toggleVisited,
  updateStop,
  type Itinerary,
  type Stop,
} from "../../utils/itinerary";

// "closed", adding a new stop, or editing an existing one.
type Sheet = { kind: "closed" } | { kind: "add" } | { kind: "edit"; stopId: string };

export default function ItineraryScreen() {
  const { location } = useLocation();

  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>({ kind: "closed" });

  useEffect(() => {
    let alive = true;
    loadItinerary().then((it) => {
      if (alive) setItinerary(it);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!itinerary) {
    return <Screen title="Itinerary" subtitle="Plan your days, tick off your stops">{null}</Screen>;
  }

  const commit = (next: Itinerary) => {
    setItinerary(next);
    void saveItinerary(next);
  };

  const days = itinerary.days;
  const activeIndex = Math.max(
    0,
    days.findIndex((d) => d.id === selectedId)
  );
  const active = days[activeIndex] ?? null;
  const dayLabel = active ? `Day ${activeIndex + 1}` : "Day 1";

  // Adding to a trip that has no days yet creates Day 1 on the spot.
  const withActiveDay = (it: Itinerary): { it: Itinerary; dayId: string } => {
    if (active) return { it, dayId: active.id };
    const created = addDay(it);
    return { it: created, dayId: created.days[0].id };
  };

  const editingStop: Stop | null =
    sheet.kind === "edit" ? (active?.stops.find((s) => s.id === sheet.stopId) ?? null) : null;
  const editingIndex = editingStop && active ? active.stops.findIndex((s) => s.id === editingStop.id) : -1;

  const saveFromSheet = (stop: Stop) => {
    if (sheet.kind === "edit" && active) {
      commit(updateStop(itinerary, active.id, stop));
    } else {
      const { it, dayId } = withActiveDay(itinerary);
      commit(addStop(it, dayId, stop));
      setSelectedId(dayId);
    }
    setSheet({ kind: "closed" });
  };

  const addSuggestion = (p: Place) => {
    const { it, dayId } = withActiveDay(itinerary);
    commit(
      addStop(it, dayId, {
        id: newId(),
        name: p.name,
        subtitle: p.subtitle || undefined,
        coord: p.coord,
        visited: false,
      })
    );
    setSelectedId(dayId);
  };

  const addNewDay = () => {
    const next = addDay(itinerary);
    commit(next);
    setSelectedId(next.days[next.days.length - 1].id);
  };

  const confirmRemoveDay = async () => {
    if (!active) return;
    const count = active.stops.length;
    const ok = await confirm({
      title: `Remove ${dayLabel}?`,
      message:
        count > 0
          ? `Its ${count} stop${count === 1 ? "" : "s"} will be deleted too.`
          : "This day is empty.",
      confirmText: "Remove",
      cancelText: "Keep",
      destructive: true,
    });
    if (!ok) return;
    commit(removeDay(itinerary, active.id));
    setSelectedId(null);
  };

  const visitedCount = active ? active.stops.filter((s) => s.visited).length : 0;

  return (
    <>
      <Screen title="Itinerary" subtitle="Plan your days, tick off your stops">
        {days.length === 0 ? (
          <Card style={styles.empty}>
            <IconBadge name="calendar" />
            <Text style={styles.emptyTitle}>Plan your trip</Text>
            <Text style={styles.emptySub}>
              Add the places you want to visit, or pick from suggestions near you below.
            </Text>
            <Pressable
              onPress={() => setSheet({ kind: "add" })}
              style={styles.primaryBtn}
              accessibilityRole="button"
              accessibilityLabel="Add your first stop"
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Add your first stop</Text>
            </Pressable>
          </Card>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dayChips}
            >
              {days.map((d, i) => {
                const selected = i === activeIndex;
                const done = isDayDone(d);
                return (
                  <Pressable
                    key={d.id}
                    onPress={() => setSelectedId(d.id)}
                    style={[styles.dayChip, selected && styles.dayChipOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Day ${i + 1}${done ? ", completed" : ""}`}
                  >
                    {done && (
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={selected ? "#FFFFFF" : theme.colors.success}
                      />
                    )}
                    <Text style={[styles.dayText, selected && styles.dayTextOn]}>Day {i + 1}</Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={addNewDay}
                style={styles.dayAdd}
                accessibilityRole="button"
                accessibilityLabel="Add a day"
              >
                <Ionicons name="add" size={18} color={theme.colors.primary} />
                <Text style={styles.dayAddText}>Add day</Text>
              </Pressable>
            </ScrollView>

            {active && (
              <>
                <View style={styles.dayHead}>
                  <View>
                    <Text style={styles.dayTitle}>{dayLabel}</Text>
                    <Text style={styles.daySub}>
                      {active.stops.length === 0
                        ? "No stops yet"
                        : `${visitedCount} of ${active.stops.length} visited`}
                    </Text>
                  </View>
                  <Pressable onPress={() => void confirmRemoveDay()} hitSlop={8} accessibilityRole="button">
                    <Text style={styles.removeDay}>Remove day</Text>
                  </Pressable>
                </View>

                {active.stops.map((s) => (
                  <StopCard
                    key={s.id}
                    stop={s}
                    onToggle={() => commit(toggleVisited(itinerary, active.id, s.id))}
                    onEdit={() => setSheet({ kind: "edit", stopId: s.id })}
                  />
                ))}

                <Pressable
                  onPress={() => setSheet({ kind: "add" })}
                  style={styles.addStop}
                  accessibilityRole="button"
                  accessibilityLabel="Add a stop"
                >
                  <Ionicons name="add-circle" size={22} color={theme.colors.primary} />
                  <Text style={styles.addStopText}>Add a stop</Text>
                </Pressable>
              </>
            )}
          </>
        )}

        <Suggestions
          near={location}
          existing={active?.stops ?? []}
          dayLabel={dayLabel}
          onAdd={addSuggestion}
        />

        {/* room for the floating tab bar */}
        <View style={{ height: 80 }} />
      </Screen>

      {sheet.kind !== "closed" && (sheet.kind === "add" || editingStop) && (
        <StopSheet
          key={sheet.kind === "edit" ? sheet.stopId : "new"}
          initial={editingStop}
          near={location}
          canMoveUp={editingIndex > 0}
          canMoveDown={!!active && editingIndex >= 0 && editingIndex < active.stops.length - 1}
          onSave={saveFromSheet}
          onDelete={() => {
            if (active && editingStop) commit(removeStop(itinerary, active.id, editingStop.id));
            setSheet({ kind: "closed" });
          }}
          onMove={(dir) => {
            if (active && editingStop) commit(moveStop(itinerary, active.id, editingStop.id, dir));
          }}
          onClose={() => setSheet({ kind: "closed" })}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", paddingVertical: 28, gap: 6 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: theme.colors.ink, marginTop: 10 },
  emptySub: { color: theme.colors.muted, textAlign: "center", paddingHorizontal: 12 },
  primaryBtn: {
    marginTop: 14,
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },

  dayChips: { gap: 8, paddingBottom: 16 },
  dayChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
  },
  dayChipOn: { backgroundColor: theme.colors.primary },
  dayText: { color: theme.colors.ink, fontWeight: "700" },
  dayTextOn: { color: "#FFFFFF" },
  dayAdd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderStyle: "dashed",
  },
  dayAddText: { color: theme.colors.primary, fontWeight: "700" },

  dayHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  dayTitle: { fontSize: 22, fontWeight: "800", color: theme.colors.ink },
  daySub: { color: theme.colors.muted, marginTop: 2 },
  removeDay: { color: theme.colors.coral, fontWeight: "700", fontSize: 13 },

  addStop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: theme.colors.primary,
    marginBottom: 24,
  },
  addStopText: { color: theme.colors.primary, fontWeight: "700", fontSize: 15 },
});
