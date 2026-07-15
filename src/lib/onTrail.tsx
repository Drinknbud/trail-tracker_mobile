import AsyncStorage from "@react-native-async-storage/async-storage";
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

import { useAuth } from "./auth";
import { isTracking, stopTracking } from "./gps";
import { fetchWebUser, updateWebUser } from "./webApi";

const KEY = "prefs.onTrailMode";

// On Trail mode drives the adaptive tab bar (category dock at home ↔ flat
// field bar on trail), so it needs an offline-safe client source of truth —
// the bar must be correct in airplane mode. Hydrates from AsyncStorage
// instantly, refreshes once from the server per cold start, and toggles are
// optimistic: the local value wins immediately, the PATCH is best-effort.
//
// Turning ON goes through an activation ceremony (OnTrailActivationSheet —
// section pick, GPS mode, briefing sync; mirrors web's OnTrailActivationModal):
// callers use requestOnTrail() and the sheet calls completeActivation() after
// its own PATCH. Turning OFF is instant and stops any active GPS session.

interface OnTrailContextValue {
  onTrail: boolean;
  /** Open the activation sheet (turning ON always goes through the ceremony). */
  requestOnTrail: () => void;
  /** Instant off: updates the bar + cache now, PATCHes best-effort, stops GPS. */
  setOnTrail: (value: boolean) => void;
  /** Adopt a value the server already accepted (activation sheet, Settings save). */
  applyServerValue: (value: boolean) => void;
  /** Activation sheet wiring. */
  activationVisible: boolean;
  cancelActivation: () => void;
}

const OnTrailContext = createContext<OnTrailContextValue>({
  onTrail: false,
  requestOnTrail: () => {},
  setOnTrail: () => {},
  applyServerValue: () => {},
  activationVisible: false,
  cancelActivation: () => {},
});

export function OnTrailProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [onTrail, setOnTrailState] = useState(false);
  const [activationVisible, setActivationVisible] = useState(false);
  // Once the user toggles locally, the cold-start server refresh must not
  // clobber their choice (it may still be in flight or have failed offline).
  const userTouched = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await AsyncStorage.getItem(KEY);
      if (!cancelled && cached !== null && !userTouched.current) {
        setOnTrailState(cached === "1");
      }
      if (!token) return;
      try {
        const user = await fetchWebUser(token);
        if (!cancelled && !userTouched.current) {
          setOnTrailState(user.onTrailMode);
          await AsyncStorage.setItem(KEY, user.onTrailMode ? "1" : "0");
        }
      } catch {
        // Offline — cached value stands
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const setOnTrail = useCallback(
    (value: boolean) => {
      userTouched.current = true;
      setOnTrailState(value);
      void AsyncStorage.setItem(KEY, value ? "1" : "0");
      if (token) {
        updateWebUser(token, { onTrailMode: value }).catch(() => {
          // Offline — local value stands; reconciles next online cold start
        });
      }
      if (!value) {
        // Trip's over — stop recording if a GPS session is running
        void (async () => {
          try {
            if (await isTracking()) await stopTracking();
          } catch {
            // Best-effort
          }
        })();
      }
    },
    [token],
  );

  const applyServerValue = useCallback((value: boolean) => {
    userTouched.current = true;
    setOnTrailState(value);
    void AsyncStorage.setItem(KEY, value ? "1" : "0");
  }, []);

  const requestOnTrail = useCallback(() => setActivationVisible(true), []);
  const cancelActivation = useCallback(() => setActivationVisible(false), []);

  const value = useMemo(
    () => ({
      onTrail,
      requestOnTrail,
      setOnTrail,
      applyServerValue,
      activationVisible,
      cancelActivation,
    }),
    [onTrail, requestOnTrail, setOnTrail, applyServerValue, activationVisible, cancelActivation],
  );

  return <OnTrailContext.Provider value={value}>{children}</OnTrailContext.Provider>;
}

export function useOnTrail(): OnTrailContextValue {
  return useContext(OnTrailContext);
}
