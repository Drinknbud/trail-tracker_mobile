// Trail geometry + POI data for the map, bundled in the app binary
// (docs §8: bundle active-trail geometry and curated POIs).

import type { SectionRow } from "@/db/types";
import { getPlannedSectionColor, COMPLETED_COLOR } from "@/lib/section-colors";

import shelters from "../../assets/data/at-shelters.json";
import campsites from "../../assets/data/at-campsites.json";
import parkingSpots from "../../assets/data/at-parking.json";
import waterSources from "../../assets/data/at-water.json";
import privies from "../../assets/data/at-privies.json";

type TrailSegment = {
  type: "Feature";
  properties: { start_mile: number; end_mile: number };
  geometry: { type: "LineString"; coordinates: [number, number][] };
};

type TrailCollection = {
  type: "FeatureCollection";
  features: TrailSegment[];
};

// require() keeps tsc from deep-typing the 1.7 MB literal (import would).
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const AT_TRAIL = require("../../assets/data/at-trail.json") as TrailCollection;

/** Vector style used for the base map underneath every named tile style below. */
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

// Raster tile sources — ported 1:1 from web's components/TrailMap.tsx TILE_CONFIGS
// so the mobile style switcher matches web exactly (same providers, same look).
export type MapStyleKey = "outdoors" | "satellite" | "topo";

export const MAP_STYLES: { value: MapStyleKey; label: string }[] = [
  { value: "outdoors", label: "Outdoors" },
  { value: "satellite", label: "Satellite" },
  { value: "topo", label: "Topo" },
];

/**
 * Approximates web's `globals.css` dark/light tile filters
 * (`invert(1) hue-rotate(200deg) saturate(0.25) brightness(0.82)` in dark,
 * `saturate(0.25) brightness(1.04)` in light, Satellite exempt in both) using
 * MapLibre's raster paint properties instead of a DOM CSS filter, since
 * MapLibre Native has no filter engine to apply on-device. Swapping
 * raster-brightness-min/max (default min 0 → max 1) inverts the brightness
 * ramp (min 1 → max 0 maps input 0→output 1, input 1→output 0), which
 * combined with hue-rotate + desaturation approximates the same invert-to-dark
 * look web gets for free from `filter: invert(1)`.
 */
// Always returns all 4 keys (using MapLibre's own neutral defaults when
// unused) so callers can blindly setPaintProperty every key on a scheme/style
// change without needing separate "reset" logic for the ones not in play.
const NEUTRAL_TILE_PAINT = { "raster-hue-rotate": 0, "raster-saturation": 0, "raster-brightness-min": 0, "raster-brightness-max": 1 };

export function tileRasterPaint(scheme: "light" | "dark", mapStyle: MapStyleKey): Record<string, number> {
  if (mapStyle === "satellite") return NEUTRAL_TILE_PAINT;
  if (scheme === "dark") {
    return {
      "raster-hue-rotate": 200,
      "raster-saturation": -0.75,
      "raster-brightness-min": 0.82,
      "raster-brightness-max": 0,
    };
  }
  return { ...NEUTRAL_TILE_PAINT, "raster-saturation": -0.75 };
}

export const TILE_CONFIGS: Record<
  MapStyleKey,
  { urlTemplate: string; attribution: string }
> = {
  outdoors: {
    urlTemplate: "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
  },
  satellite: {
    urlTemplate:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles © Esri — Source: Esri, USGS, NOAA",
  },
  topo: {
    urlTemplate: "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap",
  },
};

/** Whole-AT extent: [west, south, east, north] */
export const AT_BOUNDS: [number, number, number, number] = [-85.0, 33.5, -68.0, 46.2];

/** Springer Mtn → Neels Gap corridor with ~5 mi buffer — the M1 offline-pack test region */
export const GA_SECTION_BOUNDS: [number, number, number, number] = [-84.35, 34.45, -83.8, 34.85];

// Per-feature cumulative arc length, cached by feature object identity (AT_TRAIL
// is loaded once and never mutated) so repeated coordinateAtMile calls landing
// in the same feature — routine, since one feature can span up to ~19 miles —
// don't re-walk its coordinate array from scratch every time.
const arcLengthCache = new WeakMap<TrailSegment, { cumLen: number[]; totalLen: number }>();

function arcLengthFor(segment: TrailSegment): { cumLen: number[]; totalLen: number } {
  const cached = arcLengthCache.get(segment);
  if (cached) return cached;
  const coords = segment.geometry.coordinates;
  const cumLen: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    cumLen.push(cumLen[i - 1] + Math.hypot(lat2 - lat1, lon2 - lon1));
  }
  const result = { cumLen, totalLen: cumLen[cumLen.length - 1] };
  arcLengthCache.set(segment, result);
  return result;
}

/**
 * Project a trail mile marker to [lng, lat] by interpolating along the
 * segment whose mile range contains it, by real arc length (binary search +
 * sub-segment linear interpolation) rather than raw coordinate-array index —
 * ported from web's findMilePosition (components/TrailMap.tsx). Trail
 * coordinates are NOT evenly spaced along a segment (denser through
 * switchbacks, sparser on straightaways), so indexing by
 * `fraction * (coords.length - 1)` placed markers up to ~1.3mi off on a
 * measured 19-mile feature — arc-length is what actually corresponds to miles.
 * POI datasets (shelters, towns, trailheads) store miles, not coordinates.
 */
export function coordinateAtMile(mile: number): [number, number] | null {
  const segment = AT_TRAIL.features.find(
    (f) => f.properties.start_mile <= mile && mile <= f.properties.end_mile
  );
  if (!segment || segment.geometry.coordinates.length === 0) return null;

  const coords = segment.geometry.coordinates;
  if (coords.length === 1) return coords[0];

  const { start_mile, end_mile } = segment.properties;
  const { cumLen, totalLen } = arcLengthFor(segment);
  if (totalLen === 0) return coords[0];

  const t = end_mile === start_mile ? 0 : (mile - start_mile) / (end_mile - start_mile);
  const targetLen = t * totalLen;

  let lo = 0, hi = cumLen.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cumLen[mid] <= targetLen) lo = mid; else hi = mid;
  }

  const segLen = cumLen[hi] - cumLen[lo];
  const segT = segLen > 0 ? (targetLen - cumLen[lo]) / segLen : 0;
  const [lon1, lat1] = coords[lo];
  const [lon2, lat2] = coords[hi];
  return [lon1 + segT * (lon2 - lon1), lat1 + segT * (lat2 - lat1)];
}

/**
 * Slice trail feature coordinates to the [fromMile, toMile] range, ported from
 * web's extractSegmentCoords. Returns GeoJSON-order [lon, lat] pairs (unlike
 * web's Leaflet [lat, lon] — MapLibre wants standard GeoJSON order).
 */
function extractSegmentCoords(fromMile: number, toMile: number): [number, number][][] {
  const lo = Math.min(fromMile, toMile);
  const hi = Math.max(fromMile, toMile);
  const lines: [number, number][][] = [];
  for (const f of AT_TRAIL.features) {
    const { start_mile, end_mile } = f.properties;
    if (end_mile <= lo || start_mile >= hi) continue;
    lines.push(f.geometry.coordinates);
  }
  return lines;
}

export type SectionLineFeature = {
  type: "Feature";
  properties: { id: string; name: string; status: string; color: string };
  geometry: { type: "LineString"; coordinates: [number, number][] };
};

/**
 * Builds one LineString feature per trail segment per section, colored to
 * match web's getSectionColor/getPlannedSectionColor (completed always green,
 * planned cycles through PLANNED_COLORS sorted by startMile).
 */
export function buildSectionLineCollection(sections: SectionRow[]): {
  type: "FeatureCollection";
  features: SectionLineFeature[];
} {
  const plannedSections = sections.filter(
    (s) => s.status === "planned" && s.startMile != null && s.endMile != null
  );
  const relevant = sections.filter(
    (s) => (s.status === "completed" || s.status === "planned") && s.startMile != null && s.endMile != null
  );

  const features: SectionLineFeature[] = [];
  for (const s of relevant) {
    const color = s.status === "completed" ? COMPLETED_COLOR : getPlannedSectionColor(s.id, plannedSections);
    const lines = extractSegmentCoords(s.startMile!, s.endMile!);
    lines.forEach((coordinates, i) => {
      features.push({
        type: "Feature",
        properties: { id: `${s.id}-${i}`, name: s.name, status: s.status, color },
        geometry: { type: "LineString", coordinates },
      });
    });
  }
  return { type: "FeatureCollection", features };
}

/** A trail photo already resolved to a map position (GPS or mile-midpoint fallback). */
export type MapPhotoResolved = {
  id: string;
  baseUrl: string;
  thumbnailUrl: string;
  takenAt: string | null;
  lat: number;
  lng: number;
};

export type PhotoGroupProperties = { count: number; photosJson: string };

/**
 * Groups resolved photos that share a position (e.g. several photos pinned to
 * the same section mile-midpoint) into one marker each — mirrors web's TrailMap
 * photo grouping. Each group's photos ride along as a JSON string in the feature
 * properties (MapLibre can't carry nested arrays) for the tap handler to parse.
 */
export function buildPhotoCollection(photos: MapPhotoResolved[]): {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: PhotoGroupProperties;
    geometry: { type: "Point"; coordinates: [number, number] };
  }[];
} {
  const groups = new Map<string, MapPhotoResolved[]>();
  for (const p of photos) {
    const key = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(p);
    else groups.set(key, [p]);
  }
  return {
    type: "FeatureCollection",
    features: [...groups.values()].map((group) => ({
      type: "Feature",
      properties: { count: group.length, photosJson: JSON.stringify(group) },
      geometry: { type: "Point", coordinates: [group[0].lng, group[0].lat] },
    })),
  };
}

export type PoiType = "shelter" | "campsite" | "parking" | "water" | "privy";

/**
 * Per-type first-visible zoom for POI icons — staggered so the whole-corridor
 * view isn't a wall of overlapping icons. Shelters and parking (trailheads) are
 * the sparse, navigationally-useful ones, so they come in earlier (zoom 8); the
 * dense sets (campsites/water/privies, often many per mile near trail towns)
 * wait until you're zoomed in enough for them to spread out. Used by both map
 * renderers (TrailMapNative / TrailMap.web).
 */
export const POI_MINZOOM: Record<PoiType, number> = {
  shelter: 8,
  parking: 8,
  campsite: 12,
  water: 12,
  privy: 12,
};

/** Tap-target properties every POI feature carries, matching web's PoiPopupContent fields. osmId is null for shelters — see note on SHELTER_COLLECTION. */
export type PoiProperties = {
  type: PoiType;
  name: string | null;
  ele: number | null;
  atMile: number | null;
  osmId: string | null;
};

type PoiRecord = { osmId: string; lat: number; lon: number; name?: string; ele?: number; atMile?: number };

function toPointCollection(records: PoiRecord[], type: PoiType) {
  return {
    type: "FeatureCollection" as const,
    features: records.map((r) => ({
      type: "Feature" as const,
      properties: {
        type,
        name: r.name ?? null,
        ele: r.ele ?? null,
        atMile: r.atMile ?? null,
        osmId: r.osmId,
      } satisfies PoiProperties,
      geometry: { type: "Point" as const, coordinates: [r.lon, r.lat] as [number, number] },
    })),
  };
}

export type ShelterPoi = { name: string; mile: number; confidence: string };

/**
 * Shelter POIs as GeoJSON points, projected onto the trail line (curated
 * mile-based source data, not Overpass — see the July 17 mobile-app-project
 * memory entry for why: Overpass's shelter/hut tagging returned 741 elements
 * within 8km of the AT vs. this curated list's 314, almost certainly picking
 * up non-AT huts in the wider buffer, so the noisier osmId-bearing set wasn't
 * worth it). osmId is null — there's no reliable OSM element to key a shared
 * comment thread to, so shelter tap cards show info only, no comments.
 */
export const SHELTER_COLLECTION = {
  type: "FeatureCollection" as const,
  features: (shelters as ShelterPoi[])
    .map((shelter) => {
      const coord = coordinateAtMile(shelter.mile);
      if (!coord) return null;
      return {
        type: "Feature" as const,
        properties: {
          type: "shelter" as const,
          name: shelter.name,
          ele: null,
          atMile: shelter.mile,
          osmId: null,
        } satisfies PoiProperties,
        geometry: { type: "Point" as const, coordinates: coord },
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null),
};

/** Campsites/parking/water/privies — bundled from the web app's Overpass POI cache, pre-filtered to within 8km of the AT (see lib/poi-helpers.ts isNearAT). */
export const CAMPSITE_COLLECTION = toPointCollection(campsites as PoiRecord[], "campsite");
export const PARKING_COLLECTION = toPointCollection(parkingSpots as PoiRecord[], "parking");
export const WATER_COLLECTION = toPointCollection(waterSources as PoiRecord[], "water");
export const PRIVY_COLLECTION = toPointCollection(privies as PoiRecord[], "privy");

/**
 * Mile markers along the whole trail, ported from web's MileMarkers/
 * getMileInterval (components/TrailMap.tsx) — AT-blaze-style badges with each
 * digit on its own line, density increasing with zoom (every 400mi at the
 * whole-trail view, down to every 1mi zoomed all the way in). Web recomputes
 * this live per viewport/zoom; mobile bakes every integer mile once and tags
 * each with a `tier` so one map layer per tier (see TrailMapNative/
 * TrailMap.web) can hide below its own minzoom — cheaper than a live recompute
 * and avoids needing a zoom-change listener.
 *
 * The coarsest tier (400mi) has minzoom 0 so markers are ALWAYS visible, just
 * sparser as you zoom out — never blank like the old floor at zoom 7 did.
 *
 * The tiers form a clean divisor chain (400→200→100→50→10→5→1) on purpose:
 * because MapLibre reveals layers monotonically (a tier shown at its minzoom
 * stays shown when you zoom further in), the set visible at any zoom is just
 * the union of all active tiers, so each tier's spacing must divide the coarser
 * ones for that union to equal a single clean interval. Web's own schedule
 * includes a 25mi step (zoom 9-10) that breaks the chain (25 ∤ 10), so web can
 * show 25s then drop them at zoom 11; mobile can't drop a revealed tier, so the
 * 25mi step is folded away here (mobile jumps 50→10). A small, deliberate
 * divergence, not a bug.
 */
export type MileMarkerTier = 400 | 200 | 100 | 50 | 10 | 5 | 1;
// minzoom values below are derived, not eyeballed: at zoom z, a screen of
// width W shows W * 156543.03392*cos(lat)/2^z meters. Using a conservative
// narrow-phone width (360px) and the AT's northernmost latitude (~45.9°N,
// Maine — the worst case, since screen-miles shrinks fastest there), each
// tier's minzoom is the latest zoom at which the *previous, coarser* tier's
// spacing still fits on screen with a 1.5x margin — i.e. the tier must take
// over before its predecessor can no longer guarantee a visible marker.
// 50→10→5→1 were the broken handoffs (bug: gaps with zero markers visible
// around zoom 9-13); 400→200→100→50 already had comfortable margin.
export const MILE_MARKER_TIERS: { tier: MileMarkerTier; minzoom: number }[] = [
  { tier: 400, minzoom: 0 },
  { tier: 200, minzoom: 5 },
  { tier: 100, minzoom: 6 },
  { tier: 50, minzoom: 7 },
  { tier: 10, minzoom: 9 },  // was 11 — 50mi spacing stops being screen-safe at zoom 9
  { tier: 5, minzoom: 11 },  // was 13 — 10mi spacing stops being screen-safe at zoom 11
  { tier: 1, minzoom: 12 },  // was 14 — 5mi spacing stops being screen-safe at zoom 12
];

export const MILE_MARKER_COLLECTION = (() => {
  const AT_MAX_MILES = 2198;
  const features: {
    type: "Feature";
    properties: { mile: number; label: string; tier: MileMarkerTier };
    geometry: { type: "Point"; coordinates: [number, number] };
  }[] = [];
  for (let mile = 0; mile <= AT_MAX_MILES; mile++) {
    const coord = coordinateAtMile(mile);
    if (!coord) continue;
    // Coarsest bucket the mile belongs to → first zoom it appears at.
    const tier: MileMarkerTier =
      mile % 400 === 0 ? 400 :
      mile % 200 === 0 ? 200 :
      mile % 100 === 0 ? 100 :
      mile % 50 === 0 ? 50 :
      mile % 10 === 0 ? 10 :
      mile % 5 === 0 ? 5 : 1;
    // Each digit on its own line — mimics the vertically-stacked-digit AT
    // blaze look web achieves with a divIcon (`digits.map(...).join("")`).
    const label = String(mile).split("").join("\n");
    features.push({
      type: "Feature",
      properties: { mile, label, tier },
      geometry: { type: "Point", coordinates: coord },
    });
  }
  return { type: "FeatureCollection" as const, features };
})();

/**
 * Km counterpart to MILE_MARKER_COLLECTION, for users with distanceUnit "km".
 * Positioned at round-KM marks (not mile marks converted to km after the
 * fact) — matching web's own getMileInterval, which for km mode derives the
 * marker spacing as `Math.max(10, Math.round(intervalMi * 1.60934 / 10) * 10)`
 * and places markers at that many actual km, not at the km-equivalent of a
 * round mile number. Running that formula over web's mile-interval schedule
 * collapses zoom 13 and 14 to the same 10km spacing (1mi and 5mi both round to
 * 10km), so this has one fewer tier than the mile version.
 */
export type KmMarkerTier = 640 | 320 | 160 | 80 | 40 | 20 | 10;
// Same screen-width derivation as MILE_MARKER_TIERS above, computed directly
// in km. 40→20→10 had the same "gap with zero markers visible" bug.
export const KM_MARKER_TIERS: { tier: KmMarkerTier; minzoom: number }[] = [
  { tier: 640, minzoom: 0 },
  { tier: 320, minzoom: 5 },
  { tier: 160, minzoom: 6 },
  { tier: 80, minzoom: 7 },
  { tier: 40, minzoom: 9 },
  { tier: 20, minzoom: 10 }, // was 11 — 40km spacing stops being screen-safe at zoom 10
  { tier: 10, minzoom: 11 }, // was 13 — 20km spacing stops being screen-safe at zoom 11
];

export const KM_MARKER_COLLECTION = (() => {
  const AT_MAX_KM = Math.ceil(2198 * 1.60934); // ≈ 3537
  const features: {
    type: "Feature";
    properties: { km: number; label: string; tier: KmMarkerTier };
    geometry: { type: "Point"; coordinates: [number, number] };
  }[] = [];
  for (let km = 0; km <= AT_MAX_KM; km += 10) {
    const coord = coordinateAtMile(km / 1.60934);
    if (!coord) continue;
    const tier: KmMarkerTier =
      km % 640 === 0 ? 640 :
      km % 320 === 0 ? 320 :
      km % 160 === 0 ? 160 :
      km % 80 === 0 ? 80 :
      km % 40 === 0 ? 40 :
      km % 20 === 0 ? 20 : 10;
    const label = String(km).split("").join("\n");
    features.push({
      type: "Feature",
      properties: { km, label, tier },
      geometry: { type: "Point", coordinates: coord },
    });
  }
  return { type: "FeatureCollection" as const, features };
})();

/**
 * Precomputed phone-coverage "dead zone" polygons near the trail, one file per
 * carrier coverage group — see scripts/precompute-dead-zones.mjs for how these
 * were generated (mirrors web's FccCoverageLayer.tsx live H3 computation,
 * baked ahead of time instead of recomputed on every mount). Keyed the same
 * way as lib/carriers.ts's CoverageKey / carrierCoverageKey().
 */
type CoverageFeature = {
  type: "Feature";
  properties: Record<string, never>;
  geometry: { type: "MultiPolygon"; coordinates: [number, number][][][] };
};

// require() keeps tsc from deep-typing these ~1MB literals (import would).
/* eslint-disable @typescript-eslint/no-require-imports */
export const COVERAGE_DATA: Record<"verizon" | "att" | "tmobile" | "consumercellular", CoverageFeature> = {
  verizon: require("../../assets/data/coverage/verizon.json"),
  att: require("../../assets/data/coverage/att.json"),
  tmobile: require("../../assets/data/coverage/tmobile.json"),
  consumercellular: require("../../assets/data/coverage/consumercellular.json"),
};
/* eslint-enable @typescript-eslint/no-require-imports */

// fill-pattern tiles in a fixed SCREEN-pixel grid, not world space, so a
// single image makes an H3 res9 hexagon (~174m edge) show a wildly different
// number of stripe repeats depending on zoom: at z13-14 a hex is only
// 11-22px across (smaller than even the base 48px tile), at z16+ it's
// 89-178px (many repeats of a small tile = a dense mush). Swapping to a
// bigger/smaller tile per zoom step keeps the apparent stripe density
// per-hexagon roughly constant. Hex screen size doubles every +1 zoom
// (meters-per-pixel halves), so this tile-size ladder doubles in lockstep;
// breakpoints are the zoom at which each step's hex edge (174m / mpp)
// roughly matches that tile's pixel size. All 5 images share the same
// stroke-to-tile ratio and color (see gen-coverage-hatch-tiers.js) so only
// the repeat interval changes, not the look.
export const COVERAGE_HATCH_TIERS = ["coverage-hatch-12", "coverage-hatch-24", "coverage-hatch", "coverage-hatch-96", "coverage-hatch-192"] as const;
// Typed as unknown[] rather than a real MapLibre ExpressionSpecification so
// this file doesn't need the maplibre-gl/maplibre-react-native types as a
// dependency — both callers cast it to whatever their local paint type expects.
export const COVERAGE_HATCH_PATTERN: unknown[] = [
  "step",
  ["zoom"],
  "coverage-hatch-12",
  13, "coverage-hatch-24",
  14, "coverage-hatch",
  15, "coverage-hatch-96",
  16, "coverage-hatch-192",
];
