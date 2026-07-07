import { router } from "expo-router";
import { Lock } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { Card } from "@/components/Screen";
import { useTheme } from "@/theme/ThemeContext";

/**
 * Premium lock card (the mobile PremiumGate — docs §5.5). Shown in place of
 * gated content for free-tier users, with the 14-day trial CTA.
 */
export function PremiumGate({ feature }: { feature: string }) {
  const { colors, fontScale } = useTheme();
  return (
    <Card style={{ alignItems: "center", paddingVertical: 28 }}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: colors.featurePurple,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Lock color="#FFFFFF" size={22} />
      </View>
      <Text
        style={{
          fontSize: 16 * fontScale,
          fontWeight: "700",
          color: colors.text,
          marginTop: 12,
          textAlign: "center",
        }}
      >
        {feature} is a Premium feature
      </Text>
      <Text
        style={{
          fontSize: 13 * fontScale,
          color: colors.muted,
          marginTop: 4,
          textAlign: "center",
        }}
      >
        Unlock briefings, AI planning, meal plans, night logs, and section sharing.
      </Text>
      <Pressable
        onPress={() => router.push("/upgrade")}
        style={{
          backgroundColor: colors.accent,
          borderRadius: 8,
          paddingVertical: 12,
          paddingHorizontal: 24,
          marginTop: 16,
        }}
      >
        <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 * fontScale }}>
          Start 14-day free trial
        </Text>
      </Pressable>
    </Card>
  );
}
