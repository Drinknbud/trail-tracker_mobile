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
