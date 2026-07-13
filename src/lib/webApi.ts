import { apiFetch } from "./api";

// These mirror the web app's own /api/stats, /api/user, /api/trails routes
// (now bearer-token enabled) so the mobile dashboard reuses the exact same
// stats logic instead of re-deriving a subset of it.

export type WebStats = {
  milesCompleted: number;
  milesPlanned: number;
  percentComplete: number;
  totalMiles: number;
  trailName: string;
  trailShortName: string;
  trailCatalogKey: string;
  startPoint: string;
  endPoint: string;
  trailCompleted: boolean;
  sectionsCompleted: number;
  sectionsPlanned: number;
  elevGainTotal: number;
  avgPaceMilesPerDay: number | null;
  recentSection: { name: string; miles: number; endDate?: string } | null;
  nextPlannedSection: { name: string; miles: number; startDate?: string } | null;
  milesRemaining: number;
  milesThisYear: number;
};

export type WebUser = {
  id: string;
  name: string | null;
  email: string;
  bio: string | null;
  trailName: string | null;
  heroImage: string | null;
  heroImagePosition: string | null;
  accentColor: string | null;
  homeZip: string | null;
  carrierProvider: string | null;
  distanceUnit: string;
  tempUnit: string;
  weightUnit: string;
  dateFormat: string;
  timeFormat: string;
  shareSlug: string | null;
  gpsTrackingEnabled: boolean;
  gpsPowerMode: string | null;
  onTrailMode: boolean;
  daysAheadForBriefings: number | null;
  shareShowPhotos: boolean;
  shareShowDayLogs: boolean;
  shareShowNightLogs: boolean;
  shareShowNotes: boolean;
  shareShowLocation: boolean;
  twoFactorEnabled: boolean;
  subscriptionStatus: string | null;
  subscriptionTier: string;
  hasStripeSubscription: boolean;
  trialUsed: boolean;
  typicalDailyMiles: number | null;
  hikingSpeedMph: number | null;
};

// Partial update — same shape PATCH /api/user accepts (a subset is fine,
// only provided keys are written).
export type WebUserUpdate = Partial<
  Omit<WebUser, "id" | "email" | "shareSlug" | "twoFactorEnabled" | "subscriptionStatus" | "subscriptionTier" | "hasStripeSubscription" | "trialUsed">
>;

export async function updateWebUser(token: string, patch: WebUserUpdate): Promise<WebUser> {
  return apiFetch<WebUser>("/api/user", { method: "PATCH", token, body: patch });
}

export async function generateShareSlug(token: string): Promise<{ shareSlug: string }> {
  return apiFetch<{ shareSlug: string }>("/api/user/share-slug", { method: "POST", token });
}

export type WebTrail = {
  id: string;
  catalogKey: string;
  displayName: string;
  shortName: string;
  totalMiles: number;
  hikeDirection: string;
  isActive: boolean;
  plannedCompletionDate: string | null;
};

export async function fetchStats(token: string): Promise<WebStats> {
  return apiFetch<WebStats>("/api/stats", { token });
}

export async function fetchWebUser(token: string): Promise<WebUser> {
  return apiFetch<WebUser>("/api/user", { token });
}

export async function fetchTrails(token: string): Promise<WebTrail[]> {
  return apiFetch<WebTrail[]>("/api/trails", { token });
}

// Two-factor authentication (TOTP) — same endpoints as the web Security tab.
export async function start2faSetup(
  token: string
): Promise<{ secret: string; qrCodeDataUrl: string }> {
  return apiFetch("/api/user/2fa/setup", { method: "POST", token });
}

export async function verify2fa(token: string, code: string, secret: string): Promise<void> {
  await apiFetch("/api/user/2fa/verify", { method: "POST", token, body: { code, secret } });
}

export async function disable2fa(token: string, code: string): Promise<void> {
  await apiFetch("/api/user/2fa/disable", { method: "POST", token, body: { code } });
}
