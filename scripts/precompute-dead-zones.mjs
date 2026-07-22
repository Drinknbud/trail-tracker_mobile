/**
 * Precomputes phone-coverage "dead zone" polygons near the AT trail, per
 * carrier, as small bundled GeoJSON assets — the mobile counterpart to web's
 * components/FccCoverageLayer.tsx, which does this same computation live in
 * the browser on every page load using h3-js + the raw per-network coverage
 * cell files. Mobile has no equivalent of a cheap client-side re-render on
 * every mount, so this bakes the result once at build time instead:
 *   - no ~4.3–5MB per-network runtime fetch
 *   - no on-device H3 buffer/diff/polygon-merge computation (battery/CPU)
 *   - output is tiny (polygons compress far better than long cell-ID lists)
 * Trade-off: must be re-run if the trail route or the FCC source data changes
 * (this is the same trade-off already made for mile markers / POIs — see
 * lib/map-data.ts).
 *
 * ALGORITHM — mirrors FccCoverageLayer.tsx exactly, so the mobile hatch
 * overlay lines up with web's:
 *   1. Build a near-trail H3 cell buffer: every 5th trail coordinate (SAMPLE),
 *      latLngToCell at res 9, gridDisk with k=3 (KRING) around each.
 *   2. A near-trail cell is "dead" if it's absent from every coverage set
 *      required for that carrier group (single network, or — for
 *      multi-network MVNOs like Consumer Cellular — ALL of them, since
 *      "covered" there means covered by any one network).
 *   3. Merge dead cells into contiguous polygons via h3.cellsToMultiPolygon().
 *
 * Run: node scripts/precompute-dead-zones.mjs
 * Requires: h3-js (already a mobile dependency), and the web app's already-
 * processed per-network cell files at ../../Trail Tracker/public/data/coverage/.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import * as h3 from "h3-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_COVERAGE_DIR = join(__dirname, "../../Trail Tracker/public/data/coverage");
const TRAIL_PATH = join(__dirname, "../assets/data/at-trail.json");
const OUTPUT_DIR = join(__dirname, "../assets/data/coverage");

const H3_RES = 9;
const KRING = 3;
const SAMPLE = 5;

// Carrier "coverage groups" — mirrors web's lib/fccCarriers.ts CARRIER_NETWORKS,
// but resolved to one precomputed output file per distinct network combination
// (mobile's carrierCoverageKey() maps every carrier key to one of these).
// A group is "dead" only where near-trail cells are uncovered by EVERY listed
// network (i.e. "covered" = covered by any one of them, same as web).
const COVERAGE_GROUPS = {
  verizon: ["verizon"],
  att: ["att"],
  tmobile: ["tmobile"],
  // Consumer Cellular runs on both networks — dead only where neither has signal.
  consumercellular: ["tmobile", "att"],
  // No "uscc" group: the web app has no uscc.json source data either, so US
  // Cellular selection shows the same "coverage data unavailable" state on
  // both platforms — not a mobile gap to fix here.
};

function loadNetworkCells(network) {
  const path = join(WEB_COVERAGE_DIR, `${network}.json`);
  if (!existsSync(path)) {
    console.warn(`  ! no source file for network "${network}" — skipping`);
    return null;
  }
  const { cells } = JSON.parse(readFileSync(path, "utf8"));
  return new Set(cells);
}

function buildNearTrailCells(trailFeatures) {
  const near = new Set();
  for (const f of trailFeatures) {
    const coords = f.geometry.coordinates;
    for (let i = 0; i < coords.length; i += SAMPLE) {
      const [lon, lat] = coords[i]; // GeoJSON order
      const cell = h3.latLngToCell(lat, lon, H3_RES);
      for (const c of h3.gridDisk(cell, KRING)) near.add(c);
    }
  }
  return near;
}

function main() {
  console.log("Loading trail geometry…");
  const trail = JSON.parse(readFileSync(TRAIL_PATH, "utf8"));
  const nearTrailCells = buildNearTrailCells(trail.features);
  console.log(`Near-trail buffer: ${nearTrailCells.size} cells`);

  const networkCellCache = new Map();
  function getNetworkCells(network) {
    if (!networkCellCache.has(network)) networkCellCache.set(network, loadNetworkCells(network));
    return networkCellCache.get(network);
  }

  for (const [group, networks] of Object.entries(COVERAGE_GROUPS)) {
    const coverageSets = networks.map(getNetworkCells).filter((s) => s !== null);
    if (coverageSets.length === 0) {
      console.warn(`Skipping "${group}" — no source data for any of its networks`);
      continue;
    }

    const uncovered = [];
    for (const cell of nearTrailCells) {
      const covered = coverageSets.some((s) => s.has(cell));
      if (!covered) uncovered.push(cell);
    }

    if (uncovered.length === 0) {
      console.log(`${group}: full coverage near trail — no dead zones`);
      continue;
    }

    const polys = h3.cellsToMultiPolygon(uncovered);
    // 6 decimals ≈ 11cm — far finer than an H3 res9 hex edge (~174m), so this
    // loses no visible detail while cutting the float64 JSON size substantially.
    const round = (n) => Math.round(n * 1e6) / 1e6;
    const geojson = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "MultiPolygon",
        // h3's ring points are [lat, lng] — flip to GeoJSON [lon, lat].
        coordinates: polys.map((poly) => poly.map((ring) => ring.map(([lat, lng]) => [round(lng), round(lat)]))),
      },
    };

    const outPath = join(OUTPUT_DIR, `${group}.json`);
    writeFileSync(outPath, JSON.stringify(geojson));
    const kb = (JSON.stringify(geojson).length / 1024).toFixed(0);
    console.log(`${group}: ${uncovered.length} dead cells → ${polys.length} polygon(s), ${kb} KB → ${outPath}`);
  }
}

main();
