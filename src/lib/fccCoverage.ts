import { Platform } from "react-native";

import { API_URL } from "./api";
import { carrierNetworks } from "./fccCarriers";

// Mobile port of web's FccCoverageLayer.tsx computation (the rendering side
// lives in TrailMapNative.tsx / TrailMap.web.tsx). Coverage data is FCC BDC
// per-carrier "which H3 res-9 cells have LTE/5G" JSON, served as static files
// by the web app's own /public/data/coverage/ — mobile fetches the exact same
// files rather than re-deriving or duplicating them.

type CoverageData = { cells: string[] };

// In-memory cache — one entry per network per app session. Files run ~5MB
// each; native additionally persists to disk (see loadNetworkCells) so a
// carrier only needs to download once ever, not once per app launch.
const memCache: Record<string, Set<string> | "missing"> = {};

async function loadNetworkCells(network: string): Promise<Set<string> | null> {
  const cached = memCache[network];
  if (cached instanceof Set) return cached;
  if (cached === "missing") return null;

  try {
    let data: CoverageData;
    if (Platform.OS === "web") {
      // Web preview has no persistent native file storage — an in-memory
      // per-session cache (above) is enough for a preview surface.
      const res = await fetch(`${API_URL}/data/coverage/${network}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } else {
      const FileSystem = await import("expo-file-system/legacy");
      const localPath = `${FileSystem.documentDirectory}coverage-${network}.json`;
      const info = await FileSystem.getInfoAsync(localPath);
      if (!info.exists) {
        const result = await FileSystem.downloadAsync(`${API_URL}/data/coverage/${network}.json`, localPath);
        if (result.status !== 200) {
          await FileSystem.deleteAsync(localPath, { idempotent: true });
          throw new Error(`HTTP ${result.status}`);
        }
      }
      const text = await FileSystem.readAsStringAsync(localPath);
      data = JSON.parse(text);
    }
    const set = new Set(data.cells);
    memCache[network] = set;
    return set;
  } catch {
    memCache[network] = "missing";
    return null;
  }
}

/** Resolves a carrier to its coverage cell Set(s) — null if unavailable/unrecognized. */
export async function loadCoverageSets(carrier: string): Promise<Set<string>[] | null> {
  const networks = carrierNetworks(carrier);
  if (networks.length === 0) return null;
  const results = await Promise.all(networks.map(loadNetworkCells));
  const valid = results.filter((s): s is Set<string> => s instanceof Set);
  return valid.length > 0 ? valid : null;
}

export type DeadZoneMultiPolygon = {
  type: "MultiPolygon";
  coordinates: [number, number][][][];
};

/**
 * Builds a near-trail H3 buffer (k=3 ring around every 5th sampled coord, same
 * as web), subtracts cells covered by any of the given networks, and merges
 * the remaining uncovered cells into contiguous dead-zone polygons.
 * trailCoordsList entries are [lon, lat][] (GeoJSON order) per trail segment.
 */
export async function computeDeadZoneGeoJSON(
  trailCoordsList: [number, number][][],
  coverageSets: Set<string>[]
): Promise<DeadZoneMultiPolygon | null> {
  const h3 = await import("h3-js");
  const KRING = 3;
  const SAMPLE = 5;
  const nearTrailCells = new Set<string>();

  for (const coords of trailCoordsList) {
    for (let i = 0; i < coords.length; i += SAMPLE) {
      const [lon, lat] = coords[i];
      const cell = h3.latLngToCell(lat, lon, 9);
      for (const c of h3.gridDisk(cell, KRING)) {
        nearTrailCells.add(c);
      }
    }
  }

  const uncoveredCells: string[] = [];
  for (const cell of nearTrailCells) {
    const covered = coverageSets.some((s) => s.has(cell));
    if (!covered) uncoveredCells.push(cell);
  }
  if (uncoveredCells.length === 0) return null;

  const polys = h3.cellsToMultiPolygon(uncoveredCells);
  return {
    type: "MultiPolygon",
    coordinates: polys.map((poly) => poly.map((ring) => ring.map(([lat, lng]) => [lng, lat] as [number, number]))),
  };
}
