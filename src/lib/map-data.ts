// Trail geometry + POI data for the map, bundled in the app binary
// (docs §8: bundle active-trail geometry and curated POIs).

import shelters from "../../assets/data/at-shelters.json";

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

// Free, keyless vector style — the "lowest cost for now" tile decision.
// Swap for a paid provider or self-hosted tileserver if usage outgrows it.
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/** Whole-AT extent: [west, south, east, north] */
export const AT_BOUNDS: [number, number, number, number] = [-85.0, 33.5, -68.0, 46.2];

/** Springer Mtn → Neels Gap corridor with ~5 mi buffer — the M1 offline-pack test region */
export const GA_SECTION_BOUNDS: [number, number, number, number] = [-84.35, 34.45, -83.8, 34.85];

/**
 * Project a trail mile marker to [lng, lat] by interpolating along the
 * segment whose mile range contains it. POI datasets (shelters, towns,
 * trailheads) store miles, not coordinates.
 */
export function coordinateAtMile(mile: number): [number, number] | null {
  const segment = AT_TRAIL.features.find(
    (f) => f.properties.start_mile <= mile && mile <= f.properties.end_mile
  );
  if (!segment || segment.geometry.coordinates.length === 0) return null;

  const { start_mile, end_mile } = segment.properties;
  const coords = segment.geometry.coordinates;
  const span = end_mile - start_mile;
  const fraction = span > 0 ? (mile - start_mile) / span : 0;
  const index = Math.min(coords.length - 1, Math.round(fraction * (coords.length - 1)));
  return coords[index];
}

export type ShelterPoi = { name: string; mile: number; confidence: string };

/** Shelter POIs as GeoJSON points, projected onto the trail line. */
export const SHELTER_COLLECTION = {
  type: "FeatureCollection" as const,
  features: (shelters as ShelterPoi[])
    .map((shelter) => {
      const coord = coordinateAtMile(shelter.mile);
      if (!coord) return null;
      return {
        type: "Feature" as const,
        properties: { name: shelter.name, mile: shelter.mile },
        geometry: { type: "Point" as const, coordinates: coord },
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null),
};
