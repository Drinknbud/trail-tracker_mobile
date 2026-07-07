import { storage } from "./storage";

// Device-local preferences (not synced): briefing notification hour and
// the GPS share-location opt-out.
const BRIEFING_HOUR_KEY = "prefs.briefingHour";
const SHARE_LOCATION_KEY = "prefs.shareLocation";

export const DEFAULT_BRIEFING_HOUR = 7;

export async function getBriefingHour(): Promise<number> {
  const raw = await storage.get(BRIEFING_HOUR_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= 12 ? n : DEFAULT_BRIEFING_HOUR;
}

export async function setBriefingHour(hour: number): Promise<void> {
  await storage.set(BRIEFING_HOUR_KEY, String(hour));
}

export async function getShareLocation(): Promise<boolean> {
  return (await storage.get(SHARE_LOCATION_KEY)) !== "false";
}

export async function setShareLocation(value: boolean): Promise<void> {
  await storage.set(SHARE_LOCATION_KEY, value ? "true" : "false");
}
