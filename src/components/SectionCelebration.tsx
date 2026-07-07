import { useMemo } from "react";
import { Dimensions, Modal, Pressable, Text, View } from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";

import { useTheme } from "@/theme/ThemeContext";

// Web app celebration palette (requirements F10)
const CONFETTI_COLORS = [
  "#4ade80",
  "#22c55e",
  "#86efac",
  "#ffffff",
  "#fbbf24",
  "#a3e635",
  "#f472b6",
  "#60a5fa",
];

export function SectionCelebration({
  visible,
  sectionName,
  miles,
  elevGain,
  onClose,
}: {
  visible: boolean;
  sectionName: string;
  miles: number;
  elevGain: number | null;
  onClose: () => void;
}) {
  const { colors, fontScale } = useTheme();
  const { width } = useMemo(() => Dimensions.get("window"), []);

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.7)",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 16,
            padding: 24,
            alignItems: "center",
            width: "100%",
            maxWidth: 360,
          }}
        >
          <Text style={{ fontSize: 44 }}>🥾</Text>
          <Text
            style={{
              fontSize: 22 * fontScale,
              fontWeight: "700",
              color: colors.text,
              textAlign: "center",
              marginTop: 8,
            }}
          >
            Section Complete!
          </Text>
          <Text
            style={{
              fontSize: 14 * fontScale,
              color: colors.muted,
              textAlign: "center",
              marginTop: 4,
            }}
          >
            {sectionName}
          </Text>
          <View style={{ flexDirection: "row", gap: 24, marginTop: 16 }}>
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 20 * fontScale, fontWeight: "700", color: colors.accent }}>
                {miles.toFixed(1)}
              </Text>
              <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>MILES</Text>
            </View>
            {elevGain ? (
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 20 * fontScale, fontWeight: "700", color: colors.accent }}>
                  {elevGain.toLocaleString()}
                </Text>
                <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>FT GAIN</Text>
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={onClose}
            style={{
              backgroundColor: colors.accent,
              borderRadius: 8,
              paddingVertical: 12,
              paddingHorizontal: 32,
              marginTop: 20,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14 * fontScale }}>
              Keep hiking
            </Text>
          </Pressable>
        </View>

        <ConfettiCannon
          count={90}
          origin={{ x: 0, y: 0 }}
          colors={CONFETTI_COLORS}
          explosionSpeed={420}
          fallSpeed={2600}
          fadeOut
        />
        <ConfettiCannon
          count={90}
          origin={{ x: width, y: 0 }}
          colors={CONFETTI_COLORS}
          explosionSpeed={420}
          fallSpeed={2600}
          fadeOut
        />
      </View>
    </Modal>
  );
}
