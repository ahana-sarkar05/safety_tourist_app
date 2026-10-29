import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Animated,
  Easing,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Vibration,
  useWindowDimensions,
} from "react-native";
import MapView, { Circle, Marker, Polyline } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../constants/app-theme";
import { useLocation } from "../../context/location-context";
import { Coord, distanceMeters, formatDistance } from "../../utils/distance";
import {
  formatDuration,
  snapToPath,
  stepIcon,
  stepIndexAt,
  type IconName,
} from "../../utils/nav";
import {
  autocompletePlaces,
  isAbortError,
  reverseGeocode,
  searchNearby,
  type Place,
} from "../../utils/places";
import { fetchRoute, type Route, type TravelMode } from "../../utils/routes";
import { loadSafePoint, saveSafePoint } from "../../utils/safe-point";
import { WARM_MAP_STYLE } from "../../utils/map-style";
import { ZONES, ZONE_COLORS, nearestZoneEdge } from "../../utils/zones";
import GpsChip from "../../components/map/gps-chip";
import { SearchBar, SearchResults } from "../../components/map/search";
import SafetyStatusCard from "../../components/map/safety-status-card";
import PlaceCard from "../../components/map/place-card";
import NavigationPanel from "../../components/map/navigation-panel";
import ViewMarker from "../../components/map/view-marker";

const DEFAULT_REGION = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 25,
  longitudeDelta: 25,
};
const COLLAPSED_MAP_HEIGHT = 96;
const OFF_ROUTE_METERS = 40;
const ARRIVE_METERS = 25;
const REROUTE_COOLDOWN_MS = 12000;

const HELP_CHIPS: { label: string; term: string; icon: IconName }[] = [
  { label: "Hospitals", term: "hospital", icon: "medkit" },
  { label: "Police", term: "police station", icon: "shield-half" },
  { label: "Pharmacies", term: "pharmacy", icon: "bandage" },
];

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const {
    location,
    accuracy,
    status,
    errorMessage,
    slow,
    activeZones,
    setNavigationMode,
    retry,
    openSettings,
  } = useLocation();

  const mapRef = useRef<MapView>(null);
  const locationRef = useRef<Coord | null>(null);
  const followRef = useRef(true);
  const requestId = useRef(0);
  const routedKey = useRef<string | null>(null);
  const lastReroute = useRef(0);
  const arrivedRef = useRef(false);

  // Map follows you until you drag it; the locate button turns following back on.
  const [following, setFollowing] = useState(true);

  const [safePoint, setSafePoint] = useState<Coord | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [mode, setMode] = useState<TravelMode>("walk");
  const [route, setRoute] = useState<Route | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [rerouting, setRerouting] = useState(false);

  // Search
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [resultsTitle, setResultsTitle] = useState<string | null>(null);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchBottom, setSearchBottom] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Collapsible map
  const expandedHeight = Math.round(windowHeight * 0.4);
  const [mapHeight] = useState(() => new Animated.Value(expandedHeight));
  const [expanded, setExpanded] = useState(true);

  // Small message that fades after a moment
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasFix = location !== null;

  // Keep a ref copy of the location so async callbacks always see the latest.
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    let alive = true;
    loadSafePoint().then((p) => {
      if (alive) setSafePoint(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    },
    []
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  // ---------- Map: expand / collapse ----------

  const setMapExpanded = useCallback(
    (open: boolean) => {
      setExpanded(open);
      Animated.timing(mapHeight, {
        toValue: open ? expandedHeight : COLLAPSED_MAP_HEIGHT,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        const here = locationRef.current;
        if (followRef.current && here) {
          mapRef.current?.animateCamera({ center: here }, { duration: 200 });
        }
      });
    },
    [mapHeight, expandedHeight]
  );

  // Tap the handle to toggle, or swipe it up (collapse) / down (expand).
  const touchStartY = useRef(0);

  // ---------- Map: camera ----------

  // First GPS fix: fly to the user.
  useEffect(() => {
    if (!hasFix || !locationRef.current) return;
    mapRef.current?.animateToRegion(
      { ...locationRef.current, latitudeDelta: 0.006, longitudeDelta: 0.006 },
      700
    );
  }, [hasFix]);

  // Follow the user while following is on.
  useEffect(() => {
    if (!location || !followRef.current) return;
    mapRef.current?.animateCamera({ center: location }, { duration: 400 });
  }, [location]);

  const stopFollowing = useCallback(() => {
    if (followRef.current) {
      followRef.current = false;
      setFollowing(false);
    }
  }, []);

  const recenter = () => {
    const here = locationRef.current;
    if (!here) {
      showToast("Still finding your location…");
      return;
    }
    followRef.current = true;
    setFollowing(true);
    mapRef.current?.animateCamera(
      { center: here, zoom: navigating ? 17.5 : 16 },
      { duration: 400 }
    );
  };

  const fitRoute = useCallback(
    (path: Coord[]) => {
      if (path.length < 2) return;
      stopFollowing();
      mapRef.current?.fitToCoordinates(path, {
        edgePadding: { top: 70, right: 50, bottom: 70, left: 50 },
        animated: true,
      });
    },
    [stopFollowing]
  );

  // ---------- Routing ----------

  const requestRoute = useCallback(
    async (
      dest: Place,
      travelMode: TravelMode,
      opts: { fit: boolean; silent: boolean }
    ) => {
      const from = locationRef.current;
      if (!from) return;

      const id = ++requestId.current;
      if (!opts.silent) {
        setRouteLoading(true);
        setRouteError(null);
      }

      try {
        const r = await fetchRoute(from, dest.coord, travelMode);
        if (id !== requestId.current) return;
        setRoute(r);
        setRouteError(null);
        if (opts.fit) fitRoute(r.path);
      } catch (e) {
        if (id !== requestId.current) return;
        if (opts.silent) {
          showToast("Couldn't update the route");
        } else {
          setRoute(null);
          setRouteError(
            e instanceof Error ? e.message : "Couldn't get directions."
          );
        }
      } finally {
        if (id === requestId.current) {
          setRouteLoading(false);
          setRerouting(false);
        }
      }
    },
    [fitRoute, showToast]
  );

  // Fetch a route whenever the destination or travel mode changes.
  useEffect(() => {
    if (!destination || !hasFix) return;
    const key = `${destination.coord.latitude},${destination.coord.longitude}|${mode}`;
    if (routedKey.current === key) return;
    routedKey.current = key;
    void requestRoute(destination, mode, { fit: true, silent: false });
  }, [destination, mode, hasFix, requestRoute]);

  const retryRoute = () => {
    if (!destination) return;
    routedKey.current = `${destination.coord.latitude},${destination.coord.longitude}|${mode}`;
    void requestRoute(destination, mode, { fit: true, silent: false });
  };

  // Where are we along the route?
  const progress = useMemo(
    () =>
      route && location ? snapToPath(route.path, route.cum, location) : null,
    [route, location]
  );

  // ---------- Destination ----------

  const clearDestination = useCallback(() => {
    requestId.current++; // ignore any request still in flight
    routedKey.current = null;
    setDestination(null);
    setRoute(null);
    setRouteError(null);
    setRouteLoading(false);
    setRerouting(false);
    setNavigating(false);
    setNavigationMode(false);
  }, [setNavigationMode]);

  const closeSearch = useCallback(() => {
    Keyboard.dismiss();
    setResultsOpen(false);
  }, []);

  const selectPlace = (place: Place) => {
    closeSearch();
    setQuery("");
    setResults([]);
    setResultsTitle(null);
    routedKey.current = null;
    setRoute(null);
    setRouteError(null);
    setNavigating(false);
    setNavigationMode(false);
    setDestination(place);
    setMapExpanded(true);
  };

  const dropPin = (coord: Coord) => {
    if (navigating) return;
    const id = `pin-${Date.now()}`;
    selectPlace({
      id,
      name: "Dropped pin",
      subtitle: "Finding the address…",
      coord,
      kind: "pin",
    });
    reverseGeocode(coord)
      .then((p) => {
        setDestination((cur) =>
          cur && cur.id === id
            ? {
                ...cur,
                name: p?.name ?? "Dropped pin",
                subtitle: p?.subtitle || "Selected on the map",
              }
            : cur
        );
      })
      .catch(() => {
        setDestination((cur) =>
          cur && cur.id === id ? { ...cur, subtitle: "Selected on the map" } : cur
        );
      });
  };

  // ---------- Search ----------

  const onQueryChange = (text: string) => {
    setQuery(text);
    setResultsTitle(null);
    setResultsOpen(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    abortRef.current = null;

    const trimmed = text.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }

    setSearching(true);
    setSearchError(null);
    debounceRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        setResults(
          await autocompletePlaces(trimmed, locationRef.current, ctrl.signal)
        );
      } catch (e) {
        if (isAbortError(e)) return;
        setResults([]);
        setSearchError(e instanceof Error ? e.message : "Search failed.");
      } finally {
        if (abortRef.current === ctrl) setSearching(false);
      }
    }, 500);
  };

  const clearSearch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    abortRef.current = null;
    setQuery("");
    setResults([]);
    setResultsTitle(null);
    setSearching(false);
    setSearchError(null);
    setResultsOpen(false);
  };

  const findNearby = async (label: string, term: string) => {
    const here = locationRef.current;
    if (!here) {
      showToast("Still finding your location…");
      return;
    }
    Keyboard.dismiss();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setQuery("");
    setResults([]);
    setResultsTitle(`Nearest ${label.toLowerCase()}`);
    setResultsOpen(true);
    setSearching(true);
    setSearchError(null);

    try {
      setResults(await searchNearby(term, here, 5, ctrl.signal));
    } catch (e) {
      if (isAbortError(e)) return;
      setSearchError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      if (abortRef.current === ctrl) setSearching(false);
    }
  };

  // ---------- Safe point ----------

  const setSafeHere = async () => {
    const here = locationRef.current;
    if (!here) {
      showToast("Still finding your location…");
      return;
    }
    setSafePoint(here);
    try {
      await saveSafePoint(here);
      showToast("Safe point saved here");
    } catch {
      showToast("Saved for now, but couldn't store it on this phone");
    }
  };

  const guideBack = () => {
    if (!safePoint) {
      showToast("Set a safe point first");
      return;
    }
    selectPlace({
      id: "safe-point",
      name: "Safe point",
      subtitle: "The spot you saved as your base",
      coord: safePoint,
      kind: "safe",
    });
  };

  // ---------- Navigation ----------

  const endNavigation = useCallback(() => {
    clearDestination();
  }, [clearDestination]);

  const startNavigation = () => {
    if (!destination || !route) return;
    arrivedRef.current = false;
    lastReroute.current = Date.now();
    setNavigating(true);
    setNavigationMode(true);
    closeSearch();
    followRef.current = true;
    setFollowing(true);
    const here = locationRef.current;
    if (here) {
      mapRef.current?.animateCamera(
        { center: here, zoom: 17.5 },
        { duration: 600 }
      );
    }
    // Refresh the route from where you actually are right now.
    void requestRoute(destination, mode, { fit: false, silent: true });
  };

  // Off route? Get a new route (at most once every 12 seconds).
  useEffect(() => {
    if (!navigating || !destination || !progress) return;
    const now = Date.now();
    if (
      progress.offRoute > OFF_ROUTE_METERS &&
      now - lastReroute.current > REROUTE_COOLDOWN_MS
    ) {
      lastReroute.current = now;
      setRerouting(true);
      void requestRoute(destination, mode, { fit: false, silent: true });
    }
  }, [navigating, destination, progress, mode, requestRoute]);

  // Arrived? (worked out from your position, no extra state needed)
  const arrived = useMemo(() => {
    if (!navigating || !destination || !location || !route || !progress) {
      return false;
    }
    const total = route.cum[route.cum.length - 1] ?? route.distanceMeters;
    return (
      distanceMeters(location, destination.coord) <= ARRIVE_METERS ||
      total - progress.along <= 20
    );
  }, [navigating, destination, location, route, progress]);

  // Buzz once when you arrive.
  useEffect(() => {
    if (arrived && !arrivedRef.current) {
      arrivedRef.current = true;
      Vibration.vibrate(400);
    }
  }, [arrived]);

  // Everything the navigation panel needs.
  const navInfo = useMemo(() => {
    if (!route || !progress) return null;

    const total = route.cum[route.cum.length - 1] ?? route.distanceMeters;
    const remainingMeters = Math.max(0, total - progress.along);
    const remainingSeconds =
      total > 0 ? route.durationSeconds * (remainingMeters / total) : 0;

    const k = stepIndexAt(route.steps, progress.index);
    const next = route.steps[k + 1];
    const distanceTo = (vertex: number) =>
      Math.max(0, (route.cum[vertex] ?? progress.along) - progress.along);

    return {
      remainingMeters,
      remainingSeconds,
      icon: (next ? stepIcon(next.type) : "flag") as IconName,
      instruction: next ? next.instruction : "Arrive at your destination",
      distanceToTurn: next ? distanceTo(next.from) : remainingMeters,
      upcoming: route.steps.slice(k + 2, k + 6).map((s) => ({
        icon: stepIcon(s.type),
        text: s.instruction,
        distance: distanceTo(s.from),
      })),
    };
  }, [route, progress]);

  // The route, split into the part you've walked and the part still ahead.
  const split = useMemo(() => {
    if (!navigating || !route || !progress) return null;
    return {
      done: [...route.path.slice(0, progress.index + 1), progress.point],
      ahead: [progress.point, ...route.path.slice(progress.index + 1)],
    };
  }, [navigating, route, progress]);

  const nearest = useMemo(
    () => (location ? nearestZoneEdge(location) : null),
    [location]
  );

  const locating = status === "ready" && !location;
  const resultsVisible =
    !navigating &&
    resultsOpen &&
    (resultsTitle !== null || query.trim().length >= 3);

  const bubble = route
    ? route.path[Math.floor(route.path.length / 2)]
    : null;

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Live Map & Navigation</Text>
        <GpsChip accuracy={accuracy} ready={status === "ready"} />
      </View>

      {/* Search (hidden while navigating to save space) */}
      {!navigating && (
        <View
          style={styles.searchWrap}
          onLayout={(e) =>
            setSearchBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)
          }
        >
          <SearchBar
            value={query}
            onChangeText={onQueryChange}
            onFocus={() => setResultsOpen(true)}
            onClear={clearSearch}
            loading={searching}
          />
        </View>
      )}

      {/* Map */}
      <Animated.View style={[styles.mapBox, { height: mapHeight }]}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={
            location
              ? {
                  ...location,
                  latitudeDelta: 0.006,
                  longitudeDelta: 0.006,
                }
              : DEFAULT_REGION
          }
          customMapStyle={WARM_MAP_STYLE}
          userInterfaceStyle="light"
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
          pitchEnabled={false}
          onPanDrag={stopFollowing}
          onPress={closeSearch}
          onLongPress={(e) => dropPin(e.nativeEvent.coordinate)}
        >
          {ZONES.map((z) => (
            <Circle
              key={z.id}
              center={z.center}
              radius={z.radius}
              strokeColor={ZONE_COLORS[z.type].stroke}
              fillColor={ZONE_COLORS[z.type].fill}
              strokeWidth={2}
            />
          ))}

          {safePoint && (
            <Marker
              coordinate={safePoint}
              pinColor={theme.colors.success}
              title="Safe point"
            />
          )}

          {route && route.path.length > 1 && (
            <Polyline
              coordinates={route.path}
              strokeColor="rgba(255,255,255,0.95)"
              strokeWidth={11}
              lineCap="round"
              lineJoin="round"
            />
          )}
          {split ? (
            <>
              <Polyline
                coordinates={split.done}
                strokeColor="#CDB9AE"
                strokeWidth={6}
                lineCap="round"
                lineJoin="round"
              />
              <Polyline
                coordinates={split.ahead}
                strokeColor={theme.colors.primary}
                strokeWidth={6}
                lineCap="round"
                lineJoin="round"
              />
            </>
          ) : (
            route &&
            route.path.length > 1 && (
              <Polyline
                coordinates={route.path}
                strokeColor={theme.colors.primary}
                strokeWidth={6}
                lineCap="round"
                lineJoin="round"
              />
            )
          )}

          {destination && (
            <Marker
              coordinate={destination.coord}
              pinColor={theme.colors.primary}
              title={destination.name}
              description={destination.subtitle}
            />
          )}

          {route && bubble && !navigating && (
            <ViewMarker
              coordinate={bubble}
              refreshKey={`${Math.round(route.durationSeconds)}-${Math.round(route.distanceMeters)}`}
            >
              <View style={styles.bubble}>
                <Text style={styles.bubbleTime}>
                  {formatDuration(route.durationSeconds)}
                </Text>
                <Text style={styles.bubbleDist}>
                  {formatDistance(route.distanceMeters)}
                </Text>
              </View>
            </ViewMarker>
          )}
        </MapView>

        {locating && (
          <View style={styles.locating}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.locatingText}>
              {slow
                ? "Still searching. Try moving outdoors."
                : "Finding your location…"}
            </Text>
          </View>
        )}

        <Pressable
          onPress={recenter}
          style={[styles.locate, following && styles.locateOn]}
          accessibilityRole="button"
          accessibilityLabel="Centre the map on my location"
        >
          <Ionicons
            name={following ? "navigate" : "locate"}
            size={22}
            color={following ? "#FFFFFF" : theme.colors.primary}
          />
        </Pressable>

        {toast && (
          <View style={styles.toast} pointerEvents="none">
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}
      </Animated.View>

      {/* Bottom sheet */}
      <View style={styles.sheet}>
        <Pressable
          onPress={() => setMapExpanded(!expanded)}
          onTouchStart={(e) => {
            touchStartY.current = e.nativeEvent.pageY;
          }}
          onTouchEnd={(e) => {
            const dy = e.nativeEvent.pageY - touchStartY.current;
            if (dy > 24) setMapExpanded(true);
            else if (dy < -24) setMapExpanded(false);
          }}
          style={styles.handleArea}
          accessibilityRole="button"
          accessibilityLabel={expanded ? "Collapse map" : "Expand map"}
        >
          <View style={styles.handleBar} />
          <View style={styles.handleRow}>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={theme.colors.muted}
            />
            <Text style={styles.handleText}>
              {expanded ? "Collapse map" : "Show map"}
            </Text>
          </View>
        </Pressable>

        <ScrollView
          contentContainerStyle={styles.sheetContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {status !== "ready" && status !== "loading" && (
            <ProblemCard
              status={status}
              message={errorMessage}
              onRetry={retry}
              onSettings={openSettings}
            />
          )}

          {navigating && arrived && destination ? (
            <ArrivedCard name={destination.name} onDone={endNavigation} />
          ) : navigating && navInfo ? (
            <NavigationPanel
              icon={navInfo.icon}
              instruction={navInfo.instruction}
              distanceToTurn={navInfo.distanceToTurn}
              remainingMeters={navInfo.remainingMeters}
              remainingSeconds={navInfo.remainingSeconds}
              upcoming={navInfo.upcoming}
              rerouting={rerouting}
              onEnd={endNavigation}
            />
          ) : destination ? (
            <PlaceCard
              place={destination}
              route={route}
              loading={routeLoading}
              error={routeError}
              mode={mode}
              onModeChange={setMode}
              onStart={startNavigation}
              onRetry={retryRoute}
              onClose={clearDestination}
            />
          ) : (
            <View style={styles.idle}>
              <Text style={styles.sectionTitle}>Quick actions</Text>
              <View style={styles.tiles}>
                <ActionTile
                  icon="home"
                  title="Guide me back"
                  subtitle={
                    safePoint ? "Route to your safe point" : "Set a safe point first"
                  }
                  dimmed={!safePoint}
                  onPress={guideBack}
                />
                <ActionTile
                  icon="pin"
                  title="Set safe point"
                  subtitle="Save where you are now"
                  onPress={setSafeHere}
                />
              </View>

              <Text style={styles.sectionTitle}>Find help nearby</Text>
              <View style={styles.chips}>
                {HELP_CHIPS.map((c) => (
                  <Pressable
                    key={c.label}
                    onPress={() => findNearby(c.label, c.term)}
                    style={({ pressed }) => [
                      styles.chip,
                      pressed && { opacity: 0.8 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Find ${c.label.toLowerCase()} near me`}
                  >
                    <Ionicons name={c.icon} size={16} color={theme.colors.primary} />
                    <Text style={styles.chipText}>{c.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.tip}>
                Tip: press and hold anywhere on the map to drop a pin and get
                directions there.
              </Text>
            </View>
          )}

          <SafetyStatusCard activeZones={activeZones} nearest={nearest} />
        </ScrollView>
      </View>

      {/* Search results float above everything */}
      {resultsVisible && (
        <View style={[styles.results, { top: searchBottom + 6 }]}>
          <SearchResults
            title={resultsTitle}
            places={results}
            loading={searching}
            error={searchError}
            onSelect={selectPlace}
          />
        </View>
      )}
    </View>
  );
}

function ActionTile({
  icon,
  title,
  subtitle,
  dimmed,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  dimmed?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        dimmed && { opacity: 0.6 },
        pressed && { opacity: 0.8 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
    >
      <View style={styles.tileIcon}>
        <Ionicons name={icon} size={22} color={theme.colors.primary} />
      </View>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileSub}>{subtitle}</Text>
    </Pressable>
  );
}

function ArrivedCard({ name, onDone }: { name: string; onDone: () => void }) {
  return (
    <View style={styles.arrived}>
      <View style={styles.arrivedIcon}>
        <Ionicons name="flag" size={28} color={theme.colors.success} />
      </View>
      <Text style={styles.arrivedTitle}>{"You've arrived"}</Text>
      <Text style={styles.arrivedName} numberOfLines={2}>
        {name}
      </Text>
      <Pressable
        onPress={onDone}
        style={styles.arrivedButton}
        accessibilityRole="button"
        accessibilityLabel="Done"
      >
        <Text style={styles.arrivedButtonText}>Done</Text>
      </Pressable>
    </View>
  );
}

function ProblemCard({
  status,
  message,
  onRetry,
  onSettings,
}: {
  status: "denied" | "blocked" | "error";
  message: string | null;
  onRetry: () => void;
  onSettings: () => void;
}) {
  const text =
    status === "denied"
      ? "Allow location so we can show where you are and keep you safe."
      : status === "blocked"
        ? "Location permission is blocked. Open settings and allow it for this app."
        : (message ?? "We couldn't get your location.");

  return (
    <View style={styles.problem}>
      <View style={styles.problemTop}>
        <Ionicons name="location" size={22} color={theme.colors.coral} />
        <Text style={styles.problemTitle}>Location is off</Text>
      </View>
      <Text style={styles.problemText}>{text}</Text>
      <View style={styles.problemButtons}>
        {status !== "blocked" && (
          <Pressable
            onPress={onRetry}
            style={styles.problemPrimary}
            accessibilityRole="button"
          >
            <Text style={styles.problemPrimaryText}>
              {status === "denied" ? "Allow location" : "Try again"}
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={onSettings}
          style={styles.problemSecondary}
          accessibilityRole="button"
        >
          <Text style={styles.problemSecondaryText}>Open settings</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  title: { fontSize: 20, fontWeight: "800", color: theme.colors.ink },

  searchWrap: { paddingHorizontal: 20, paddingBottom: 12, zIndex: 5 },

  mapBox: { width: "100%", backgroundColor: "#EFE5DC", overflow: "hidden" },

  locate: {
    position: "absolute",
    right: 14,
    bottom: 14,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow,
    shadowOpacity: 0.2,
    elevation: 5,
  },
  locateOn: { backgroundColor: theme.colors.primary },

  locating: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.colors.card,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    ...theme.shadow,
    elevation: 5,
  },
  locatingText: { fontSize: 13, color: theme.colors.ink, fontWeight: "600" },

  toast: {
    position: "absolute",
    left: 16,
    bottom: 18,
    maxWidth: "70%",
    backgroundColor: theme.colors.ink,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  toastText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },

  bubble: {
    backgroundColor: theme.colors.ink,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: "center",
    marginBottom: 6,
  },
  bubbleTime: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  bubbleDist: { color: "rgba(255,255,255,0.8)", fontSize: 11 },

  sheet: { flex: 1, backgroundColor: theme.colors.bg },
  handleArea: { alignItems: "center", paddingTop: 8, paddingBottom: 6 },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
  },
  handleRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  handleText: { fontSize: 12, color: theme.colors.muted, fontWeight: "600" },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 28, gap: 14 },

  results: { position: "absolute", left: 20, right: 20, zIndex: 30 },

  idle: { gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: theme.colors.ink },
  tiles: { flexDirection: "row", gap: 12 },
  tile: {
    flex: 1,
    backgroundColor: theme.colors.cardTint,
    borderRadius: 20,
    padding: 14,
  },
  tileIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  tileTitle: { fontSize: 15, fontWeight: "800", color: theme.colors.ink },
  tileSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipText: { fontSize: 14, fontWeight: "600", color: theme.colors.ink },
  tip: { fontSize: 12, color: theme.colors.muted, lineHeight: 17 },

  arrived: {
    backgroundColor: theme.colors.mint,
    borderRadius: theme.radius.card,
    padding: 20,
    alignItems: "center",
    gap: 6,
  },
  arrivedIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  arrivedTitle: { fontSize: 20, fontWeight: "800", color: theme.colors.ink },
  arrivedName: { fontSize: 14, color: theme.colors.muted, textAlign: "center" },
  arrivedButton: {
    marginTop: 8,
    height: 48,
    alignSelf: "stretch",
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  arrivedButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },

  problem: {
    backgroundColor: theme.colors.coralSoft,
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  problemTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  problemTitle: { fontSize: 16, fontWeight: "800", color: theme.colors.ink },
  problemText: { fontSize: 14, color: theme.colors.ink, lineHeight: 20 },
  problemButtons: { flexDirection: "row", gap: 10, marginTop: 4 },
  problemPrimary: {
    backgroundColor: theme.colors.coral,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  problemPrimaryText: { color: "#FFFFFF", fontWeight: "700" },
  problemSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: theme.colors.coral,
  },
  problemSecondaryText: { color: theme.colors.coral, fontWeight: "700" },
});
