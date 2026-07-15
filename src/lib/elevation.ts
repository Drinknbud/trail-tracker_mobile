// Elevation profile math — ported from the web app's SectionElevationChart
// (computeGradeStats / computeUpsDowns) plus the coord→distance projection
// from SectionVisuals, so the mobile chart matches web exactly. All distances
// are in miles, elevations in feet.

export interface ElevPoint {
  dist: number;
  elev: number;
}

export interface GradeStats {
  flatMi: number;
  easyMi: number;
  moderateMi: number;
  steepMi: number;
}

/** Miles in each grade band — drives the effort-distribution bar. */
export function computeGradeStats(points: ElevPoint[]): GradeStats {
  let flat = 0, easy = 0, mod = 0, steep = 0;
  for (let i = 1; i < points.length; i++) {
    const distMi = points[i].dist - points[i - 1].dist;
    const distFt = distMi * 5280;
    if (distFt < 0.1) continue;
    const grade = Math.abs(((points[i].elev - points[i - 1].elev) / distFt) * 100);
    if (grade < 4) flat += distMi;
    else if (grade < 10) easy += distMi;
    else if (grade < 18) mod += distMi;
    else steep += distMi;
  }
  return { flatMi: flat, easyMi: easy, moderateMi: mod, steepMi: steep };
}

/** Count distinct climbs/descents, ignoring wiggles smaller than `threshold` ft. */
export function computeUpsDowns(points: ElevPoint[], threshold = 50): { ups: number; downs: number } {
  let ups = 0, downs = 0;
  let direction: "up" | "down" | null = null;
  let accumulated = 0;

  for (let i = 1; i < points.length; i++) {
    const diff = points[i].elev - points[i - 1].elev;
    if (Math.abs(diff) < 1) continue;
    const newDir: "up" | "down" = diff > 0 ? "up" : "down";
    if (direction === null) {
      direction = newDir;
      accumulated = Math.abs(diff);
    } else if (newDir === direction) {
      accumulated += Math.abs(diff);
    } else {
      if (accumulated >= threshold) {
        if (direction === "up") ups++;
        else downs++;
      }
      direction = newDir;
      accumulated = Math.abs(diff);
    }
  }
  if (direction !== null && accumulated >= threshold) {
    if (direction === "up") ups++;
    else downs++;
  }
  return { ups, downs };
}

/** Total ascent and descent in feet from the raw profile. */
export function computeAscentDescent(points: ElevPoint[]): { ascent: number; descent: number } {
  let ascent = 0, descent = 0;
  for (let i = 1; i < points.length; i++) {
    const diff = points[i].elev - points[i - 1].elev;
    if (diff > 0) ascent += diff;
    else descent += Math.abs(diff);
  }
  return { ascent, descent };
}

/**
 * Project a GPS fix onto the elevation profile → distance-from-start (miles).
 *
 * `coords[i]` is parallel to `points[i]` (both sampled along the section from
 * the offline package), so we find the nearest sampled coord to the GPS fix
 * and read that index's dist. Returns null when GPS is > ~5 km from the whole
 * section (0.045° ≈ 5 km) so a stray or unrelated fix never plants a false dot
 * — same guard the web uses.
 */
export function projectGpsToDist(
  coords: [number, number][],
  points: ElevPoint[],
  gps: { lat: number; lon: number },
): number | null {
  if (coords.length < 2 || points.length < 2) return null;
  let minD = Infinity;
  let minIdx = 0;
  for (let i = 0; i < coords.length; i++) {
    const [lat, lon] = coords[i];
    const d = Math.hypot(lat - gps.lat, lon - gps.lon);
    if (d < minD) {
      minD = d;
      minIdx = i;
    }
  }
  if (minD > 0.045) return null;
  return points[minIdx]?.dist ?? null;
}
