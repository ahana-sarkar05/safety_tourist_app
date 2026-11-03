import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Linking, Vibration } from "react-native";
import * as Location from "expo-location";
import type { Coord } from "../utils/distance";
import { Zone, zonesContaining } from "../utils/zones";

export type LocationStatus = "loading" | "ready" | "denied" | "blocked" | "error";

type LocationValue = {
  location: Coord | null;
  accuracy: number | null; // metres; smaller is better
  status: LocationStatus;
  errorMessage: string | null;
  slow: boolean; // true when there's still no GPS fix after 20 seconds
  activeZones: Zone[]; // alert zones the user is inside right now
  setNavigationMode: (on: boolean) => void; // faster, more precise GPS
  retry: () => void;
  openSettings: () => void;
};

const LocationContext = createContext<LocationValue | null>(null);

const NORMAL_WATCH = {
  accuracy: Location.Accuracy.High,
  distanceInterval: 10,
  timeInterval: 5000,
};
const NAVIGATION_WATCH = {
  accuracy: Location.Accuracy.BestForNavigation,
  distanceInterval: 3,
  timeInterval: 1000,
};

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<Coord | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [status, setStatus] = useState<LocationStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [navMode, setNavMode] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const gotFix = useRef(false);
  const statusRef = useRef<LocationStatus>("loading");
  const previousZoneIds = useRef<string[]>([]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Permission + live GPS. Restarts when you retry or switch navigation mode.
  useEffect(() => {
    let cancelled = false;
    let subscription: Location.LocationSubscription | undefined;
    let slowTimer: ReturnType<typeof setTimeout> | undefined;

    const apply = (loc: Location.LocationObject) => {
      gotFix.current = true;
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      setAccuracy(loc.coords.accuracy ?? null);
      setSlow(false);
    };

    const start = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (permission.status !== "granted") {
          setStatus(permission.canAskAgain ? "denied" : "blocked");
          return;
        }

        if (!(await Location.hasServicesEnabledAsync())) {
          if (cancelled) return;
          setErrorMessage(
            "Location services are switched off. Turn them on in your phone settings."
          );
          setStatus("error");
          return;
        }

        // A recent last-known spot lets the map open instantly.
        const last = await Location.getLastKnownPositionAsync();
        if (cancelled) return;
        if (
          last &&
          !gotFix.current &&
          Date.now() - last.timestamp < 5 * 60 * 1000
        ) {
          apply(last);
        }

        setErrorMessage(null);
        setStatus("ready");

        slowTimer = setTimeout(() => {
          if (!gotFix.current) setSlow(true);
        }, 20000);

        const sub = await Location.watchPositionAsync(
          navMode ? NAVIGATION_WATCH : NORMAL_WATCH,
          apply
        );
        if (cancelled) {
          sub.remove();
          return;
        }
        subscription = sub;
      } catch (e) {
        if (cancelled) return;
        setErrorMessage(
          e instanceof Error ? e.message : "Couldn't start GPS tracking."
        );
        setStatus("error");
      }
    };

    void start();

    return () => {
      cancelled = true;
      subscription?.remove();
      if (slowTimer) clearTimeout(slowTimer);
    };
  }, [attempt, navMode]);

  // Coming back from the phone's settings screen? Try again automatically.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && statusRef.current !== "ready") {
        setAttempt((a) => a + 1);
      }
    });
    return () => sub.remove();
  }, []);

  const activeZones = useMemo(
    () => (location ? zonesContaining(location) : []),
    [location]
  );

  // Buzz once when you walk INTO a new zone.
  useEffect(() => {
    const entered = activeZones.filter(
      (z) => !previousZoneIds.current.includes(z.id)
    );
    if (entered.length > 0) Vibration.vibrate([0, 500, 200, 500]);
    previousZoneIds.current = activeZones.map((z) => z.id);
  }, [activeZones]);

  const setNavigationMode = useCallback((on: boolean) => setNavMode(on), []);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  const value = useMemo<LocationValue>(
    () => ({
      location,
      accuracy,
      status,
      errorMessage,
      slow,
      activeZones,
      setNavigationMode,
      retry,
      openSettings,
    }),
    [
      location,
      accuracy,
      status,
      errorMessage,
      slow,
      activeZones,
      setNavigationMode,
      retry,
      openSettings,
    ]
  );

  return (
    <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
  );
}

export function useLocation(): LocationValue {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error("useLocation must be used inside <LocationProvider>");
  }
  return ctx;
}
