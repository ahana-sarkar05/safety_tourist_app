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
import { AppState } from "react-native";
import { useLocation } from "./location-context";
import type { Coord } from "../utils/distance";
import {
  backgroundRunning,
  createSession,
  getActiveSession,
  pushLocation,
  startBackgroundUpdates,
  stopSession,
  type LiveSession,
} from "../utils/live-share";

type LiveShareValue = {
  session: LiveSession | null;
  remainingMs: number;
  // True when updates keep flowing with the phone locked. False means the
  // app has to stay open (no background permission, or running in Expo Go).
  background: boolean;
  start: (
    coord: Coord,
    accuracy: number | null,
    durationMin: number
  ) => Promise<LiveSession | null>;
  stop: () => Promise<void>;
};

const LiveShareContext = createContext<LiveShareValue | null>(null);

const FOREGROUND_PUSH_EVERY_MS = 5000;

export function LiveShareProvider({ children }: { children: ReactNode }) {
  const { location, accuracy } = useLocation();

  const [session, setSession] = useState<LiveSession | null>(null);
  const [background, setBackground] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const sessionRef = useRef<LiveSession | null>(null);
  const lastPush = useRef(0);

  const adopt = useCallback((s: LiveSession | null) => {
    sessionRef.current = s;
    setSession(s);
    setNow(Date.now());
  }, []);

  const stop = useCallback(async () => {
    adopt(null);
    setBackground(false);
    await stopSession();
  }, [adopt]);

  // Pick up a session that was already running when the app was reopened, and
  // re-check whenever the app comes back to the foreground.
  useEffect(() => {
    let alive = true;
    const restore = async () => {
      const s = await getActiveSession();
      const bg = s ? await backgroundRunning() : false;
      if (!alive) return;
      adopt(s);
      setBackground(bg);
    };
    void restore();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void restore();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [adopt]);

  // Countdown, and stop automatically when time is up.
  useEffect(() => {
    if (!session) return;
    const tick = () => {
      if (Date.now() >= session.expiresAt) void stop();
      else setNow(Date.now());
    };
    tick();
    const t = setInterval(tick, 15_000);
    return () => clearInterval(t);
  }, [session, stop]);

  // While the app is open, push every fresh GPS fix ourselves. This is also
  // what keeps working in Expo Go, where background tracking isn't available.
  useEffect(() => {
    const s = sessionRef.current;
    if (!s || !location) return;
    const t = Date.now();
    if (t - lastPush.current < FOREGROUND_PUSH_EVERY_MS) return;
    lastPush.current = t;
    void pushLocation(s, location, accuracy, t).then((result) => {
      if (result === "over") void stop();
    });
  }, [location, accuracy, stop]);

  const start = useCallback(
    async (coord: Coord, acc: number | null, durationMin: number) => {
      // Pressing SOS twice shouldn't create a second session.
      const existing = sessionRef.current ?? (await getActiveSession());
      if (existing) {
        adopt(existing);
        return existing;
      }
      const created = await createSession(coord, acc, durationMin);
      if (!created) return null;
      lastPush.current = Date.now();
      adopt(created);
      setBackground(await startBackgroundUpdates());
      return created;
    },
    [adopt]
  );

  const remainingMs = session ? Math.max(0, session.expiresAt - now) : 0;

  const value = useMemo<LiveShareValue>(
    () => ({ session, remainingMs, background, start, stop }),
    [session, remainingMs, background, start, stop]
  );

  return <LiveShareContext.Provider value={value}>{children}</LiveShareContext.Provider>;
}

export function useLiveShare(): LiveShareValue {
  const ctx = useContext(LiveShareContext);
  if (!ctx) throw new Error("useLiveShare must be used inside <LiveShareProvider>");
  return ctx;
}
