import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/lib/auth";
import { getMeasurementSystem } from "@/lib/locale-safe";
import { fetchWebUser, updateWebUser } from "@/lib/webApi";
import * as U from "@/lib/units";
import type { DateFormat, DistanceUnit, TempUnit, TimeFormat, WeightUnit } from "@/lib/units";

// Mobile port of the web app's UnitsContext — a single source for the user's
// unit/format prefs plus formatters bound to them, so every screen renders
// distance/elevation/temperature/weight/date/time in the selected units.
//
// Mobile-only addition: a ONE-TIME device-locale default. Web's onboarding
// modal makes the user explicitly pick imperial/metric; mobile has no
// equivalent sign-up flow, so on first load for an account that has never
// made that choice, infer a sensible default from the device's region
// (expo-localization's measurementSystem) instead of silently sitting on the
// server's hardcoded mi/F/lbs. This never runs more than once per device
// install (DEVICE_DEFAULT_KEY guard) and never fires at all if the account's
// units already differ from the untouched schema defaults — so any explicit
// choice, made via web onboarding, web Settings, or mobile Settings, on this
// device or any other, always wins and is never overwritten.

type Prefs = {
  distanceUnit: DistanceUnit;
  tempUnit: TempUnit;
  weightUnit: WeightUnit;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
};

type UnitsCtx = Prefs & {
  fmtMiles: (mi: number) => string;
  fmtElev: (ft: number) => string;
  fmtTemp: (f: number) => string;
  fmtTempRange: (min: number, max: number) => string;
  fmtMileMarker: (mi: number) => string;
  fmtWeight: (lbs: number) => string;
  fmtDate: (dateStr: string) => string;
  fmtTime: (timeStr: string) => string;
  /** Push saved prefs into the context (e.g. from the Settings screen). */
  applyPrefs: (p: Partial<Record<keyof Prefs, string | null | undefined>>) => void;
};

const CACHE_KEY = "units.prefs";
const DEVICE_DEFAULT_KEY = "units.deviceDefaultChecked";

/** Sensible unit triples per expo-localization's measurementSystem. */
const LOCALE_UNIT_DEFAULTS: Record<"us" | "uk" | "metric", { distanceUnit: DistanceUnit; tempUnit: TempUnit; weightUnit: WeightUnit }> = {
  us: { distanceUnit: "mi", tempUnit: "F", weightUnit: "lbs" },
  // UK convention: miles for distance/speed, but Celsius and kilograms otherwise.
  uk: { distanceUnit: "mi", tempUnit: "C", weightUnit: "kg" },
  metric: { distanceUnit: "km", tempUnit: "C", weightUnit: "kg" },
};

function coerceAll(raw: Partial<Record<keyof Prefs, string | null | undefined>>): Prefs {
  return {
    distanceUnit: U.coerceDistanceUnit(raw.distanceUnit),
    tempUnit: U.coerceTempUnit(raw.tempUnit),
    weightUnit: U.coerceWeightUnit(raw.weightUnit),
    dateFormat: U.coerceDateFormat(raw.dateFormat),
    timeFormat: U.coerceTimeFormat(raw.timeFormat),
  };
}

const DEFAULTS: Prefs = coerceAll({});

const Ctx = createContext<UnitsCtx>({
  ...DEFAULTS,
  fmtMiles: (mi) => U.fmtMiles(mi, "mi"),
  fmtElev: (ft) => U.fmtElev(ft, "mi"),
  fmtTemp: (f) => U.fmtTemp(f, "F"),
  fmtTempRange: (min, max) => U.fmtTempRange(min, max, "F"),
  fmtMileMarker: (mi) => U.fmtMileMarker(mi, "mi"),
  fmtWeight: (lbs) => U.fmtWeight(lbs, "lbs"),
  fmtDate: (dateStr) => U.fmtDate(dateStr, "MDY"),
  fmtTime: (timeStr) => U.fmtTime(timeStr, "12h"),
  applyPrefs: () => {},
});

export function useUnits() { return useContext(Ctx); }

export function UnitsProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);

  const applyPrefs = useCallback((raw: Partial<Record<keyof Prefs, string | null | undefined>>) => {
    setPrefs((prev) => {
      const next = coerceAll({ ...prev, ...raw });
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // Instant hydration from the last-known prefs so units don't flash defaults.
  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY)
      .then((v) => { if (v) setPrefs(coerceAll(JSON.parse(v))); })
      .catch(() => {});
  }, []);

  // Authoritative sync from the server whenever the session changes, plus the
  // one-time device-locale default for accounts that have never explicitly
  // chosen units (see file header).
  useEffect(() => {
    if (!token) return;
    fetchWebUser(token)
      .then(async (u) => {
        applyPrefs(u);

        const alreadyChecked = await AsyncStorage.getItem(DEVICE_DEFAULT_KEY);
        if (alreadyChecked) return;
        await AsyncStorage.setItem(DEVICE_DEFAULT_KEY, "1"); // never re-run, whatever happens below

        const isUntouched =
          !u.onboardingComplete && u.distanceUnit === "mi" && u.tempUnit === "F" && u.weightUnit === "lbs";
        if (!isUntouched) return; // an explicit choice already exists somewhere — never overwrite it

        const measurementSystem = getMeasurementSystem();
        const inferred = measurementSystem ? LOCALE_UNIT_DEFAULTS[measurementSystem] : null;
        if (!inferred) return; // device didn't report a region — leave the mi/F/lbs default alone

        applyPrefs(inferred);
        updateWebUser(token, inferred).catch(() => {}); // best-effort — local prefs already updated either way
      })
      .catch(() => {});
  }, [token, applyPrefs]);

  const value = useMemo<UnitsCtx>(() => ({
    ...prefs,
    fmtMiles: (mi) => U.fmtMiles(mi, prefs.distanceUnit),
    fmtElev: (ft) => U.fmtElev(ft, prefs.distanceUnit),
    fmtTemp: (f) => U.fmtTemp(f, prefs.tempUnit),
    fmtTempRange: (min, max) => U.fmtTempRange(min, max, prefs.tempUnit),
    fmtMileMarker: (mi) => U.fmtMileMarker(mi, prefs.distanceUnit),
    fmtWeight: (lbs) => U.fmtWeight(lbs, prefs.weightUnit),
    fmtDate: (dateStr) => U.fmtDate(dateStr, prefs.dateFormat),
    fmtTime: (timeStr) => U.fmtTime(timeStr, prefs.timeFormat),
    applyPrefs,
  }), [prefs, applyPrefs]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
