import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";

import { apiFetch } from "./api";

const TOKEN_KEY = "auth.token";

// SecureStore has no web implementation — fall back to AsyncStorage there
// (web is only used for design previews, never as the shipped client).
const tokenStore =
  Platform.OS === "web"
    ? {
        get: () => AsyncStorage.getItem(TOKEN_KEY),
        set: (value: string) => AsyncStorage.setItem(TOKEN_KEY, value),
        remove: () => AsyncStorage.removeItem(TOKEN_KEY),
      }
    : {
        get: () => SecureStore.getItemAsync(TOKEN_KEY),
        set: (value: string) => SecureStore.setItemAsync(TOKEN_KEY, value),
        remove: () => SecureStore.deleteItemAsync(TOKEN_KEY),
      };

export type MobileUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

export type MeResponse = {
  user: MobileUser & {
    trailName: string | null;
    shareSlug: string | null;
    subscriptionTier: string;
    subscriptionStatus: string;
    subscriptionExpiresAt: string | null;
    isAdmin: boolean;
    distanceUnit: string;
    tempUnit: string;
    hikeDirection: string;
    activeTrailId: string | null;
  };
  trail: {
    id: string;
    catalogKey: string;
    displayName: string;
    shortName: string;
    totalMiles: number;
    hikeDirection: string;
  } | null;
  stats: {
    milesCompleted: number;
    milesPlanned: number;
    sectionsCompleted: number;
    sectionsPlanned: number;
    elevGainCompleted: number;
    trailMiles: number;
    percentComplete: number;
  };
};

type AuthContextValue = {
  token: string | null;
  user: MobileUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string, twoFactorCode?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<MobileUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await tokenStore.get();
        if (stored) setToken(stored);
      } catch {
        // Unreadable token store — treat as signed out
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string, twoFactorCode?: string) => {
    const res = await apiFetch<{ token: string; user: MobileUser }>("/api/mobile/login", {
      method: "POST",
      body: { email, password, twoFactorCode },
    });
    await tokenStore.set(res.token);
    setUser(res.user);
    setToken(res.token);
  }, []);

  const signOut = useCallback(async () => {
    await tokenStore.remove();
    // Entitlement is account-scoped — drop it with the session
    const { clearEntitlement } = await import("./entitlement");
    await clearEntitlement();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ token, user, isLoading, signIn, signOut }),
    [token, user, isLoading, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
