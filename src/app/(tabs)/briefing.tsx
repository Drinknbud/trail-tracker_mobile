import { Text } from "react-native";

import { Card, Screen } from "@/components/Screen";
import { useTheme } from "@/theme/ThemeContext";

export default function BriefingScreen() {
  const { colors, fontScale } = useTheme();
  return (
    <Screen title="Morning Briefing">
      <Card>
        <Text style={{ fontSize: 14 * fontScale, color: colors.text, fontWeight: "600" }}>
          Briefings coming in M4
        </Text>
        <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginTop: 4 }}>
          AI narrative, weather tiles, elevation chart, and POIs — rendered fully offline from the
          trip download.
        </Text>
      </Card>
    </Screen>
  );
}
