import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { tripStore, type GpsSessionRow } from "@/db";
import { API_URL } from "./api";

// Power modes per docs §5.4 — interval seconds / distance filter metres.
export const GPS_MODES = {
  standard: { label: "Standard", intervalS: 60, distanceM: 5, battery: "≤5%/day" },
  low: { label: "Low Power", intervalS: 150, distanceM: 5, battery: "≤2%/day" },
  extraLow: { label: "Extra Low", intervalS: 300, distanceM: 10, battery: "≤1%/day" },
  superLow: { label: "Super Low", intervalS: 600, distanceM: 15, battery: "<1%/day" },
} as const;
export type GpsMode = keyof typeof GPS_MODES;

const TASK_NAME = "trail-tracker-gps";

async function recordLocations(locations: Location.LocationObject[]): Promise<void> {
  if (locations.length === 0) return;
  await tripStore.init();
  const active = await tripStore.gpsActiveSession();
  if (!active) return;
  await tripStore.gpsAddPoints(
    active.id,
    locations.map((loc) => ({
      timestamp: loc.timestamp,
      lat: loc.coords.latitude,
      lon: loc.coords.longitude,
      alt: loc.coords.altitude ?? null,
    }))
  );
}

// Background task must be defined at module scope. It runs headlessly after
// app kill on Android — session continuity comes from gpsActiveSession().
if (Platform.OS !== "web") {
  TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
    if (error || !data) return;
    const { locations } = data as { locations: Location.LocationObject[] };
    try {
      await recordLocations(locations);
    } catch {
      // Never throw from the background task
    }
  });
}

// Foreground fallback (Expo Go / web, where background tasks are unavailable)
let foregroundWatch: Location.LocationSubscription | null = null;

export type TrackingStartResult = { sessionId: string; background: boolean };

export async function startTracking(
  mode: GpsMode,
  sectionId: string | null
): Promise<TrackingStartResult> {
  const config = GPS_MODES[mode];

  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") throw new Error("Location permission denied");

  await tripStore.init();
  const existing = await tripStore.gpsActiveSession();
  if (existing) await tripStore.gpsEndSession(existing.id);

  const sessionId = `gps_${Crypto.randomUUID()}`;
  await tripStore.gpsStartSession({ id: sessionId, mode, sectionId });

  const options: Location.LocationTaskOptions = {
    accuracy:
      mode === "standard" ? Location.Accuracy.High : Location.Accuracy.Balanced,
    timeInterval: config.intervalS * 1000,
    distanceInterval: config.distanceM,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Trail Tracker is recording your hike",
      notificationBody: `${config.label} mode — every ${Math.round(config.intervalS / 60 * 10) / 10} min`,
      notificationColor: "#2D6A4F",
    },
  };

  // Prefer true background tracking; fall back to a foreground watch where
  // background isn't possible (web, Expo Go, or permission declined).
  let background = false;
  if (Platform.OS !== "web") {
    try {
      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status === "granted") {
        await Location.startLocationUpdatesAsync(TASK_NAME, options);
        background = true;
      }
    } catch {
      background = false;
    }
  }

  if (!background) {
    foregroundWatch = await Location.watchPositionAsync(
      {
        accuracy: options.accuracy,
        timeInterval: options.timeInterval,
        distanceInterval: options.distanceInterval,
      },
      (loc) => void recordLocations([loc])
    );
  }

  return { sessionId, background };
}

export async function stopTracking(): Promise<void> {
  if (foregroundWatch) {
    foregroundWatch.remove();
    foregroundWatch = null;
  }
  if (Platform.OS !== "web") {
    try {
      if (await Location.hasStartedLocationUpdatesAsync(TASK_NAME)) {
        await Location.stopLocationUpdatesAsync(TASK_NAME);
      }
    } catch {
      // Task never registered (Expo Go) — nothing to stop
    }
  }
  await tripStore.init();
  const active = await tripStore.gpsActiveSession();
  if (active) await tripStore.gpsEndSession(active.id);
}

export async function isTracking(): Promise<GpsSessionRow | null> {
  await tripStore.init();
  return tripStore.gpsActiveSession();
}

/**
 * Batch-upload sessions with unsynced points. Sends each session's complete
 * point list — the server upserts by sessionKey, so re-uploads are
 * idempotent (docs F8 "batch sync on reconnect").
 */
export async function syncGpsSessions(
  token: string | null,
  shareLocation = true
): Promise<{ sessions: number; points: number }> {
  if (!token) return { sessions: 0, points: 0 };
  await tripStore.init();
  const sessions = await tripStore.gpsListSessions(20);
  let synced = 0;
  let points = 0;
  for (const s of sessions) {
    if (s.synced || s.pointCount === 0) continue;
    const pts = await tripStore.gpsSessionPoints(s.id);
    const res = await fetch(`${API_URL}/api/mobile/gps-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        sessionId: s.id,
        sectionId: s.sectionId,
        trailKey: "at",
        startedAt: s.startedAt,
        points: pts,
        shareLocation,
      }),
    });
    if (res.ok) {
      await tripStore.gpsMarkSynced(s.id);
      synced++;
      points += pts.length;
    }
  }
  return { sessions: synced, points };
}
