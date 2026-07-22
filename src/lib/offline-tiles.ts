import Constants from "expo-constants";
import { Platform } from "react-native";

import { AT_TRAIL } from "./map-data";
import { API_URL } from "./api";

// MapLibre's OfflineManager is a native module — it can't run in Expo Go or on
// web. Everything here no-ops in those environments so the surrounding trip
// download (data → SQLite) still works; only the raster-tile save is skipped.
const isExpoGo = Constants.appOwnership === "expo";

export function offlineTilesSupported(): boolean {
  return Platform.OS !== "web" && !isExpoGo;
}

// Deferred require so Expo Go / web never evaluate the native module at import.
function getOfflineManager() {
  return (require("@maplibre/maplibre-react-native") as typeof import("@maplibre/maplibre-react-native"))
    .OfflineManager;
}

/** Stable per-section pack identifier stored in the pack metadata. */
export function sectionPackName(sectionId: string): string {
  return `section:${sectionId}`;
}

/**
 * Bounding box [west, south, east, north] covering a section's mile range,
 * padded by a small buffer so the corridor isn't clipped at the tile edge.
 * Returns null if the mile range doesn't intersect any trail geometry.
 */
export function sectionTileBounds(
  startMile: number,
  endMile: number
): [number, number, number, number] | null {
  const lo = Math.min(startMile, endMile);
  const hi = Math.max(startMile, endMile);
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const f of AT_TRAIL.features) {
    const { start_mile, end_mile } = f.properties;
    if (end_mile <= lo || start_mile >= hi) continue;
    for (const [lng, lat] of f.geometry.coordinates) {
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
  }

  if (!Number.isFinite(west)) return null;
  const buffer = 0.03; // ~3 km, so trailheads/POIs just off-corridor stay covered
  return [west - buffer, south - buffer, east + buffer, north + buffer];
}

/** True if this section's map tiles are already saved as an offline pack. */
export async function isSectionTileSaved(sectionId: string): Promise<boolean> {
  if (!offlineTilesSupported()) return false;
  try {
    const packs = await getOfflineManager().getPacks();
    return packs.some((p) => p.metadata?.name === sectionPackName(sectionId));
  } catch {
    return false;
  }
}

/** Remove a section's saved tile pack (called when its data download is cleared). */
export async function deleteSectionTiles(sectionId: string): Promise<void> {
  if (!offlineTilesSupported()) return;
  try {
    const OfflineManager = getOfflineManager();
    const packs = await OfflineManager.getPacks();
    const pack = packs.find((p) => p.metadata?.name === sectionPackName(sectionId));
    if (pack) await OfflineManager.deletePack(pack.id);
  } catch {
    /* best-effort */
  }
}

/**
 * Download the raster map tiles covering a section's corridor (z8–14) as an
 * offline pack, tagged with the section id. No-op in Expo Go / web, and a no-op
 * (resolves immediately) if the pack already exists or the section has no mile
 * range. `provider` selects the tile style JSON served by the backend.
 */
export async function downloadSectionTiles(
  sectionId: string,
  startMile: number | null,
  endMile: number | null,
  provider = "outdoors",
  onProgress?: (percentage: number) => void
): Promise<void> {
  if (!offlineTilesSupported()) return;
  if (startMile == null || endMile == null) return;

  const bounds = sectionTileBounds(startMile, endMile);
  if (!bounds) return;

  const OfflineManager = getOfflineManager();

  const existing = await OfflineManager.getPacks();
  if (existing.some((p) => p.metadata?.name === sectionPackName(sectionId))) {
    onProgress?.(100);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    OfflineManager.createPack(
      {
        mapStyle: `${API_URL}/api/mobile/tile-style?provider=${provider}`,
        bounds,
        minZoom: 8,
        maxZoom: 14,
        metadata: { name: sectionPackName(sectionId), sectionId },
      },
      (_pack, status) => {
        if (status.state === "complete" || status.percentage >= 100) {
          onProgress?.(100);
          resolve();
        } else {
          onProgress?.(status.percentage);
        }
      },
      (_pack, error) => reject(new Error(error.message))
    ).catch(reject);
  });
}
