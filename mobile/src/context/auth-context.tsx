import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import {
  TouristProfile,
  getTouristProfile,
  registerNewTouristIdentity,
  NewTouristInput,
} from "../utils/blockchain";

WebBrowser.maybeCompleteAuthSession();

export const GOOGLE_CONFIG = {
  clientId:
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
    "350849533351-7n53u551sk94lclc8jp512q5ev2nhrdm.apps.googleusercontent.com",
};

export const getGoogleAuthUrl = (origin?: string) => {
  const redirectUri =
    origin ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:8081");
  const scope = encodeURIComponent("openid email profile");
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CONFIG.clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=token&scope=${scope}&prompt=select_account`;
};

export interface UserSession {
  email: string;
  name: string;
  picture?: string;
  authProvider: "google" | "tourist_credentials";
  idToken?: string;
}

interface AuthContextType {
  session: UserSession | null;
  profile: TouristProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  signInWithGoogle: (mode?: "login" | "register") => Promise<{ success: boolean; isReturningUser: boolean }>;
  signInWithGoogleAccount: (account: { name: string; email: string; picture?: string }) => Promise<void>;
  redirectToGoogleAuth: () => void;
  loginWithCredentials: (email: string, passwordOrPin?: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithCredentials: (email: string, name: string) => Promise<void>;
  completeOnboarding: (details: Omit<NewTouristInput, "email" | "authProvider">) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AUTH_STORAGE_KEY = "@tourist_auth_session_v1";
const ONBOARDED_STORAGE_KEY = "@tourist_onboarded_flag_v1";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(null);
  const [profile, setProfile] = useState<TouristProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);

  useEffect(() => {
    const init = async () => {
      const handled = await handleGoogleRedirectCallback();
      if (!handled) {
        await loadStoredSession();
      }
    };
    init();

    // Listen for cross-window messages when popup succeeds
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === "GOOGLE_OAUTH_RESPONSE" && event.data?.query) {
          await processOAuthQuery(event.data.query);
        }
      };
      window.addEventListener("message", handleMessage);
      return () => window.removeEventListener("message", handleMessage);
    }
  }, []);

  const processOAuthQuery = async (query: string): Promise<UserSession | null> => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams(query);
      const accessToken = params.get("access_token");

      if (accessToken) {
        const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await userRes.json();

        if (data && data.email) {
          const googleUser: UserSession = {
            email: data.email,
            name: data.name || data.given_name || "Google Traveler",
            picture: data.picture,
            authProvider: "google",
          };

          await saveSession(googleUser);

          const existingProfileRaw = await AsyncStorage.getItem("@tourist_profile_v1");
          if (existingProfileRaw) {
            const p = JSON.parse(existingProfileRaw);
            p.fullName = googleUser.name;
            await AsyncStorage.setItem("@tourist_profile_v1", JSON.stringify(p));
            setProfile(p);
          } else {
            const newProfile = await registerNewTouristIdentity({
              fullName: googleUser.name,
              nationality: "Indian",
              passportNumber: "Z" + Math.floor(1000000 + Math.random() * 9000000) + "K",
              dateOfBirth: "2000-01-01",
              bloodGroup: "O+",
              allergies: "None Reported",
              emergencyPhone: "+91 98765 43210",
              email: googleUser.email,
              authProvider: "google",
            });
            setProfile(newProfile);
          }

          setIsOnboarded(true);
          await AsyncStorage.setItem(ONBOARDED_STORAGE_KEY, "true");
          return googleUser;
        }
      }
    } catch (e) {
      console.error("Failed to parse Google OAuth callback:", e);
    } finally {
      setIsLoading(false);
    }
    return null;
  };

  const handleGoogleRedirectCallback = async (): Promise<boolean> => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      const fullQuery = hash.replace(/^#/, "") || search.replace(/^\?/, "");

      if (fullQuery && (fullQuery.includes("access_token=") || fullQuery.includes("id_token="))) {
        // If this page was opened inside a popup window:
        if (window.opener && window.opener !== window) {
          try {
            window.opener.postMessage(
              { type: "GOOGLE_OAUTH_RESPONSE", query: fullQuery },
              window.location.origin
            );
            window.close();
            return true;
          } catch (e) {
            console.warn("Could not postMessage to opener:", e);
          }
        }

        // Full page redirect flow
        const user = await processOAuthQuery(fullQuery);
        if (user) {
          // Clean address bar URL
          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, "", window.location.pathname);
          }
          return true;
        }
      }
    }
    return false;
  };

  const loadStoredSession = async () => {
    try {
      const storedSession = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      const onboardedFlag = await AsyncStorage.getItem(ONBOARDED_STORAGE_KEY);

      if (storedSession && onboardedFlag === "true") {
        const parsedSession = JSON.parse(storedSession);
        setSession(parsedSession);
        setIsOnboarded(true);
        const p = await getTouristProfile();
        setProfile(p);
      } else if (storedSession) {
        setSession(JSON.parse(storedSession));
        setIsOnboarded(false);
      } else {
        setSession(null);
        setIsOnboarded(false);
      }
    } catch (e) {
      console.error("Error loading auth session:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const redirectToGoogleAuth = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.assign(getGoogleAuthUrl());
    }
  };

  const signInWithGoogle = async (
    mode: "login" | "register" = "login"
  ): Promise<{ success: boolean; isReturningUser: boolean }> => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const authUrl = getGoogleAuthUrl();

      // Open Google Account Chooser popup centered on screen
      const width = 520;
      const height = 650;
      const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
      const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);

      const popup = window.open(
        authUrl,
        "google_account_chooser",
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );

      // If browser blocked the popup, fallback immediately to direct full-page redirect
      if (!popup || popup.closed || typeof popup.closed === "undefined") {
        window.location.assign(authUrl);
        return { success: true, isReturningUser: false };
      }

      // Return a Promise that resolves when the popup completes or is closed
      return new Promise((resolve) => {
        let checkTimer: any = null;
        let resolved = false;

        const safeResolve = (val: { success: boolean; isReturningUser: boolean }) => {
          if (resolved) return;
          resolved = true;
          if (checkTimer) clearInterval(checkTimer);
          window.removeEventListener("message", onMessage);
          resolve(val);
        };

        const onMessage = async (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          if (event.data?.type === "GOOGLE_OAUTH_RESPONSE" && event.data?.query) {
            const user = await processOAuthQuery(event.data.query);
            if (user) {
              const existingProfile = await AsyncStorage.getItem("@tourist_profile_v1");
              safeResolve({ success: true, isReturningUser: !!existingProfile });
            } else {
              safeResolve({ success: false, isReturningUser: false });
            }
          }
        };

        window.addEventListener("message", onMessage);

        checkTimer = setInterval(async () => {
          try {
            if (!popup || popup.closed) {
              safeResolve({ success: false, isReturningUser: false });
              return;
            }

            // Polling backup for when the popup returns to our origin
            const currentHref = popup.location.href;
            if (
              currentHref &&
              (currentHref.includes("access_token=") ||
                currentHref.includes("id_token="))
            ) {
              const hash = popup.location.hash || popup.location.search;
              popup.close();
              const user = await processOAuthQuery(hash.replace(/^[#?]/, ""));
              if (user) {
                const existingProfile = await AsyncStorage.getItem("@tourist_profile_v1");
                safeResolve({ success: true, isReturningUser: !!existingProfile });
              } else {
                safeResolve({ success: false, isReturningUser: false });
              }
            }
          } catch {
            // Normal cross-origin exception while popup is browsing accounts.google.com
          }
        }, 500);
      });
    } else {
      // Native implementation for Expo Go (Android & iOS)
      try {
        setIsLoading(true);
        const redirectUri = "http://localhost:8081";
        const authUrl = getGoogleAuthUrl(redirectUri);

        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri, {
          preferEphemeralSession: false,
          showInRecents: true,
        });

        if (result.type === "success" && result.url) {
          const urlParts = result.url.split("#");
          const query = urlParts[1] || result.url.split("?")[1] || "";

          const user = await processOAuthQuery(query);
          if (user) {
            const existingProfile = await AsyncStorage.getItem("@tourist_profile_v1");
            return { success: true, isReturningUser: !!existingProfile };
          }
        }
        return { success: false, isReturningUser: false };
      } catch (err) {
        console.error("Native Google sign-in error in Expo Go:", err);
        return { success: false, isReturningUser: false };
      } finally {
        setIsLoading(false);
      }
    }
  };

  const signInWithGoogleAccount = async (account: {
    name: string;
    email: string;
    picture?: string;
  }) => {
    setIsLoading(true);
    try {
      const googleUser: UserSession = {
        email: account.email.trim(),
        name: account.name.trim() || "Google Traveler",
        picture: account.picture,
        authProvider: "google",
      };

      await saveSession(googleUser);

      const existingProfileRaw = await AsyncStorage.getItem("@tourist_profile_v1");
      if (existingProfileRaw) {
        const p = JSON.parse(existingProfileRaw);
        p.fullName = googleUser.name;
        await AsyncStorage.setItem("@tourist_profile_v1", JSON.stringify(p));
        setProfile(p);
      } else {
        const newProfile = await registerNewTouristIdentity({
          fullName: googleUser.name,
          nationality: "Indian",
          passportNumber: "Z" + Math.floor(1000000 + Math.random() * 9000000) + "K",
          dateOfBirth: "2000-01-01",
          bloodGroup: "O+",
          allergies: "None Reported",
          emergencyPhone: "+91 98765 43210",
          email: googleUser.email,
          authProvider: "google",
        });
        setProfile(newProfile);
      }

      setIsOnboarded(true);
      await AsyncStorage.setItem(ONBOARDED_STORAGE_KEY, "true");
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithCredentials = async (
    email: string,
    passwordOrPin?: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const cleanEmail = email.trim();
      const existingProfileRaw = await AsyncStorage.getItem("@tourist_profile_v1");

      const sessionData: UserSession = {
        email: cleanEmail,
        name: cleanEmail.split("@")[0] || "Tourist Traveler",
        authProvider: "tourist_credentials",
      };

      await saveSession(sessionData);

      if (existingProfileRaw) {
        const p = JSON.parse(existingProfileRaw);
        setProfile(p);
      } else {
        const newProfile = await registerNewTouristIdentity({
          fullName: sessionData.name,
          nationality: "Indian",
          passportNumber: "Z" + Math.floor(1000000 + Math.random() * 9000000) + "K",
          dateOfBirth: "2000-01-01",
          bloodGroup: "O+",
          allergies: "None Reported",
          emergencyPhone: "+91 98765 43210",
          email: sessionData.email,
          authProvider: "tourist_credentials",
        });
        setProfile(newProfile);
      }
      setIsOnboarded(true);
      await AsyncStorage.setItem(ONBOARDED_STORAGE_KEY, "true");
      return { success: true };
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithCredentials = async (email: string, name: string) => {
    const newSession: UserSession = {
      email: email.trim(),
      name: name.trim() || "Tourist Traveler",
      authProvider: "tourist_credentials",
    };
    await saveSession(newSession);
    setIsOnboarded(false);
  };

  const saveSession = async (userSession: UserSession) => {
    setSession(userSession);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userSession));
  };

  const completeOnboarding = async (
    details: Omit<NewTouristInput, "email" | "authProvider">
  ) => {
    setIsLoading(true);
    try {
      const input: NewTouristInput = {
        ...details,
        email: session?.email || "tourist@safetyapp.io",
        authProvider: session?.authProvider || "tourist_credentials",
      };

      const newProfile = await registerNewTouristIdentity(input);
      setProfile(newProfile);
      setIsOnboarded(true);
      await AsyncStorage.setItem(ONBOARDED_STORAGE_KEY, "true");
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      await AsyncStorage.removeItem(ONBOARDED_STORAGE_KEY);
      await AsyncStorage.removeItem("@tourist_profile_v1");
      setSession(null);
      setIsOnboarded(false);
      setProfile(null);

      if (Platform.OS === "web" && typeof window !== "undefined") {
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, "", window.location.pathname);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    const p = await getTouristProfile();
    setProfile(p);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        isLoading,
        isAuthenticated: !!session,
        isOnboarded,
        signInWithGoogle,
        signInWithGoogleAccount,
        redirectToGoogleAuth,
        loginWithCredentials,
        signUpWithCredentials,
        completeOnboarding,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
