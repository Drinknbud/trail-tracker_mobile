// Compatibility score utility for Trail Buddy matching.
// Pure TypeScript — no imports, fully testable in isolation.
// Ported verbatim from the web app's lib/buddy-compat.ts (per AGENTS.md:
// web is the source of truth) — do not reimplement, keep in sync if the
// web scoring logic changes.

export interface ViewerProfile {
  typicalDailyMiles: number | null;
  socialStyle: string | null;
  wakeStyle: string | null;
  campStyle: string | null;
  // Optional section context for geographic/temporal overlap
  startMile?: number | null;
  endMile?: number | null;
  startDate?: string | null; // ISO string
  endDate?: string | null;
}

export interface ListingCompat {
  startMile?: number | null;
  endMile?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  miles?: number | null;
  user: {
    typicalDailyMiles?: number | null;
    socialStyle?: string | null;
    wakeStyle?: string | null;
    campStyle?: string | null;
  };
}

/**
 * Returns a 0–100 compatibility score between a viewer and a listing,
 * or null when the viewer profile is incomplete (no typicalDailyMiles).
 *
 * Scoring breakdown:
 *   Mile overlap  40 pts — proportional to viewer's section miles
 *   Date overlap  30 pts — proportional to viewer's trip days
 *   Pace match    15 pts — daily mileage within 20%
 *   Personality   5 pts each × 3 traits (socialStyle, wakeStyle, campStyle)
 *
 * Note: personality contributes up to 15 pts total (5 × 3 = 15) to reach
 * the full 100-pt ceiling alongside the other categories.
 */
export function computeCompatibility(
  viewer: ViewerProfile,
  listing: ListingCompat
): number | null {
  if (!viewer.typicalDailyMiles) return null;

  let score = 0;

  // ── Mile overlap (40 pts) ──────────────────────────────────────────────────
  if (
    viewer.startMile != null &&
    viewer.endMile != null &&
    listing.startMile != null &&
    listing.endMile != null
  ) {
    const overlapMiles = Math.max(
      0,
      Math.min(viewer.endMile, listing.endMile) -
        Math.max(viewer.startMile, listing.startMile)
    );
    const viewerMiles = viewer.endMile - viewer.startMile;
    if (viewerMiles > 0) {
      score += Math.min(40, (overlapMiles / viewerMiles) * 40);
    }
  }

  // ── Date overlap (30 pts) ──────────────────────────────────────────────────
  if (viewer.startDate && viewer.endDate && listing.startDate && listing.endDate) {
    const vs = new Date(viewer.startDate).getTime();
    const ve = new Date(viewer.endDate).getTime();
    const ls = new Date(listing.startDate).getTime();
    const le = new Date(listing.endDate).getTime();
    const overlapMs = Math.max(0, Math.min(ve, le) - Math.max(vs, ls));
    const viewerMs = ve - vs;
    if (viewerMs > 0) {
      score += Math.min(30, (overlapMs / viewerMs) * 30);
    }
  }

  // ── Pace match (15 pts) ───────────────────────────────────────────────────
  if (
    listing.user.typicalDailyMiles &&
    Math.abs(viewer.typicalDailyMiles - listing.user.typicalDailyMiles) /
      viewer.typicalDailyMiles <
      0.2
  ) {
    score += 15;
  }

  // ── Personality (up to 15 pts, 5 each) ───────────────────────────────────
  const traits: Array<keyof Pick<ViewerProfile, "socialStyle" | "wakeStyle" | "campStyle">> = [
    "socialStyle",
    "wakeStyle",
    "campStyle",
  ];
  for (const trait of traits) {
    if (viewer[trait] && listing.user[trait] && viewer[trait] === listing.user[trait]) {
      score += 5;
    }
  }

  return Math.min(100, Math.round(score));
}
