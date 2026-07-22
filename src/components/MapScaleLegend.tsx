import { Text, View, useWindowDimensions } from "react-native";

import { useTheme } from "@/theme/ThemeContext";

/**
 * Classic cartographic "double bar scale" — alternating black/white segments
 * sized to a round km distance, with an independent mi tick ruler above
 * (matching the reference: Mi ticks on top, Km on the bottom, segment
 * boundaries aligned to the km axis). Distinct from web's Leaflet
 * <ScaleControl>, which is a plain single-line ruler — this is a new look
 * requested specifically for mobile.
 *
 * Recomputed live from the map's current zoom + center latitude (passed in
 * by the renderer, which owns the camera) since meters-per-pixel — and so
 * the whole scale — changes continuously as the user pans/zooms.
 */

const MAX_SEGMENTS = 10;
// Sanity ceiling only (prevents an absurdly wide bar on a tablet) — NOT the
// everyday target. The bar should grow as large as the screen safely allows;
// capping it to a small fixed "ideal" width and then rounding down from THAT
// compounded into a bar much smaller (and its 10 tick labels much denser)
// than the screen actually had room for, which read as too small/cramped.
const MAX_BAR_PX = 260;
const MIN_BAR_PX = 60;
const HORIZONTAL_PADDING = 8; // each side, matches the container's paddingHorizontal below
const RIGHT_MARGIN = 12; // matches the container's `right` offset below
const LABEL_OVERHANG = 20; // "Mi"/"Km" axis labels sit left of the bar at a negative offset
const SAFETY_MARGIN = 16; // breathing room so the bar never touches the screen edge

/** Rounds DOWN to the nearest "nice" 1/2/5×10^n value <= input — the standard
 * scale-bar algorithm (round up would let the bar overshoot its target width). */
function niceNumberFloor(value: number): number {
  if (value <= 0) return 0;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / Math.pow(10, exponent);
  const niceFraction = fraction >= 10 ? 10 : fraction >= 5 ? 5 : fraction >= 2 ? 2 : 1;
  return niceFraction * Math.pow(10, exponent);
}

/** Picks how many divisions to draw for a "nice" total (always 1, 2, 5, or a
 * multiple of 10 — see niceNumberFloor) so every division is a whole number:
 * total 5 -> 5 segments of 1 each, total 50 -> 10 segments of 5 each, etc.
 * Below 1 there's no whole-number division to make at all, so it collapses
 * to a single unlabeled-subdivision block (one end label, not a fraction
 * repeated/rounded across up to 10 ticks — that repetition, at tight zoom
 * where the nice total drops under 1 mi/km, is what made the bar unreadable
 * on a narrow phone screen). */
function segmentsFor(niceTotal: number): number {
  if (niceTotal < 1) return 1;
  return Math.min(MAX_SEGMENTS, Math.round(niceTotal));
}

/** Formats a division value at the precision its own size needs — whole
 * numbers in the normal (>=1) case, one decimal in the rare sub-1 single
 * -block case (see segmentsFor) where showing "0" or "1" would misstate the
 * bar's actual physical length. */
function formatTick(value: number, unit: number): string {
  if (unit >= 1) return String(Math.round(value));
  return value.toFixed(unit < 0.1 ? 2 : 1);
}

// Meters per SCREEN pixel at a given zoom/latitude.
//
// The familiar 156543.03392 * cos(lat) / 2^zoom constant is meters-per-pixel
// for a 256 px tile scheme (Leaflet/XYZ raster convention). MapLibre — both GL
// JS and Native — defines zoom against 512 px tiles, so its world is twice as
// wide in pixels at the same zoom number and there are HALF as many meters per
// pixel. Using the 256 px form here made the bar claim twice the distance it
// actually spanned: a bar labeled "1 mi" measured half a mile on screen, so
// mile markers (correctly placed) looked ~2x too far apart for the scale — the
// long-standing "markers and scale bar disagree" bug. Hence 2^(zoom + 1).
function metersPerScreenPixel(zoom: number, latitude: number): number {
  return (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / Math.pow(2, zoom + 1);
}

function computeScale(zoom: number, latitude: number, targetBarPx: number) {
  const metersPerPixel = metersPerScreenPixel(zoom, latitude);
  const maxKm = (targetBarPx * metersPerPixel) / 1000;
  const niceTotalKm = niceNumberFloor(maxKm);
  const barPx = (niceTotalKm * 1000) / metersPerPixel;
  const kmSegments = segmentsFor(niceTotalKm);
  const segmentKm = niceTotalKm / kmSegments;
  const segmentPx = barPx / kmSegments;

  // Independent mi ruler over the same physical bar width — ticks land at
  // their own round-mile total, not at the km segment boundaries (this is
  // why the reference image's mi numbers don't line up with the checkers).
  // niceTotalMiles is the largest nice mile value that fits within the bar's
  // true length (barPx, fixed by the km side above) — so the last mi tick
  // can land a little short of the bar's right edge rather than forcing a
  // non-whole division just to reach it exactly.
  const totalMiles = (barPx * metersPerPixel) / 1609.344;
  const niceTotalMiles = niceNumberFloor(totalMiles);
  const miSegments = segmentsFor(niceTotalMiles);
  const miInterval = niceTotalMiles / miSegments;
  const miTicks: number[] = [];
  for (let i = 1; i <= miSegments; i++) miTicks.push(miInterval * i);

  return { barPx, segmentPx, segmentKm, kmSegments, totalMiles, miInterval, miTicks };
}

export function MapScaleLegend({ zoom, latitude }: { zoom: number; latitude: number }) {
  const { colors, scheme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  if (!Number.isFinite(zoom) || !Number.isFinite(latitude)) return null;

  // Target the true safe maximum for this screen — bar + padding + axis
  // labels must never exceed the actual screen width, however narrow — then
  // round DOWN from that (see niceNumberFloor) so the bar is the largest
  // nice-round size that still fits, not an arbitrarily smaller one.
  const maxAvailablePx = screenWidth - RIGHT_MARGIN - HORIZONTAL_PADDING * 2 - LABEL_OVERHANG - SAFETY_MARGIN;
  const targetBarPx = Math.max(MIN_BAR_PX, Math.min(MAX_BAR_PX, maxAvailablePx));

  const { barPx, segmentPx, segmentKm, kmSegments, totalMiles, miInterval, miTicks } = computeScale(zoom, latitude, targetBarPx);
  if (barPx <= 0) return null;

  const bg = scheme === "dark" ? "rgba(17,24,39,0.85)" : "rgba(255,255,255,0.85)";
  const line = colors.text;

  return (
    <View
      style={{
        position: "absolute",
        right: 12,
        bottom: 28, // clears the MapLibre attribution strip, matches MapProgressCard
        backgroundColor: bg,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 6,
      }}
    >
      {/* Mi ruler — ticks above the bar */}
      <View style={{ width: barPx, height: 12, marginBottom: 1 }}>
        <Text style={{ position: "absolute", left: -14, top: -1, fontSize: 9, fontWeight: "700", color: line }}>Mi</Text>
        {miTicks.map((m) => {
          const x = (m / totalMiles) * barPx;
          return (
            <View key={m} style={{ position: "absolute", left: x, alignItems: "center" }}>
              <Text style={{ fontSize: 8, color: line, transform: [{ translateX: -8 }] }}>{formatTick(m, miInterval)}</Text>
              <View style={{ width: 1, height: 3, backgroundColor: line }} />
            </View>
          );
        })}
      </View>

      {/* Alternating black/white bar — one segment per round-km division */}
      <View style={{ flexDirection: "row", width: barPx, height: 8, borderWidth: 1, borderColor: line }}>
        {Array.from({ length: kmSegments }, (_, i) => (
          <View
            key={i}
            style={{
              width: segmentPx,
              height: "100%",
              backgroundColor: i % 2 === 0 ? "#000000" : "#FFFFFF",
              borderRightWidth: i < kmSegments - 1 ? 1 : 0,
              borderColor: line,
            }}
          />
        ))}
      </View>

      {/* Km ruler — labels below, aligned to segment boundaries */}
      <View style={{ width: barPx, height: 12, marginTop: 1 }}>
        <Text style={{ position: "absolute", left: -18, top: 0, fontSize: 9, fontWeight: "700", color: line }}>Km</Text>
        {Array.from({ length: kmSegments }, (_, i) => {
          const km = segmentKm * (i + 1);
          const x = ((i + 1) / kmSegments) * barPx;
          return (
            <Text
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: 1,
                fontSize: 8,
                color: line,
                transform: [{ translateX: -8 }],
              }}
            >
              {formatTick(km, segmentKm)}
            </Text>
          );
        })}
      </View>
    </View>
  );
}
