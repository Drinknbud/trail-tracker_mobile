import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { useTheme } from "@/theme/ThemeContext";

// Matches the web dashboard's donut exactly (app/dashboard/page.tsx RingChart):
// radius 38 on a 100×100 viewBox, 9px stroke, rotated -90° so it starts at 12 o'clock.
export function RingChart({
  pct,
  completedLabel,
  totalLabel,
  size = 144,
}: {
  pct: number;
  completedLabel: string;
  totalLabel: string;
  size?: number;
}) {
  const { colors, fontScale } = useTheme();
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.min(Math.max(pct, 0), 100) / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={50} cy={50} r={radius} fill="none" stroke={colors.border} strokeWidth={9} />
        <Circle
          cx={50}
          cy={50}
          r={radius}
          fill="none"
          stroke={colors.accent}
          strokeWidth={9}
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={{ fontSize: 24 * fontScale, fontWeight: "700", color: colors.text }}>
          {pct}%
        </Text>
        <Text style={{ fontSize: 10 * fontScale, color: colors.muted }}>
          {completedLabel} / {totalLabel}
        </Text>
      </View>
    </View>
  );
}
