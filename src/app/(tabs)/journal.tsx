import { Text } from "react-native";

import { Card, Screen } from "@/components/Screen";
import { useTheme } from "@/theme/ThemeContext";

export default function JournalScreen() {
  const { colors, fontScale } = useTheme();
  return (
    <Screen title="Trail Journal">
      <Card>
        <Text style={{ fontSize: 14 * fontScale, color: colors.text, fontWeight: "600" }}>
          Sections list coming in M3
        </Text>
        <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginTop: 4 }}>
          Planned and completed sections with offline night/day logs, synced through the outbox.
        </Text>
      </Card>
    </Screen>
  );
}
