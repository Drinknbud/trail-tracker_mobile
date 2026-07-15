import { ChevronRight, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line, Path, Polyline } from "react-native-svg";

import { Card } from "@/components/Screen";
import type { PoiRow } from "@/db";
import {
  computeAscentDescent,
  computeGradeStats,
  computeUpsDowns,
  type ElevPoint,
} from "@/lib/elevation";
import { useTheme } from "@/theme/ThemeContext";

// Elevation profile for a section — a tappable mini card and a full-screen
// modal, both driven by the same SVG renderer. Mirrors web's
// SectionElevationMini / SectionElevationModal, including the GPS "you are
// here" dot fed by projectGpsToDist().

// POI types that ship in the offline package (see offline-package/route.ts).
const POI_COLOR: Record<string, string> = {
  shelter: "#78350F",
  campsite: "#D97706",
  town: "#0EA5E9",
  trailhead: "#4F46E5",
  "road-crossing": "#6B7280",
};
const POI_LABEL: Record<string, string> = {
  shelter: "Shelters",
  campsite: "Campsites",
  town: "Towns",
  trailhead: "Trailheads",
  "road-crossing": "Roads",
};
const POI_ORDER = ["shelter", "campsite", "town", "trailhead", "road-crossing"];

const GRADE_BANDS = [
  { key: "flatMi", label: "Flat", hex: "#9CA3AF" },
  { key: "easyMi", label: "Easy", hex: "#22C55E" },
  { key: "moderateMi", label: "Moderate", hex: "#F59E0B" },
  { key: "steepMi", label: "Steep", hex: "#EF4444" },
] as const;

type ChartPoi = { distMi: number; type: string; name: string };

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

function ElevSvg({
  points,
  width,
  height,
  pois,
  gpsDistMi,
  gradeColored = false,
}: {
  points: ElevPoint[];
  width: number;
  height: number;
  pois?: ChartPoi[];
  gpsDistMi?: number | null;
  gradeColored?: boolean;
}) {
  const { colors } = useTheme();
  if (points.length < 2 || width <= 0) return <View style={{ height }} />;

  const padT = 6;
  const padB = 6;
  const padL = 2;
  const padR = 2;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const elevs = points.map((p) => p.elev);
  const minElev = Math.min(...elevs);
  const maxElev = Math.max(...elevs);
  const range = maxElev - minElev || 1;
  const maxDist = points[points.length - 1].dist || 1;

  const cx = (d: number) => padL + (d / maxDist) * chartW;
  const cy = (e: number) => padT + chartH - ((e - minElev) / range) * chartH;
  const baseline = padT + chartH;

  const linePts = points.map((p) => `${cx(p.dist).toFixed(1)},${cy(p.elev).toFixed(1)}`).join(" ");
  const lineSegs = points.map((p) => `L ${cx(p.dist).toFixed(1)} ${cy(p.elev).toFixed(1)}`).join(" ");
  const areaPath = `M ${cx(points[0].dist).toFixed(1)} ${baseline.toFixed(1)} ${lineSegs} L ${cx(maxDist).toFixed(1)} ${baseline.toFixed(1)} Z`;

  return (
    <Svg width={width} height={height}>
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

      <Polyline points={linePts} fill="none" stroke={colors.accent} strokeWidth={2} strokeLinejoin="round" />

      <Line x1={padL} y1={baseline} x2={width - padR} y2={baseline} stroke={colors.muted} strokeOpacity={0.25} strokeWidth={1} />

      {/* POI markers */}
      {pois?.map((poi, i) => {
        if (poi.distMi < 0 || poi.distMi > maxDist) return null;
        // nearest sampled elevation for the marker's y
        const near = points.reduce((b, p) => (Math.abs(p.dist - poi.distMi) < Math.abs(b.dist - poi.distMi) ? p : b));
        return (
          <Circle
            key={`${poi.type}-${i}`}
            cx={cx(poi.distMi)}
            cy={cy(near.elev)}
            r={3.5}
            fill={POI_COLOR[poi.type] ?? colors.muted}
            stroke="#FFFFFF"
            strokeWidth={1}
          />
        );
      })}

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
}: {
  points: ElevPoint[];
  pois: PoiRow[];
  startMile: number | null;
  sectionName: string;
  miles: number;
  gpsDistMi?: number | null;
}) {
  const { colors, fontScale } = useTheme();
  const [cardWidth, setCardWidth] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  const chartPois = useMemo<ChartPoi[]>(() => {
    if (startMile == null) return [];
    const maxDist = points.length ? points[points.length - 1].dist : 0;
    return pois
      .map((p) => ({ distMi: Math.abs(p.mile - startMile), type: p.type, name: p.name }))
      .filter((p) => p.distMi >= 0 && p.distMi <= maxDist + 0.1);
  }, [pois, startMile, points]);

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
            <ElevSvg points={points} width={cardWidth} height={110} pois={chartPois} gpsDistMi={gpsDistMi} />
          </View>
        </Pressable>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
          <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
            min {Math.round(minElev).toLocaleString()} ft
          </Text>
          <Text style={{ fontSize: 11 * fontScale, color: colors.trailLight, fontWeight: "600" }}>
            ↑ {Math.round(ascent).toLocaleString()} ft
          </Text>
          <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
            max {Math.round(maxElev).toLocaleString()} ft
          </Text>
        </View>
        {gpsDistMi != null ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: "#3B82F6", borderWidth: 1.5, borderColor: "#FFFFFF" }} />
            <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
              You&apos;re at mile {(gpsDistMi).toFixed(1)} of {miles.toFixed(1)}
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
        miles={miles}
        gpsDistMi={gpsDistMi}
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
  miles,
  gpsDistMi,
}: {
  visible: boolean;
  onClose: () => void;
  points: ElevPoint[];
  pois: ChartPoi[];
  sectionName: string;
  miles: number;
  gpsDistMi?: number | null;
}) {
  const { colors, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const [chartWidth, setChartWidth] = useState(0);
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
                <Text style={{ fontSize: 12 * fontScale, color: colors.muted }}>{miles.toFixed(1)} mi</Text>
                {ascent > 10 ? (
                  <Text style={{ fontSize: 12 * fontScale, color: colors.trailLight, fontWeight: "600" }}>
                    ↑ {Math.round(ascent).toLocaleString()} ft
                  </Text>
                ) : null}
                {descent > 10 ? (
                  <Text style={{ fontSize: 12 * fontScale, color: colors.destructiveRed, fontWeight: "600" }}>
                    ↓ {Math.round(descent).toLocaleString()} ft
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
            {/* Chart */}
            <View style={{ paddingHorizontal: 16 }} onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
              <ElevSvg points={points} width={chartWidth} height={240} pois={visiblePois} gpsDistMi={gpsDistMi} gradeColored />
            </View>

            {gpsDistMi != null ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, marginTop: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#3B82F6", borderWidth: 1.5, borderColor: "#FFFFFF" }} />
                <Text style={{ fontSize: 12 * fontScale, color: colors.text }}>
                  Your position — mile {gpsDistMi.toFixed(1)} of {miles.toFixed(1)}
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
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, borderWidth: 1, borderColor: "#FFFFFF" }} />
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
                  Effort Distribution
                </Text>
                <View style={{ flexDirection: "row", height: 30, borderRadius: 999, overflow: "hidden", gap: 1 }}>
                  {GRADE_BANDS.map(({ key, label, hex }) => {
                    const mi = stats[key];
                    const pct = (mi / totalMi) * 100;
                    if (pct < 0.5) return null;
                    return (
                      <View key={key} style={{ width: `${pct}%`, backgroundColor: hex, opacity: 0.88, alignItems: "center", justifyContent: "center" }}>
                        {pct > 12 ? (
                          <Text style={{ color: "#FFFFFF", fontSize: 10 * fontScale, fontWeight: "700" }}>{mi.toFixed(1)}</Text>
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
