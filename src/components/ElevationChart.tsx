import { useState } from "react";
import { Text, View } from "react-native";
import Svg, { Path, Polyline } from "react-native-svg";

import { useUnits } from "@/lib/units-context";
import { useTheme } from "@/theme/ThemeContext";

export function ElevationChart({
  points,
  height = 120,
  trailMinElevFt,
  trailMaxElevFt,
}: {
  points: { dist: number; elev: number }[];
  height?: number;
  /** Trail-wide elevation extremes (not this section's own min/max) — fixes
   * the y-axis scale so sections are comparable across the whole trail. */
  trailMinElevFt?: number | null;
  trailMaxElevFt?: number | null;
}) {
  const { colors, fontScale } = useTheme();
  const { fmtElev } = useUnits();
  const [width, setWidth] = useState(0);

  if (points.length < 2) return null;

  const elevs = points.map((p) => p.elev);
  // Labels always show this section's own min/max/gain; the axis scale uses
  // the trail-wide extremes when available so charts are comparable.
  const min = Math.min(...elevs);
  const max = Math.max(...elevs);
  const scaleMin = trailMinElevFt ?? min;
  const scaleMax = trailMaxElevFt ?? max;
  const gain = points.reduce(
    (sum, p, i) => (i > 0 && p.elev > points[i - 1].elev ? sum + (p.elev - points[i - 1].elev) : sum),
    0
  );
  const maxDist = points[points.length - 1].dist || 1;
  const range = scaleMax - scaleMin || 1;

  const pad = 4;
  const coords = points.map((p) => {
    const x = pad + (p.dist / maxDist) * (width - pad * 2);
    const y = pad + (1 - (p.elev - scaleMin) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const areaPath = `M ${coords[0]} L ${coords.join(" L ")} L ${(width - pad).toFixed(1)},${height - pad} L ${pad},${height - pad} Z`;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Path d={areaPath} fill={colors.trailLight} opacity={0.25} />
          <Polyline
            points={coords.join(" ")}
            fill="none"
            stroke={colors.accent}
            strokeWidth={2}
          />
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
          min {fmtElev(min)}
        </Text>
        <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
          +{fmtElev(gain)} gain
        </Text>
        <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
          max {fmtElev(max)}
        </Text>
      </View>
    </View>
  );
}
