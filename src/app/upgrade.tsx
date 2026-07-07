import { router } from "expo-router";
import { ArrowLeft, Bot, Check, Mountain, Moon, Sun, Users } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Card, Screen } from "@/components/Screen";
import { usePremium } from "@/lib/usePremium";
import { purchasePremium, restorePurchases } from "@/lib/purchases";
import { useTheme } from "@/theme/ThemeContext";

const FEATURES = [
  { icon: Sun, text: "Morning briefings — AI narrative, weather, and terrain each day" },
  { icon: Bot, text: "AI trip planning: itineraries, gear lists, and details" },
  { icon: Mountain, text: "Meal planning with calorie targets" },
  { icon: Moon, text: "Night logs — record every camp" },
  { icon: Users, text: "Section sharing and party invites" },
];

export default function UpgradeScreen() {
  const { colors, fontScale } = useTheme();
  const { isPremium, refresh } = usePremium();
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const buy = async () => {
    setBusy(true);
    try {
      const res = await purchasePremium();
      setNotice(res.message);
      if (res.success) await refresh();
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      const res = await restorePurchases();
      setNotice(res.message);
      if (res.success) await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Pressable
        onPress={() => router.back()}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}
      >
        <ArrowLeft color={colors.accent} size={20} />
        <Text style={{ color: colors.accent, fontSize: 14 * fontScale, fontWeight: "600" }}>
          Back
        </Text>
      </Pressable>

      <Text style={{ fontSize: 26 * fontScale, fontWeight: "700", color: colors.text }}>
        Trail Tracker Premium
      </Text>
      <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginTop: 4, marginBottom: 16 }}>
        {isPremium
          ? "You're Premium — thanks for hiking with us. 🥾"
          : "Everything you need for the trail, on and offline."}
      </Text>

      <Card style={{ marginBottom: 12 }}>
        {FEATURES.map(({ icon: Icon, text }, i) => (
          <View
            key={text}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingVertical: 8,
              borderBottomWidth: i === FEATURES.length - 1 ? 0 : 1,
              borderBottomColor: colors.border,
            }}
          >
            <Icon color={colors.accent} size={18} />
            <Text style={{ flex: 1, fontSize: 13 * fontScale, color: colors.text }}>{text}</Text>
            <Check color={colors.completed} size={16} />
          </View>
        ))}
      </Card>

      {!isPremium ? (
        <>
          <Card style={{ marginBottom: 12, alignItems: "center", paddingVertical: 18 }}>
            <Text style={{ fontSize: 22 * fontScale, fontWeight: "700", color: colors.text }}>
              $4.58/mo
            </Text>
            <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginTop: 2 }}>
              billed annually at $54.99 · or $7.99 month-to-month
            </Text>
            <Text style={{ fontSize: 12 * fontScale, color: colors.accent, marginTop: 6, fontWeight: "600" }}>
              First 14 days free
            </Text>
          </Card>

          <Pressable
            onPress={buy}
            disabled={busy}
            style={{
              backgroundColor: colors.accent,
              borderRadius: 8,
              paddingVertical: 14,
              alignItems: "center",
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 * fontScale }}>
              Start free trial
            </Text>
          </Pressable>
          <Pressable onPress={restore} disabled={busy} style={{ paddingVertical: 14, alignItems: "center" }}>
            <Text style={{ color: colors.muted, fontSize: 13 * fontScale }}>Restore purchases</Text>
          </Pressable>
        </>
      ) : null}

      {notice ? (
        <Text
          style={{
            fontSize: 13 * fontScale,
            color: colors.offlineAmber,
            textAlign: "center",
            marginTop: 4,
          }}
        >
          {notice}
        </Text>
      ) : null}
    </Screen>
  );
}
