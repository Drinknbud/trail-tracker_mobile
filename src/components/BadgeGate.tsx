import { router } from "expo-router";
import { Lock } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeContext";

// Mirrors web's BadgeGate (app/settings/page.tsx): cosmetic features unlock
// at an earned-badge milestone, or automatically for Premium.
export function BadgeGate({
  children,
  earned,
  required,
  isPremium,
  feature,
}: {
  children: ReactNode;
  earned: number;
  required: number;
  isPremium: boolean;
  feature: string;
}) {
  const { colors, fontScale } = useTheme();
  if (isPremium || earned >= required) return <>{children}</>;

  const remaining = required - earned;
  const pct = Math.min(100, (earned / required) * 100);

  return (
    <View
      style={{
        alignItems: "center",
        paddingVertical: 20,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        backgroundColor: colors.surface,
      }}
    >
      <Lock color={colors.muted} size={18} />
      <Text style={{ fontSize: 14 * fontScale, fontWeight: "600", color: colors.text, marginTop: 6 }}>
        {feature}
      </Text>
      <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginTop: 2, marginBottom: 10 }}>
        Earn {remaining} more badge{remaining !== 1 ? "s" : ""} to unlock
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, width: "100%", marginBottom: 10 }}>
        <View style={{ flex: 1, height: 6, borderRadius: 999, backgroundColor: colors.border, overflow: "hidden" }}>
          <View style={{ height: "100%", width: `${pct}%`, backgroundColor: colors.accent }} />
        </View>
        <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
          {earned}/{required} 🏅
        </Text>
      </View>
      <Pressable onPress={() => router.push("/upgrade")}>
        <Text style={{ fontSize: 11 * fontScale, color: colors.accent, fontWeight: "600" }}>
          Or unlock instantly with Premium →
        </Text>
      </Pressable>
    </View>
  );
}
