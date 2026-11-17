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
import { clearIdentity, loadIdentity, type StoredIdentity } from "../utils/identity";
import {
  fetchMe,
  logIn as apiLogIn,
  logOut as apiLogOut,
  signUp as apiSignUp,
  type SignupInput,
} from "../utils/auth";
import { setUnauthorizedHandler } from "../utils/trust";

type Status = "loading" | "signedOut" | "signedIn";

type AuthValue = {
  status: Status;
  identity: StoredIdentity | null;
  // These return an error message to show, or null on success.
  signUp: (input: SignupInput) => Promise<string | null>;
  logIn: (email: string, password: string) => Promise<string | null>;
  logOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [identity, setIdentity] = useState<StoredIdentity | null>(null);
  const identityRef = useRef<StoredIdentity | null>(null);

  const apply = useCallback((next: StoredIdentity | null) => {
    identityRef.current = next;
    setIdentity(next);
    setStatus(next ? "signedIn" : "signedOut");
  }, []);

  // The login ran out, or was ended on another device. Local data is kept so
  // logging back in picks up where the person left off.
  const expire = useCallback(async () => {
    if (!identityRef.current) return;
    await clearIdentity();
    apply(null);
  }, [apply]);

  // On launch: pick up a saved login, then quietly check it still works.
  // Being offline never logs anyone out.
  useEffect(() => {
    let alive = true;
    (async () => {
      const saved = await loadIdentity();
      if (!alive) return;
      apply(saved);
      if (!saved) return;
      const me = await fetchMe(saved);
      if (alive && me.kind === "unauthorized") await expire();
    })();
    return () => {
      alive = false;
    };
  }, [apply, expire]);

  // Any request the server answers with "please log in again" ends the session.
  useEffect(() => {
    setUnauthorizedHandler(() => void expire());
    return () => setUnauthorizedHandler(null);
  }, [expire]);

  const signUp = useCallback(
    async (input: SignupInput) => {
      const r = await apiSignUp(input);
      if (!r.ok) return r.error;
      apply(r.identity);
      return null;
    },
    [apply]
  );

  const logIn = useCallback(
    async (email: string, password: string) => {
      const r = await apiLogIn(email, password);
      if (!r.ok) return r.error;
      apply(r.identity);
      return null;
    },
    [apply]
  );

  const logOut = useCallback(async () => {
    const current = identityRef.current;
    // Forget the login on this phone FIRST. It is instant, and it means that
    // even if the app is closed right now, the person stays logged out.
    await clearIdentity();
    apply(null); // leave the app screens
    await apiLogOut(current); // then tell the server and stop live sharing
  }, [apply]);

  const value = useMemo<AuthValue>(
    () => ({ status, identity, signUp, logIn, logOut }),
    [status, identity, signUp, logIn, logOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
