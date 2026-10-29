import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../constants/app-theme";
import { formatDistance } from "../../utils/distance";
import type { Place } from "../../utils/places";

export function SearchBar({
  value,
  onChangeText,
  onFocus,
  onClear,
  loading,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onFocus: () => void;
  onClear: () => void;
  loading: boolean;
}) {
  return (
    <View style={styles.bar}>
      <Ionicons name="search" size={20} color={theme.colors.muted} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        placeholder="Search places or addresses"
        placeholderTextColor={theme.colors.muted}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel="Search places"
      />
      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : value.length > 0 ? (
        <Pressable
          onPress={onClear}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Ionicons name="close-circle" size={20} color={theme.colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function SearchResults({
  title,
  places,
  loading,
  error,
  onSelect,
}: {
  title: string | null;
  places: Place[];
  loading: boolean;
  error: string | null;
  onSelect: (place: Place) => void;
}) {
  return (
    <View style={styles.panel}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {title ? <Text style={styles.heading}>{title}</Text> : null}

        {places.map((place) => (
          <Pressable
            key={place.id}
            onPress={() => onSelect(place)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            accessibilityRole="button"
            accessibilityLabel={`${place.name}. ${place.subtitle}`}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="location" size={18} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {place.name}
              </Text>
              {place.subtitle ? (
                <Text style={styles.sub} numberOfLines={1}>
                  {place.subtitle}
                </Text>
              ) : null}
            </View>
            {place.distance !== undefined && (
              <Text style={styles.dist}>{formatDistance(place.distance)}</Text>
            )}
          </Pressable>
        ))}

        {loading && places.length === 0 && (
          <Text style={styles.note}>Searching…</Text>
        )}
        {error && <Text style={[styles.note, styles.error]}>{error}</Text>}
        {!loading && !error && places.length === 0 && (
          <Text style={styles.note}>
            No places found. Try another spelling or a nearby landmark.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 52,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.card,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  input: { flex: 1, fontSize: 15, color: theme.colors.ink, paddingVertical: 0 },

  panel: {
    maxHeight: 340,
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    paddingVertical: 6,
    ...theme.shadow,
    shadowOpacity: 0.18,
    elevation: 14,
  },
  heading: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.muted,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  rowPressed: { backgroundColor: theme.colors.bg },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 15, fontWeight: "700", color: theme.colors.ink },
  sub: { fontSize: 13, color: theme.colors.muted, marginTop: 1 },
  dist: { fontSize: 12, fontWeight: "700", color: theme.colors.primary },
  note: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: theme.colors.muted,
    textAlign: "center",
  },
  error: { color: theme.colors.coral },
});
