import type { TrailAlertRow } from "@/db";

import { API_URL, apiFetch } from "./api";

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
  sectionsThisYear: number;
  daysOnTrailThisYear: number;
  milesThisMonth: number;
  sectionsThisMonth: number;
  daysOnTrailThisMonth: number;
  milesThisWeek: number;
  sectionsThisWeek: number;
  /** Cosmetic-unlock gate for avatar/hero-image/accent-color (see BADGE_UNLOCKS). */
  earnedBadgeCount: number;
  // Gamification extras — drive the Accomplishments screen's badge grid.
  photoCount: number;
  poiCount: number;
  conditionReportCount: number;
  communityContributions: number;
  beatClockCount: number;
  minPackWeight: number | null;
  packWeightLogged: boolean;
  atRegionCoverage?: Record<string, number>;
  trailsStarted?: number;
  trailsCompleted?: number;
  hasTripleCrown?: boolean;
};

export type WebUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  bio: string | null;
  trailName: string | null;
  heroImage: string | null;
  heroImagePosition: string | null;
  accentColor: string | null;
  mapStyle: string | null;
  homeZip: string | null;
  carrierProvider: string | null;
  distanceUnit: string;
  tempUnit: string;
  weightUnit: string;
  dateFormat: string;
  timeFormat: string;
  /** False until the user (web onboarding or Settings) has explicitly chosen units — see units-context.tsx's one-time device-locale default. */
  onboardingComplete: boolean;
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

// Cosmetic features unlock via earned badge milestones, or automatically for
// Premium (mirrors BADGE_UNLOCKS in app/settings/page.tsx).
export const BADGE_UNLOCKS = { avatar: 5, heroImage: 10, accentColor: 15 } as const;

export async function uploadAvatar(token: string, dataUrl: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>("/api/user/avatar", { method: "POST", token, body: { dataUrl } });
}

export async function uploadHeroImage(token: string, dataUrl: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>("/api/user/hero-image", { method: "POST", token, body: { dataUrl } });
}

export type MyPhoto = { id: string; storageUrl: string | null; baseUrl: string; thumbnailUrl: string };

export async function fetchMyPhotos(token: string): Promise<MyPhoto[]> {
  return apiFetch<MyPhoto[]>("/api/photos", { token });
}

// Geo-tagged photo shape for the map's Photos layer — same /api/photos payload,
// but including the position + trail fields web's TrailMap uses to place markers
// (GPS coords, or the section mile range as a fallback when GPS is absent).
export type MapPhoto = {
  id: string;
  baseUrl: string;
  thumbnailUrl: string;
  lat: number | null;
  lng: number | null;
  takenAt: string | null;
  trailKey: string | null;
  sectionStartMile: number | null;
  sectionEndMile: number | null;
};

export async function fetchMapPhotos(token: string): Promise<MapPhoto[]> {
  return apiFetch<MapPhoto[]>("/api/photos", { token });
}

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
  startPoint: string;
  endPoint: string;
  completedAt: string | null;
  completedMiles: number;
  sectionCount: number;
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

export async function fetchAlerts(token: string, trailKey = "at"): Promise<TrailAlertRow[]> {
  const res = await apiFetch<{ alerts: TrailAlertRow[] }>(
    `/api/mobile/alerts?trailKey=${encodeURIComponent(trailKey)}`,
    { token }
  );
  return res.alerts;
}

export async function addTrail(token: string, catalogKey: string): Promise<WebTrail> {
  return apiFetch<WebTrail>("/api/trails", { method: "POST", token, body: { catalogKey } });
}

export async function activateTrail(token: string, trailId: string): Promise<void> {
  await apiFetch(`/api/trails/${trailId}/activate`, { method: "PATCH", token });
}

export async function deleteTrail(token: string, trailId: string): Promise<void> {
  await apiFetch(`/api/trails/${trailId}`, { method: "DELETE", token });
}

export async function toggleTrailComplete(
  token: string,
  trailId: string
): Promise<{ completedAt: string | null }> {
  return apiFetch(`/api/trails/${trailId}/complete`, { method: "PATCH", token });
}

export async function updateTrailDirection(
  token: string,
  trailId: string,
  hikeDirection: string
): Promise<void> {
  await apiFetch(`/api/trails/${trailId}`, { method: "PATCH", token, body: { hikeDirection } });
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

// Accomplishments — personal goals ("challenges") and system-challenge claims.
// Same endpoints/shapes as the web Accomplishments page.

export type UserChallenge = {
  id: string;
  title: string;
  targetType: "miles" | "sections" | "days" | "custom";
  targetValue: number | null;
  deadline: string | null;
  status: "active" | "completed" | "abandoned";
  completedAt: string | null;
  createdAt: string;
};

export type ChallengeCompletion = {
  id: string;
  challengeKey: string;
  title: string;
  completedAt: string;
  metadata: string | null;
};

export async function fetchChallenges(token: string): Promise<UserChallenge[]> {
  return apiFetch<UserChallenge[]>("/api/challenges", { token });
}

export async function createChallenge(
  token: string,
  input: { title: string; targetType: UserChallenge["targetType"]; targetValue?: number | null; deadline?: string | null }
): Promise<UserChallenge> {
  return apiFetch<UserChallenge>("/api/challenges", { method: "POST", token, body: input });
}

export async function completeChallenge(token: string, id: string): Promise<UserChallenge> {
  return apiFetch<UserChallenge>(`/api/challenges/${id}`, { method: "PATCH", token, body: { status: "completed" } });
}

export async function deleteChallenge(token: string, id: string): Promise<void> {
  await apiFetch(`/api/challenges/${id}`, { method: "DELETE", token });
}

export async function fetchChallengeCompletions(token: string): Promise<ChallengeCompletion[]> {
  return apiFetch<ChallengeCompletion[]>("/api/challenge-completions", { token });
}

export async function claimSystemChallenge(token: string, challengeKey: string): Promise<ChallengeCompletion> {
  return apiFetch<ChallengeCompletion>("/api/challenge-completions", { method: "POST", token, body: { challengeKey } });
}

// Scout trip planner — POST /api/scout/plan returns a server-validated plan:
// every stop resolved against the trail database, every mileage computed from
// official mile markers. The client renders ONLY the canonical plan.

export type PlanStop = {
  name: string;
  mile: number;
  kind: "shelter" | "tentsite" | "developed" | "nps_required" | "dispersed" | "town" | "trailhead";
  approximate: boolean;
};

export type PlanDay = {
  day: number;
  from: PlanStop;
  to: PlanStop;
  miles: number;
  permitRequired: boolean;
  note: string | null;
  warnings: string[];
};

export type CanonicalPlan = {
  name: string;
  direction: "NOBO" | "SOBO";
  start: PlanStop;
  end: PlanStop;
  totalMiles: number;
  days: PlanDay[];
  warnings: string[];
};

export type ScoutTurn = { role: "user" | "assistant"; content: string };

export type ScoutPlanResponse = { note: string; plan: CanonicalPlan | null; violations?: string[] };

export async function scoutPlan(
  token: string,
  input: { message: string; history: ScoutTurn[]; plan: CanonicalPlan | null }
): Promise<ScoutPlanResponse> {
  return apiFetch<ScoutPlanResponse>("/api/scout/plan", { method: "POST", token, body: input });
}

export async function createSection(
  token: string,
  input: {
    /** Client-generated id — lets a retry after a dropped response (or an
     * offline-queued write) upsert instead of creating a duplicate section. */
    id?: string;
    name: string;
    status: string;
    startMile: number;
    endMile: number;
    miles: number;
    difficulty?: string;
    startDate?: string;
    endDate?: string;
    notes?: string;
    itinerary?: string;
    plannedCamps?: string[];
    plannedCampMiles?: (number | null)[];
  }
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/api/sections", { method: "POST", token, body: input });
}

// ── Trailheads (manual section entry) ─────────────────────────────────────────
// GET /api/trails/trailheads is public trail data — no bearer token needed.

export type WebTrailhead = {
  id: number;
  name: string;
  type: "parking" | "gap" | "trailhead";
  mile: number;
};

export async function fetchTrailheads(catalogKey: string): Promise<WebTrailhead[]> {
  const { trailheads } = await apiFetch<{ trailheads: WebTrailhead[] }>(
    `/api/trails/trailheads?catalogKey=${encodeURIComponent(catalogKey)}`
  );
  return trailheads;
}

export type LiveElevationProfile = {
  points: { dist: number; elev: number }[];
  coords: [number, number][];
  mapCoords: [number, number][];
  avgElevM: number;
  trailMinElevFt: number | null;
  trailMaxElevFt: number | null;
};

/**
 * Live elevation fetch for a section that hasn't been downloaded yet (no
 * local `elevation_profiles` row) — typically a still-Planning section. No
 * auth required (same public endpoint web's own Section Log/share pages
 * use); needs connectivity, so callers should treat failure as "no profile
 * to show yet" rather than an error.
 */
export async function fetchLiveElevationProfile(params: {
  catalogKey: string;
  startMile: number;
  endMile: number;
  totalMiles: number;
}): Promise<LiveElevationProfile> {
  const qs = new URLSearchParams({
    catalogKey: params.catalogKey,
    startMile: String(params.startMile),
    endMile: String(params.endMile),
    totalMiles: String(params.totalMiles),
  });
  const raw = await apiFetch<LiveElevationProfile & { avgElevM?: number }>(
    `/api/elevation/profile?${qs}`
  );
  return { ...raw, avgElevM: raw.avgElevM ?? 0 };
}

export type LivePoi = { type: string; name: string; mile: number };

// Same 5 curated files + ±2mi buffer as web's offline-package route
// (app/api/sections/[id]/offline-package/route.ts POI_FILES) — served
// directly as public static assets under /data, so no auth needed.
const LIVE_POI_FILES: { suffix: string; type: string }[] = [
  { suffix: "shelters", type: "shelter" },
  { suffix: "campsites", type: "campsite" },
  { suffix: "towns", type: "town" },
  { suffix: "trailheads", type: "trailhead" },
  { suffix: "road-crossings", type: "road-crossing" },
];

/**
 * Live POI fetch for a section that hasn't been downloaded yet (no local
 * `pois` rows) — mirrors offline-package's mile-ranged POI lookup against
 * the same curated /public/data files, fetched directly as static assets
 * instead of through the bearer-gated offline-package endpoint. Best-effort
 * per file: a missing/failed category is silently skipped, matching the
 * server's own try/catch-per-file behavior.
 */
export async function fetchLiveStaticPois(
  catalogKey: string,
  startMile: number,
  endMile: number
): Promise<LivePoi[]> {
  const lo = Math.min(startMile, endMile) - 2;
  const hi = Math.max(startMile, endMile) + 2;
  const results = await Promise.all(
    LIVE_POI_FILES.map(async ({ suffix, type }) => {
      try {
        const res = await fetch(`${API_URL}/data/${catalogKey}-${suffix}.json`);
        if (!res.ok) return [];
        const entries = (await res.json()) as Array<{ name: string; mile: number }>;
        return entries
          .filter((e) => typeof e.mile === "number" && e.mile >= lo && e.mile <= hi)
          .map((e) => ({ type, name: e.name, mile: e.mile }));
      } catch {
        return [];
      }
    })
  );
  return results.flat().sort((a, b) => a.mile - b.mile);
}

// ── AI section generation (online, premium) ──────────────────────────────────
// Each hits a bearer-enabled /api/sections/[id]/generate-* endpoint. The server
// runs the model, persists to the section, and returns the generated content.

/** The six pre-hike detail buckets returned as a bulleted string each. */
export type SectionDetails = {
  summits: string;
  resupply: string;
  water: string;
  historical: string;
  naturalHighlights: string;
  planAround: string;
  gearRecommendations?: string;
  foodRecommendations?: string;
};

export async function generateSectionDetails(
  token: string,
  sectionId: string
): Promise<{ details: SectionDetails }> {
  return apiFetch<{ details: SectionDetails }>(
    `/api/sections/${sectionId}/generate-details`,
    { method: "POST", token }
  );
}

export async function generateSectionGear(
  token: string,
  sectionId: string
): Promise<{ gearRecommendations: string; foodRecommendations: string }> {
  return apiFetch<{ gearRecommendations: string; foodRecommendations: string }>(
    `/api/sections/${sectionId}/generate-gear`,
    { method: "POST", token }
  );
}

export async function generateSectionItinerary(
  token: string,
  sectionId: string
): Promise<{ itinerary: string; plannedCamps: string[]; plannedCampMiles: (number | null)[] }> {
  return apiFetch<{ itinerary: string; plannedCamps: string[]; plannedCampMiles: (number | null)[] }>(
    `/api/sections/${sectionId}/generate-itinerary`,
    { method: "POST", token }
  );
}

// Mirrors web's PoiPopupContent (components/PoiPopupContent.tsx) — community
// water-flow votes, privy cleanliness ratings, and a comment thread, all keyed
// by OSM element id so mobile and web share the same data.
export type PoiComment = { id: string; userId: string; text: string; userName: string | null; createdAt: string };
export type PoiData = {
  waterVotes: { flowing: number; dry: number; lastVoteAt: string | null; stale: boolean } | null;
  privyStats: { average: number; count: number } | null;
  comments: PoiComment[];
  totalComments: number;
  myReport: { waterVote: string | null; privyRating: number | null } | null;
};

export async function fetchPoiData(osmId: string, token: string | null): Promise<PoiData> {
  return apiFetch<PoiData>(`/api/poi/${encodeURIComponent(osmId)}`, { token });
}

type PoiMeta = { poiType: string; poiName?: string | null; lat: number; lon: number };

export async function voteWaterSource(
  token: string,
  osmId: string,
  waterVote: "flowing" | "dry",
  meta: PoiMeta
): Promise<PoiData> {
  return apiFetch<PoiData>(`/api/poi/${encodeURIComponent(osmId)}`, {
    method: "POST",
    token,
    body: { action: "vote", waterVote, ...meta },
  });
}

export async function ratePrivy(token: string, osmId: string, privyRating: number, meta: PoiMeta): Promise<PoiData> {
  return apiFetch<PoiData>(`/api/poi/${encodeURIComponent(osmId)}`, {
    method: "POST",
    token,
    body: { action: "rate", privyRating, ...meta },
  });
}

export async function postPoiComment(token: string, osmId: string, comment: string, meta: PoiMeta): Promise<PoiData> {
  return apiFetch<PoiData>(`/api/poi/${encodeURIComponent(osmId)}`, {
    method: "POST",
    token,
    body: { action: "comment", comment, ...meta },
  });
}

export async function editPoiComment(token: string, commentId: string, text: string): Promise<PoiData> {
  return apiFetch<PoiData>(`/api/poi/comment/${encodeURIComponent(commentId)}`, { method: "PATCH", token, body: { text } });
}

export async function deletePoiComment(token: string, commentId: string): Promise<PoiData> {
  return apiFetch<PoiData>(`/api/poi/comment/${encodeURIComponent(commentId)}`, { method: "DELETE", token });
}
