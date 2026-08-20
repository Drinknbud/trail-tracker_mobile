import { Info, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useUnits } from "@/lib/units-context";
import { useTheme } from "@/theme/ThemeContext";

/**
 * Bottom-left trail-progress overlay — ports web's map info card
 * (components/TrailMap.tsx "Trail info overlay"): trail name, total distance,
 * distance hiked + percent, and a green progress bar. Rendered as an absolute
 * overlay over the map in the Map screen so it works for both the native and
 * web map renderers without either needing to know about it.
 *
 * Collapsed to a small info button by default — on a narrow phone screen this
 * card's full width and the bottom-right MapScaleLegend were competing for the
 * same strip along the bottom edge, forcing both to overlap/crowd. The full
 * card now only appears on tap, and closes on a second tap of the same button
 * (matches CoverageInfoSheet's tap-to-open/tap-again-to-close pattern already
 * used elsewhere on this screen, rather than introducing a new dismiss
 * gesture).
 */
export function MapProgressCard({
  name,
  totalMiles,
  completedMiles,
}: {
  name: string;
  totalMiles: number;
  completedMiles: number;
}) {
  const { colors, fontScale, scheme } = useTheme();
  const { fmtMiles } = useUnits();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  const pct = totalMiles > 0 ? Math.min(100, Math.round((completedMiles / totalMiles) * 100)) : 0;
  const track = scheme === "dark" ? "#374151" : "#E5E7EB"; // gray-700 / gray-200, matching web
  const cardBg = scheme === "dark" ? "rgba(17,24,39,0.9)" : "rgba(255,255,255,0.9)";

  if (!expanded) {
    return (
      <Pressable
        onPress={() => setExpanded(true)}
        style={{
          position: "absolute",
          left: 12,
          bottom: 28 + insets.bottom, // clears the MapLibre attribution strip + system nav, matches MapScaleLegend
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: cardBg,
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }}
      >
        <Info size={16} color={colors.text} />
      </Pressable>
    );
  }

  return (
    <View
      style={{
        position: "absolute",
        left: 12,
        bottom: 28 + insets.bottom,
        minWidth: 160,
        maxWidth: 220,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: cardBg,
        // Soft shadow ~ web's shadow-lg
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 13 * fontScale, fontWeight: "600", color: colors.text }}>
          {name}
        </Text>
        <Pressable onPress={() => setExpanded(false)} hitSlop={8} style={{ marginLeft: 6, marginTop: -1 }}>
          <X size={14} color={colors.muted} />
        </Pressable>
      </View>
      <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginTop: 1 }}>
        {fmtMiles(totalMiles)} total
      </Text>

      <View style={{ marginTop: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
          <Text style={{ fontSize: 10 * fontScale, color: colors.muted }}>
            {fmtMiles(completedMiles)} hiked
          </Text>
          <Text style={{ fontSize: 10 * fontScale, color: colors.muted }}>{pct}%</Text>
        </View>
        <View style={{ height: 6, width: "100%", borderRadius: 999, backgroundColor: track, overflow: "hidden" }}>
          <View style={{ height: "100%", width: `${pct}%`, borderRadius: 999, backgroundColor: colors.accent }} />
        </View>
      </View>
    </View>
  );
}
