import { Text, View } from "react-native";

import { ProgressRing } from "@/components/ProgressRing";
import { Card, Screen } from "@/components/Screen";
import { useTheme } from "@/theme/ThemeContext";

function StatCard({ label, value }: { label: string; value: string }) {
  const { colors, fontScale } = useTheme();
  return (
    <Card style={{ flex: 1, alignItems: "center", paddingVertical: 12 }}>
      <Text style={{ fontSize: 22 * fontScale, fontWeight: "700", color: colors.text }}>
        {value}
      </Text>
      <Text
        style={{
          fontSize: 11 * fontScale,
          color: colors.muted,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </Card>
  );
}

export default function DashboardScreen() {
  const { colors, fontScale } = useTheme();
  return (
    <Screen title="Dashboard">
      <Card style={{ alignItems: "center", paddingVertical: 24, marginBottom: 12 }}>
        <ProgressRing progress={0} label="of trail complete" />
        <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginTop: 16 }}>
          Sign in to sync your trail data — auth lands later in M0.
        </Text>
      </Card>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <StatCard label="Miles" value="—" />
        <StatCard label="Sections" value="—" />
        <StatCard label="Elevation" value="—" />
      </View>
    </Screen>
  );
}
