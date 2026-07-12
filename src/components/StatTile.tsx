import type { LucideIcon } from "lucide-react-native";
import { Text, View } from "react-native";

import { Card } from "@/components/Screen";
import { useTheme } from "@/theme/ThemeContext";

// Matches the web dashboard's StatCard: icon + label row, big value,
// small caption — not the plain number-only tile the mobile app had before.
export function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  accent = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  const { colors, fontScale } = useTheme();
  return (
    <Card style={{ flex: 1, minWidth: "45%" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <Icon color={accent ? colors.accent : colors.muted} size={16} />
        <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>{label}</Text>
      </View>
      <Text
        style={{
          fontSize: 22 * fontScale,
          fontWeight: "700",
          color: accent ? colors.accent : colors.text,
        }}
      >
        {value}
      </Text>
      {sub ? (
        <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginTop: 2 }}>{sub}</Text>
      ) : null}
    </Card>
  );
}
