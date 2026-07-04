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

import { apiFetch } from "./api";

const TOKEN_KEY = "auth.token";

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
        const stored = await SecureStore.getItemAsync(TOKEN_KEY);
        if (stored) setToken(stored);
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
    await SecureStore.setItemAsync(TOKEN_KEY, res.token);
    setUser(res.user);
    setToken(res.token);
  }, []);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
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
