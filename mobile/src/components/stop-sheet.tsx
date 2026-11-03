import { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "./ui";
import { theme } from "../constants/app-theme";
import type { Coord } from "../utils/distance";
import { formatDistance } from "../utils/distance";
import { autocompletePlaces, type Place } from "../utils/places";
import { newId, normalizeTime, type Stop } from "../utils/itinerary";
import { confirm, notify } from "../utils/dialog";

type Props = {
  // The stop being edited, or null to add a new one. The parent gives this
  // component a new `key` each time it opens, so the fields start fresh.
  initial: Stop | null;
  near: Coord | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSave: (stop: Stop) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onClose: () => void;
};

export default function StopSheet({
  initial,
  near,
  canMoveUp,
  canMoveDown,
  onSave,
  onDelete,
  onMove,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const editing = initial !== null;

  const [name, setName] = useState(initial?.name ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle);
  const [coord, setCoord] = useState(initial?.coord);
  const [time, setTime] = useState(initial?.time ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [found, setFound] = useState<{ q: string; items: Place[] } | null>(null);

  const nearRef = useRef(near);
  useEffect(() => {
    nearRef.current = near;
  }, [near]);

  // Search as the person types, but only while no place is attached yet.
  const q = name.trim();
  const searching = q.length >= 3 && !coord;

  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      autocompletePlaces(q, nearRef.current, controller.signal)
        .then((items) => setFound({ q, items }))
        .catch(() => {
          // No key / no internet: the stop can still be saved by name alone.
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, searching]);

  const suggestions = searching && found?.q === q ? found.items : [];

  const onChangeName = (text: string) => {
    setName(text);
    // The attached place no longer matches what is written.
    if (coord) {
      setCoord(undefined);
      setSubtitle(undefined);
    }
  };

  const pick = (p: Place) => {
    setName(p.name);
    setSubtitle(p.subtitle || undefined);
    setCoord(p.coord);
  };

  const save = () => {
    if (!q) {
      notify("Give this stop a name");
      return;
    }
    const t = normalizeTime(time);
    if (t === null) {
      notify("Check the time", "Use 24-hour time like 09:30 or 18:45, or leave it empty.");
      return;
    }
    onSave({
      id: initial?.id ?? newId(),
      name: q,
      subtitle,
      coord,
      time: t || undefined,
      notes: notes.trim() || undefined,
      visited: initial?.visited ?? false,
    });
  };

  const confirmDelete = async () => {
    const ok = await confirm({
      title: `Delete ${initial?.name}?`,
      message: "This removes it from your itinerary.",
      confirmText: "Delete",
      cancelText: "Keep",
      destructive: true,
    });
    if (ok) onDelete();
  };

  return (
    <Modal animationType="slide" visible onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.page}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + 16,
            paddingHorizontal: 20,
            paddingBottom: 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{editing ? "Edit stop" : "Add a stop"}</Text>
            <Pressable
              onPress={onClose}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={theme.colors.ink} />
            </Pressable>
          </View>

          <Card>
            <Text style={styles.label}>Place or activity</Text>
            <TextInput
              style={styles.input}
              placeholder="Search a place, or type anything"
              placeholderTextColor={theme.colors.muted}
              value={name}
              onChangeText={onChangeName}
              autoCapitalize="words"
            />

            {coord && (
              <View style={styles.attached}>
                <Ionicons name="location" size={16} color={theme.colors.success} />
                <Text style={styles.attachedText} numberOfLines={2}>
                  {subtitle ? subtitle : "Location saved"}
                </Text>
              </View>
            )}

            {suggestions.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => pick(p)}
                style={({ pressed }) => [styles.result, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel={`Use ${p.name}`}
              >
                <Ionicons name="location-outline" size={18} color={theme.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  {p.subtitle ? (
                    <Text style={styles.resultSub} numberOfLines={1}>
                      {p.subtitle}
                    </Text>
                  ) : null}
                </View>
                {p.distance !== undefined && (
                  <Text style={styles.resultDist}>{formatDistance(p.distance)}</Text>
                )}
              </Pressable>
            ))}

            <Text style={[styles.label, { marginTop: 14 }]}>Time (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="09:30"
              placeholderTextColor={theme.colors.muted}
              value={time}
              onChangeText={setTime}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />

            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.notes]}
              placeholder="Tickets, what to bring, who to meet…"
              placeholderTextColor={theme.colors.muted}
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
            />
          </Card>

          {editing && (
            <Card style={styles.actions}>
              <Pressable
                onPress={() => onMove(-1)}
                disabled={!canMoveUp}
                style={[styles.moveBtn, !canMoveUp && styles.disabled]}
                accessibilityRole="button"
                accessibilityLabel="Move earlier"
              >
                <Ionicons name="arrow-up" size={18} color={theme.colors.primary} />
                <Text style={styles.moveText}>Earlier</Text>
              </Pressable>
              <Pressable
                onPress={() => onMove(1)}
                disabled={!canMoveDown}
                style={[styles.moveBtn, !canMoveDown && styles.disabled]}
                accessibilityRole="button"
                accessibilityLabel="Move later"
              >
                <Ionicons name="arrow-down" size={18} color={theme.colors.primary} />
                <Text style={styles.moveText}>Later</Text>
              </Pressable>
              <Pressable
                onPress={() => void confirmDelete()}
                style={styles.deleteBtn}
                accessibilityRole="button"
                accessibilityLabel="Delete stop"
              >
                <Ionicons name="trash-outline" size={18} color={theme.colors.coral} />
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </Card>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable
            onPress={save}
            style={({ pressed }) => [styles.save, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel="Save stop"
          >
            <Text style={styles.saveText}>{editing ? "Save changes" : "Add to itinerary"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: { fontSize: 28, fontWeight: "800", color: theme.colors.ink },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow,
  },
  label: { fontSize: 13, fontWeight: "700", color: theme.colors.muted, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.small,
    backgroundColor: theme.colors.bg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.ink,
    marginBottom: 10,
  },
  notes: { minHeight: 90 },
  attached: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.mint,
    borderRadius: theme.radius.small,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  attachedText: { flex: 1, color: theme.colors.ink, fontSize: 13 },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  resultName: { fontSize: 15, fontWeight: "600", color: theme.colors.ink },
  resultSub: { fontSize: 12, color: theme.colors.muted, marginTop: 1 },
  resultDist: { fontSize: 12, color: theme.colors.muted },

  actions: { flexDirection: "row", gap: 10 },
  moveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primarySoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  moveText: { color: theme.colors.primary, fontWeight: "700" },
  deleteBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.coralSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  deleteText: { color: theme.colors.coral, fontWeight: "700" },
  disabled: { opacity: 0.35 },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: theme.colors.bg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  save: {
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
