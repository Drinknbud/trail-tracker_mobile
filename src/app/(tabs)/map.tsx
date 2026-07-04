import { Text } from "react-native";

import { Card, Screen } from "@/components/Screen";
import { useTheme } from "@/theme/ThemeContext";

export default function MapScreen() {
  const { colors, fontScale } = useTheme();
  return (
    <Screen title="Map">
      <Card>
        <Text style={{ fontSize: 14 * fontScale, color: colors.text, fontWeight: "600" }}>
          Offline map coming in M1
        </Text>
        <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginTop: 4 }}>
          MapLibre with the AT polyline, POI markers, and downloadable tile packs is the first
          milestone spike.
        </Text>
      </Card>
    </Screen>
  );
}
