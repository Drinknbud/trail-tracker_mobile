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
  trailName: string | null;
  heroImage: string | null;
  heroImagePosition: string | null;
  accentColor: string | null;
  distanceUnit: string;
  shareSlug: string | null;
};

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
