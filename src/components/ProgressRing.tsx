import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { useTheme } from "@/theme/ThemeContext";

export function ProgressRing({
  progress,
  size = 160,
  strokeWidth = 14,
  label,
}: {
  progress: number; // 0..1
  size?: number;
  strokeWidth?: number;
  label?: string;
}) {
  const { colors, fontScale } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.accent}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={{ fontSize: 28 * fontScale, fontWeight: "700", color: colors.text }}>
          {Math.round(clamped * 100)}%
        </Text>
        {label ? (
          <Text style={{ fontSize: 12 * fontScale, color: colors.muted }}>{label}</Text>
        ) : null}
      </View>
    </View>
  );
}
