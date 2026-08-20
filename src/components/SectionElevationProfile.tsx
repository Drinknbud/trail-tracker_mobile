import { ChevronRight, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, G, Line, Path, Polyline, Rect, Text as SvgText } from "react-native-svg";

import { Card } from "@/components/Screen";
import type { PoiRow } from "@/db";
import {
  computeAscentDescent,
  computeGradeStats,
  computeUpsDowns,
  type ElevPoint,
} from "@/lib/elevation";
import { useUnits } from "@/lib/units-context";
import { useTheme } from "@/theme/ThemeContext";

// Elevation profile for a section — a tappable mini card and a full-screen
// modal, both driven by the same SVG renderer. Mirrors web's
// SectionElevationMini / SectionElevationModal, including the GPS "you are
// here" dot fed by projectGpsToDist().

// POI types that ship in the offline package (see offline-package/route.ts).
// shelter/campsite/town/trailhead/road-crossing come from curated static
// files; peak/gap/water/parking are baked in from a live Overpass fetch at
// package-build time. Colors mirror web's SectionElevationChart POI_COLOR.
const POI_COLOR: Record<string, string> = {
  peak: "#15803D",
  gap: "#6B7280",
  shelter: "#78350F",
  campsite: "#D97706",
  water: "#0EA5E9",
  parking: "#4F46E5",
  town: "#0EA5E9",
  trailhead: "#4F46E5",
  "road-crossing": "#6B7280",
};
const POI_LABEL: Record<string, string> = {
  peak: "Summits",
  gap: "Gaps",
  shelter: "Shelters",
  campsite: "Campsites",
  water: "Water",
  parking: "Parking",
  town: "Towns",
  trailhead: "Trailheads",
  "road-crossing": "Roads",
};
const POI_SINGULAR: Record<string, string> = {
  peak: "Summit",
  gap: "Gap/Saddle",
  shelter: "Shelter",
  campsite: "Campsite",
  water: "Water",
  parking: "Parking",
  town: "Town",
  trailhead: "Trailhead",
  "road-crossing": "Road Crossing",
};
const POI_ORDER = ["peak", "gap", "shelter", "campsite", "water", "parking", "town", "trailhead", "road-crossing"];

const GRADE_BANDS = [
  { key: "flatMi", label: "Flat", hex: "#9CA3AF" },
  { key: "easyMi", label: "Easy", hex: "#22C55E" },
  { key: "moderateMi", label: "Moderate", hex: "#F59E0B" },
  { key: "steepMi", label: "Steep", hex: "#EF4444" },
] as const;

type ChartPoi = { distMi: number; type: string; name: string };

/** Badge glyph matching web's SectionElevationChart icons, drawn at (x, y) with the given badge radius. */
function poiBadgeGlyph(type: string, x: number, y: number, badgeR: number) {
  const strokeW = badgeR > 5 ? 1.8 : 1.4;
  switch (type) {
    case "shelter":
      return (
        <G>
          <Line x1={x - badgeR * 0.55} y1={y - badgeR * 0.6} x2={x - badgeR * 0.55} y2={y + badgeR * 0.6} stroke="#fff" strokeWidth={strokeW} strokeLinecap="round" />
          <Line x1={x - badgeR * 0.55} y1={y - badgeR * 0.6} x2={x + badgeR * 0.6} y2={y - badgeR * 0.1} stroke="#fff" strokeWidth={strokeW} strokeLinecap="round" />
          <Line x1={x - badgeR * 0.55} y1={y + badgeR * 0.6} x2={x + badgeR * 0.6} y2={y + badgeR * 0.6} stroke="#fff" strokeWidth={strokeW} strokeLinecap="round" />
          <Line x1={x + badgeR * 0.6} y1={y - badgeR * 0.1} x2={x + badgeR * 0.6} y2={y + badgeR * 0.6} stroke="#fff" strokeWidth={strokeW} strokeLinecap="round" />
        </G>
      );
    case "campsite":
      return (
        <G>
          <Line x1={x - badgeR * 0.55} y1={y + badgeR * 0.6} x2={x} y2={y - badgeR * 0.65} stroke="#fff" strokeWidth={strokeW} strokeLinecap="round" />
          <Line x1={x} y1={y - badgeR * 0.65} x2={x + badgeR * 0.55} y2={y + badgeR * 0.6} stroke="#fff" strokeWidth={strokeW} strokeLinecap="round" />
          <Line x1={x - badgeR * 0.55} y1={y + badgeR * 0.6} x2={x + badgeR * 0.55} y2={y + badgeR * 0.6} stroke="#fff" strokeWidth={strokeW} strokeLinecap="round" />
          <Line x1={x} y1={y - badgeR * 0.3} x2={x} y2={y + badgeR * 0.6} stroke="#fff" strokeWidth={strokeW} strokeLinecap="round" />
        </G>
      );
    case "water":
      return <SvgText x={x} y={y + badgeR * 0.4} textAnchor="middle" fontSize={badgeR * 1.3}>{"\u{1F4A7}"}</SvgText>;
    case "peak":
      return <SvgText x={x} y={y + badgeR * 0.35} textAnchor="middle" fontSize={badgeR * 1.1} fill="#fff">{"▲"}</SvgText>;
    case "gap":
      return <SvgText x={x} y={y + badgeR * 0.35} textAnchor="middle" fontSize={badgeR * 1.1} fill="#fff">{"▽"}</SvgText>;
    case "parking":
      return <SvgText x={x} y={y + badgeR * 0.35} textAnchor="middle" fontSize={badgeR * 1.05} fontWeight="800" fill="#fff">P</SvgText>;
    case "town":
      return <SvgText x={x} y={y + badgeR * 0.35} textAnchor="middle" fontSize={badgeR} fontWeight="800" fill="#fff">T</SvgText>;
    case "trailhead":
      return <SvgText x={x} y={y + badgeR * 0.35} textAnchor="middle" fontSize={badgeR * 0.85} fontWeight="800" fill="#fff">TH</SvgText>;
    case "road-crossing":
      return <SvgText x={x} y={y + badgeR * 0.35} textAnchor="middle" fontSize={badgeR} fontWeight="800" fill="#fff">R</SvgText>;
    default:
      return null;
  }
}

function gradeColor(e0: number, e1: number, d0: number, d1: number): string {
  const distFt = (d1 - d0) * 5280;
  if (distFt < 0.1) return "rgba(156,163,175,0.15)";
  const grade = Math.abs(((e1 - e0) / distFt) * 100);
  if (grade < 4) return "rgba(156,163,175,0.20)";
  if (grade < 10) return "rgba(34,197,94,0.38)";
  if (grade < 18) return "rgba(251,191,36,0.52)";
  return "rgba(239,68,68,0.58)";
}

// ─── Shared SVG renderer ─────────────────────────────────────────────────────

// px per mile in scrollable mode — mirrors web's SectionElevationChart
// (190 px/mile), just slightly tighter to fit typical phone widths.
const PX_PER_MILE = 170;

// Matches SectionMapCard's fixed preview Pressable height (180) so the two
// section-detail preview cards read as the same size side by side in the
// scroll, instead of the elevation thumbnail looking squat next to the map.
const PREVIEW_HEIGHT = 180;

function ElevSvg({
  points,
  width,
  height,
  pois,
  gpsDistMi,
  gradeColored = false,
  trailMinElevFt,
  trailMaxElevFt,
  scrollable = false,
  startMileLabel = 0,
  dayDividers,
}: {
  points: ElevPoint[];
  /** Ignored in scrollable mode — width is data-driven (PX_PER_MILE). */
  width: number;
  height: number;
  pois?: ChartPoi[];
  gpsDistMi?: number | null;
  gradeColored?: boolean;
  /** Trail-wide elevation extremes — fixes the y-axis so sections are
   * comparable across the whole trail. Falls back to this section's own
   * min/max when unavailable. */
  trailMinElevFt?: number | null;
  trailMaxElevFt?: number | null;
  /** Horizontal-scroll mode: fixed px/mile, mile-tick gridlines + labels,
   * larger POI badges. Caller is responsible for wrapping this in a
   * horizontal ScrollView — the SVG itself just renders at its full data
   * width instead of squeezing to fit `width`. */
  scrollable?: boolean;
  /** AT mile at the section start, for the tick labels' "(AT mi N)" line. */
  startMileLabel?: number;
  /** Day-divider positions — miles from section start — draws dashed
   * vertical lines + "Day N" labels (scrollable mode only). */
  dayDividers?: number[];
}) {
  const { colors, fontScale } = useTheme();
  const { fmtMiles, fmtElev, distanceUnit } = useUnits();
  // Tap-to-show tooltip on a POI badge — mirrors web's hover tooltip.
  // Only reachable in scrollable (modal) mode; the preview card wraps this
  // component in a pointerEvents="none" View so taps never land here.
  const [selectedPoi, setSelectedPoi] = useState<{ key: string; x: number; y: number; label: string; ele?: number } | null>(null);
  if (points.length < 2 || (!scrollable && width <= 0)) return <View style={{ height }} />;

  const maxDist = points[points.length - 1].dist || 1;
  const PAD = scrollable ? { t: 34, r: 14, b: 36, l: 46 } : { t: 6, r: 6, b: 6, l: 2 };
  const W = scrollable ? Math.round(maxDist * PX_PER_MILE) + PAD.l + PAD.r : width;
  const chartW = W - PAD.l - PAD.r;
  // Non-scrollable: `height` is the caller's total SVG box (H below), so
  // chartH must reserve PAD.t/PAD.b within it — previously chartH equaled
  // height directly, which put baseline (= PAD.t + chartH) 6px below the
  // bottom of a 180px-tall SVG, clipping the axis line and the bottom of the
  // filled area path entirely outside the viewport.
  const chartH = scrollable ? height : height - PAD.t - PAD.b;
  const H = scrollable ? chartH + PAD.t + PAD.b : height;
  // Modal (scrollable) badges sized to roughly match the map's own POI
  // icons (72px source PNGs at icon-size 0.41, ~30px rendered) — the
  // previous 7px radius (14px badge) read as barely-visible dots next to
  // that. Preview-card badges stay small; that thumbnail is a non-tappable
  // 180px-tall overview, not where legibility matters.
  const BADGE_R = scrollable ? 12 : 3.5;

  const elevs = points.map((p) => p.elev);
  const minElev = trailMinElevFt ?? Math.min(...elevs);
  const maxElev = trailMaxElevFt ?? Math.max(...elevs);
  const range = maxElev - minElev || 1;

  const cx = (d: number) => PAD.l + (d / maxDist) * chartW;
  const cy = (e: number) => PAD.t + chartH - ((e - minElev) / range) * chartH;
  const baseline = PAD.t + chartH;

  const linePts = points.map((p) => `${cx(p.dist).toFixed(1)},${cy(p.elev).toFixed(1)}`).join(" ");
  const lineSegs = points.map((p) => `L ${cx(p.dist).toFixed(1)} ${cy(p.elev).toFixed(1)}`).join(" ");
  const areaPath = `M ${cx(points[0].dist).toFixed(1)} ${baseline.toFixed(1)} ${lineSegs} L ${cx(maxDist).toFixed(1)} ${baseline.toFixed(1)} Z`;

  // Mile/km tick marks — scrollable mode only. AT-mile labels are always in
  // miles (the trail's own canonical numbering), independent of the user's
  // distance-unit preference for the top "distance so far" line.
  const mileTicks: { dist: number; topLabel: string; atLabel: string }[] = [];
  if (scrollable) {
    if (distanceUnit === "km") {
      const maxKm = maxDist * 1.60934;
      for (let km = 1; km <= maxKm + 0.001; km++) {
        const distMi = km / 1.60934;
        if (distMi <= maxDist + 0.001) {
          mileTicks.push({ dist: distMi, topLabel: `${km} km`, atLabel: `AT mi ${Math.round(startMileLabel + distMi)}` });
        }
      }
    } else {
      const firstWholeMile = Math.ceil(startMileLabel);
      for (let atMile = firstWholeMile; atMile <= startMileLabel + maxDist + 0.001; atMile++) {
        const distFromStart = atMile - startMileLabel;
        if (distFromStart <= maxDist + 0.001) {
          mileTicks.push({ dist: distFromStart, topLabel: fmtMiles(distFromStart), atLabel: `AT mi ${atMile}` });
        }
      }
    }
  }

  return (
    <Svg width={W} height={H}>
      {gradeColored ? (
        // Grade-banded area segments (the "suck-o-meter" look)
        points.slice(1).map((p, i) => {
          const prev = points[i];
          const x0 = cx(prev.dist);
          const x1 = cx(p.dist);
          const y0 = cy(prev.elev);
          const y1 = cy(p.elev);
          return (
            <Path
              key={i}
              d={`M ${x0.toFixed(1)},${baseline.toFixed(1)} L ${x0.toFixed(1)},${y0.toFixed(1)} L ${x1.toFixed(1)},${y1.toFixed(1)} L ${x1.toFixed(1)},${baseline.toFixed(1)} Z`}
              fill={gradeColor(prev.elev, p.elev, prev.dist, p.dist)}
            />
          );
        })
      ) : (
        <Path d={areaPath} fill={colors.trailLight} opacity={0.22} />
      )}

      {/* Mile/km gridlines (scrollable only) */}
      {scrollable && mileTicks.map((t) => (
        <Line
          key={`grid-${t.dist}`}
          x1={cx(t.dist)} y1={PAD.t}
          x2={cx(t.dist)} y2={PAD.t + chartH}
          stroke={colors.muted} strokeOpacity={0.18} strokeWidth={0.8}
        />
      ))}

      {/* Day-divider lines + "Day N" labels (scrollable only) */}
      {scrollable && dayDividers && dayDividers.length > 0 && dayDividers.map((m, i) => (
        <Line
          key={`day-${i}`}
          x1={cx(m)} y1={PAD.t - 6}
          x2={cx(m)} y2={PAD.t + chartH}
          stroke="#8B5CF6" strokeWidth={1.5} strokeDasharray="5,3" strokeOpacity={0.65}
        />
      ))}
      {scrollable && dayDividers && dayDividers.length > 0 && [0, ...dayDividers].map((start, i, arr) => {
        const end = i + 1 < arr.length ? arr[i + 1] : maxDist;
        const midX = (cx(start) + cx(end)) / 2;
        if (cx(end) - cx(start) < 50) return null;
        return (
          <SvgText key={`day-label-${i}`} x={midX} y={14} textAnchor="middle" fontSize={11 * fontScale} fontWeight="600" fill="#8B5CF6" opacity={0.85}>
            {`Day ${i + 1}`}
          </SvgText>
        );
      })}

      <Polyline points={linePts} fill="none" stroke={colors.accent} strokeWidth={scrollable ? 2.2 : 2} strokeLinejoin="round" />

      <Line x1={PAD.l} y1={baseline} x2={W - PAD.r} y2={baseline} stroke={colors.muted} strokeOpacity={0.25} strokeWidth={1} />

      {/* Y-axis elevation labels (scrollable only — thumbnail keeps its
          separate min/max text row below the chart instead) */}
      {scrollable && (
        <>
          <SvgText x={PAD.l - 6} y={PAD.t + 4} textAnchor="end" fontSize={11 * fontScale} fill={colors.muted}>
            {Math.round(maxElev).toLocaleString()}
          </SvgText>
          <SvgText x={PAD.l - 6} y={PAD.t + chartH} textAnchor="end" fontSize={11 * fontScale} fill={colors.muted}>
            {Math.round(minElev).toLocaleString()}
          </SvgText>
        </>
      )}

      {/* X-axis distance labels — two lines: distance-so-far, then AT mile (scrollable only) */}
      {scrollable && mileTicks.map((t) => (
        <SvgText key={`tick-top-${t.dist}`} x={cx(t.dist)} y={PAD.t + chartH + 16} textAnchor="middle" fontSize={11 * fontScale} fill={colors.muted}>
          {t.topLabel}
        </SvgText>
      ))}
      {scrollable && mileTicks.map((t) => (
        <SvgText key={`tick-at-${t.dist}`} x={cx(t.dist)} y={PAD.t + chartH + 30} textAnchor="middle" fontSize={9.5 * fontScale} fill={colors.muted} opacity={0.7}>
          {t.atLabel}
        </SvgText>
      ))}

      {/* POI markers — tappable to show a name + elevation tooltip (scrollable/modal only) */}
      {(() => {
        const HIT_R = BADGE_R + 6;
        const visuals = (pois ?? [])
          .map((poi, i) => {
            if (poi.distMi < 0 || poi.distMi > maxDist) return null;
            // nearest sampled elevation for the marker's y
            const near = points.reduce((b, p) => (Math.abs(p.dist - poi.distMi) < Math.abs(b.dist - poi.distMi) ? p : b));
            return { poi, i, px: cx(poi.distMi), py: cy(near.elev), ele: near.elev, label: poi.name || POI_SINGULAR[poi.type] || poi.type };
          })
          .filter((v): v is NonNullable<typeof v> => v !== null);

        // Group POIs whose (larger, transparent) hit circles overlap into a
        // single shared tap target. react-native-svg's Android hit-testing
        // (GroupView.hitTest) walks children in reverse paint order and
        // returns the first hit, not the closest one to the touch — so two
        // overlapping per-POI hit targets always resolve to whichever POI
        // was rendered last, regardless of which badge the user actually
        // tapped. Merging overlapping POIs into one marker sidesteps that
        // paint-order bug entirely instead of trying to out-guess it.
        const grouped: (typeof visuals)[] = [];
        for (const v of visuals) {
          const host = scrollable
            ? grouped.find((g) => g.some((m) => Math.hypot(m.px - v.px, m.py - v.py) < HIT_R * 2))
            : undefined;
          if (host) host.push(v);
          else grouped.push([v]);
        }

        return grouped.map((cluster) => {
          const gx = cluster.reduce((s, m) => s + m.px, 0) / cluster.length;
          const gy = cluster.reduce((s, m) => s + m.py, 0) / cluster.length;
          const key = cluster.map((m) => `${m.poi.type}-${m.i}`).join("+");
          const label = cluster.map((m) => m.label).join(", ");
          const ele = Math.round(cluster.reduce((s, m) => s + m.ele, 0) / cluster.length);
          return (
            <G
              key={key}
              onPress={
                scrollable
                  ? () =>
                      setSelectedPoi((prev) =>
                        prev?.key === key ? null : { key, x: gx, y: gy, label, ele }
                      )
                  : undefined
              }
            >
              {/* Larger transparent hit target than the visual badge(s), for easier tapping */}
              {scrollable && <Circle cx={gx} cy={gy} r={HIT_R} fill="transparent" />}
              {cluster.map((m) => (
                <Circle
                  key={`${m.poi.type}-${m.i}-badge`}
                  cx={m.px}
                  cy={m.py}
                  r={BADGE_R}
                  fill={POI_COLOR[m.poi.type] ?? colors.muted}
                  stroke="#FFFFFF"
                  strokeWidth={scrollable ? 1.5 : 1}
                />
              ))}
              {scrollable && cluster.length === 1 && poiBadgeGlyph(cluster[0].poi.type, cluster[0].px, cluster[0].py, BADGE_R)}
            </G>
          );
        });
      })()}

      {/* GPS "you are here" dot */}
      {gpsDistMi != null && gpsDistMi >= 0 && gpsDistMi <= maxDist
        ? (() => {
            const near = points.reduce((b, p) => (Math.abs(p.dist - gpsDistMi) < Math.abs(b.dist - gpsDistMi) ? p : b));
            const dx = cx(gpsDistMi);
            const dy = cy(near.elev);
            return (
              <>
                <Circle cx={dx} cy={dy} r={9} fill="#3B82F6" fillOpacity={0.25} />
                <Circle cx={dx} cy={dy} r={4.5} fill="#3B82F6" stroke="#FFFFFF" strokeWidth={1.5} />
              </>
            );
          })()
        : null}

      {/* POI tap tooltip */}
      {scrollable && selectedPoi && (() => {
        const hasEle = selectedPoi.ele != null;
        const tw = Math.max(selectedPoi.label.length * 6.5 * fontScale, (hasEle ? 82 : 60) * fontScale);
        const th = (hasEle ? 36 : 24) * fontScale;
        const tx = Math.min(Math.max(selectedPoi.x - tw / 2, PAD.l), W - PAD.r - tw);
        const ty = selectedPoi.y - BADGE_R - th - 8 < PAD.t ? selectedPoi.y + BADGE_R + 8 : selectedPoi.y - BADGE_R - th - 8;
        return (
          <G onPress={() => setSelectedPoi(null)}>
            <Rect x={tx} y={ty} width={tw} height={th} rx={5} fill="rgba(0,0,0,0.8)" />
            <SvgText x={tx + tw / 2} y={ty + 15 * fontScale} textAnchor="middle" fontSize={11 * fontScale} fill="#fff">
              {selectedPoi.label}
            </SvgText>
            {hasEle && (
              <SvgText x={tx + tw / 2} y={ty + 29 * fontScale} textAnchor="middle" fontSize={10 * fontScale} fill="#9ca3af">
                {fmtElev(selectedPoi.ele!)}
              </SvgText>
            )}
          </G>
        );
      })()}
    </Svg>
  );
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function SectionElevationProfile({
  points,
  pois,
  startMile,
  sectionName,
  miles,
  gpsDistMi,
  trailMinElevFt,
  trailMaxElevFt,
  plannedCampMiles,
}: {
  points: ElevPoint[];
  pois: PoiRow[];
  startMile: number | null;
  sectionName: string;
  miles: number;
  gpsDistMi?: number | null;
  trailMinElevFt?: number | null;
  trailMaxElevFt?: number | null;
  /** JSON string[] of absolute trail miles (SectionDetailRow.plannedCampMiles)
   * — draws a "Day N" divider on the expanded chart at each camp stop. */
  plannedCampMiles?: string | null;
}) {
  const { colors, fontScale } = useTheme();
  const { fmtMiles, fmtElev } = useUnits();
  const [cardWidth, setCardWidth] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  const chartPois = useMemo<ChartPoi[]>(() => {
    if (startMile == null) return [];
    const maxDist = points.length ? points[points.length - 1].dist : 0;
    // Exact-duplicate guard: the same name+type+mile can appear twice in the
    // source data (e.g. offline-package's Overpass POIs occasionally include
    // more than one node for the same real-world feature) — collapse those,
    // but never merge two distinct POIs that just happen to sit close
    // together (a real cluster of separate features is still useful info).
    const seen = new Set<string>();
    return pois
      .filter((p) => {
        const key = `${p.type}|${p.name}|${p.mile}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((p) => ({ distMi: Math.abs(p.mile - startMile), type: p.type, name: p.name }))
      .filter((p) => p.distMi >= 0 && p.distMi <= maxDist + 0.1);
  }, [pois, startMile, points]);

  const dayDividers = useMemo<number[]>(() => {
    if (startMile == null || !plannedCampMiles) return [];
    let campMiles: (number | null)[];
    try {
      campMiles = JSON.parse(plannedCampMiles);
    } catch {
      return [];
    }
    if (!Array.isArray(campMiles)) return [];
    return campMiles
      .filter((m): m is number => typeof m === "number")
      .map((m) => Math.abs(m - startMile))
      .sort((a, b) => a - b);
  }, [plannedCampMiles, startMile]);

  if (points.length < 2) return null;

  const elevs = points.map((p) => p.elev);
  const minElev = Math.min(...elevs);
  const maxElev = Math.max(...elevs);
  const { ascent } = computeAscentDescent(points);

  return (
    <>
      <Card style={{ marginTop: 12 }}>
        {/* Header is the tap target — a whole-card Pressable doesn't catch
            taps on web because the SVG swallows pointer events. */}
        <Pressable
          onPress={() => setModalOpen(true)}
          style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}
        >
          <Text style={{ flex: 1, fontSize: 13 * fontScale, fontWeight: "600", color: colors.text }}>
            Elevation Profile
          </Text>
          <Text style={{ fontSize: 11 * fontScale, color: colors.accent, fontWeight: "600" }}>Expand</Text>
          <ChevronRight color={colors.accent} size={14} />
        </Pressable>
        <Pressable onPress={() => setModalOpen(true)} onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}>
          <View pointerEvents="none">
            <ElevSvg
              points={points}
              width={cardWidth}
              height={PREVIEW_HEIGHT}
              pois={chartPois}
              gpsDistMi={gpsDistMi}
              trailMinElevFt={trailMinElevFt}
              trailMaxElevFt={trailMaxElevFt}
            />
          </View>
        </Pressable>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
          <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
            min {fmtElev(minElev)}
          </Text>
          <Text style={{ fontSize: 11 * fontScale, color: colors.trailLight, fontWeight: "600" }}>
            ↑ {fmtElev(ascent)}
          </Text>
          <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
            max {fmtElev(maxElev)}
          </Text>
        </View>
        {gpsDistMi != null ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: "#3B82F6", borderWidth: 1.5, borderColor: "#FFFFFF" }} />
            <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
              You&apos;re at {fmtMiles(gpsDistMi)} of {fmtMiles(miles)}
            </Text>
          </View>
        ) : null}
      </Card>

      <ElevationModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        points={points}
        pois={chartPois}
        sectionName={sectionName}
        startMile={startMile ?? 0}
        miles={miles}
        gpsDistMi={gpsDistMi}
        trailMinElevFt={trailMinElevFt}
        trailMaxElevFt={trailMaxElevFt}
        dayDividers={dayDividers}
      />
    </>
  );
}

// ─── Full-screen modal ───────────────────────────────────────────────────────

function ElevationModal({
  visible,
  onClose,
  points,
  pois,
  sectionName,
  startMile,
  miles,
  gpsDistMi,
  trailMinElevFt,
  trailMaxElevFt,
  dayDividers,
}: {
  visible: boolean;
  onClose: () => void;
  points: ElevPoint[];
  pois: ChartPoi[];
  sectionName: string;
  startMile: number;
  miles: number;
  gpsDistMi?: number | null;
  trailMinElevFt?: number | null;
  trailMaxElevFt?: number | null;
  dayDividers?: number[];
}) {
  const { colors, fontScale } = useTheme();
  const { fmtMiles, fmtElev } = useUnits();
  const insets = useSafeAreaInsets();
  const [containerWidth, setContainerWidth] = useState(0);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const presentTypes = useMemo(
    () => POI_ORDER.filter((t) => pois.some((p) => p.type === t)),
    [pois],
  );
  const visiblePois = pois.filter((p) => !hidden.has(p.type));

  const stats = computeGradeStats(points);
  const totalMi = stats.flatMi + stats.easyMi + stats.moderateMi + stats.steepMi;
  const { ups, downs } = computeUpsDowns(points);
  const { ascent, descent } = computeAscentDescent(points);

  const maxDist = points.length ? points[points.length - 1].dist : 0;
  const chartContentWidth = Math.round(maxDist * PX_PER_MILE) + 46 + 14; // mirrors ElevSvg's scrollable PAD.l/r
  const needsScrollHint = containerWidth > 0 && chartContentWidth > containerWidth + 8;

  const toggle = (t: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: "90%",
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 16, paddingBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16 * fontScale, fontWeight: "700", color: colors.text }}>{sectionName}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 3 }}>
                <Text style={{ fontSize: 12 * fontScale, color: colors.muted }}>{fmtMiles(miles)}</Text>
                {ascent > 10 ? (
                  <Text style={{ fontSize: 12 * fontScale, color: colors.trailLight, fontWeight: "600" }}>
                    ↑ {fmtElev(ascent)}
                  </Text>
                ) : null}
                {descent > 10 ? (
                  <Text style={{ fontSize: 12 * fontScale, color: colors.destructiveRed, fontWeight: "600" }}>
                    ↓ {fmtElev(descent)}
                  </Text>
                ) : null}
                {ups > 0 ? (
                  <Text style={{ fontSize: 12 * fontScale, color: colors.muted }}>
                    {ups} up · {downs} down
                  </Text>
                ) : null}
              </View>
            </View>
            <Pressable onPress={onClose} style={{ padding: 4 }}>
              <X color={colors.muted} size={20} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
            {/* Chart — horizontally scrollable at a fixed px/mile so long
                sections stay legible instead of squeezing to screen width. */}
            <View onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
              <ScrollView horizontal showsHorizontalScrollIndicator={needsScrollHint}>
                <ElevSvg
                  points={points}
                  width={containerWidth}
                  height={220}
                  pois={visiblePois}
                  gpsDistMi={gpsDistMi}
                  gradeColored
                  trailMinElevFt={trailMinElevFt}
                  trailMaxElevFt={trailMaxElevFt}
                  scrollable
                  startMileLabel={startMile}
                  dayDividers={dayDividers}
                />
              </ScrollView>
            </View>
            {needsScrollHint ? (
              <Text style={{ fontSize: 11 * fontScale, color: colors.muted, textAlign: "center", marginTop: 4 }}>
                ← Scroll for the full profile →
              </Text>
            ) : null}

            {gpsDistMi != null ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, marginTop: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#3B82F6", borderWidth: 1.5, borderColor: "#FFFFFF" }} />
                <Text style={{ fontSize: 12 * fontScale, color: colors.text }}>
                  Your position — {fmtMiles(gpsDistMi)} of {fmtMiles(miles)}
                </Text>
              </View>
            ) : null}

            {/* On the Trail — POI toggle pills */}
            {presentTypes.length > 0 ? (
              <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                <Text style={{ fontSize: 11 * fontScale, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                  On the Trail
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {presentTypes.map((t) => {
                    const count = pois.filter((p) => p.type === t).length;
                    const active = !hidden.has(t);
                    const color = POI_COLOR[t] ?? colors.muted;
                    return (
                      <Pressable
                        key={t}
                        onPress={() => toggle(t)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: active ? color : colors.border,
                          backgroundColor: active ? `${color}22` : "transparent",
                          opacity: active ? 1 : 0.5,
                        }}
                      >
                        <Svg width={18} height={18}>
                          <Circle cx={9} cy={9} r={8} fill={color} stroke="#FFFFFF" strokeWidth={1} />
                          {poiBadgeGlyph(t, 9, 9, 7)}
                        </Svg>
                        <Text style={{ fontSize: 12 * fontScale, fontWeight: "600", color: active ? color : colors.muted }}>
                          {count} {POI_LABEL[t] ?? t}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* Effort distribution */}
            {totalMi > 0.1 ? (
              <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
                <Text style={{ fontSize: 11 * fontScale, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                  Suck-O-Meter (Effort Distribution)
                </Text>
                <View style={{ flexDirection: "row", height: 30, borderRadius: 999, overflow: "hidden", gap: 1 }}>
                  {GRADE_BANDS.map(({ key, label, hex }) => {
                    const mi = stats[key];
                    const pct = (mi / totalMi) * 100;
                    if (pct < 0.5) return null;
                    return (
                      <View key={key} style={{ width: `${pct}%`, backgroundColor: hex, opacity: 0.88, alignItems: "center", justifyContent: "center" }}>
                        {pct > 12 ? (
                          <Text style={{ color: "#FFFFFF", fontSize: 10 * fontScale, fontWeight: "700" }}>{fmtMiles(mi)}</Text>
                        ) : null}
                        <Text style={{ position: "absolute", opacity: 0 }}>{label}</Text>
                      </View>
                    );
                  })}
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 8 }}>
                  {GRADE_BANDS.map(({ key, label, hex }) =>
                    stats[key] < 0.05 ? null : (
                      <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: hex, opacity: 0.85 }} />
                        <Text style={{ fontSize: 12 * fontScale, color: colors.muted }}>{label}</Text>
                      </View>
                    ),
                  )}
                </View>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
