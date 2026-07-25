import Constants from "expo-constants";
import { Text, View } from "react-native";

import { Card } from "@/components/Screen";
import type { SectionOnlyMapProps } from "@/components/SectionMapNative";
import { useTheme } from "@/theme/ThemeContext";

// MapLibre is a native module and cannot load inside Expo Go — it needs a
// development build (eas build --profile development). Detect Expo Go and
// show guidance instead of crashing at import time. Metro automatically
// prefers SectionMap.web.tsx over this file when bundling for web, so this
// branch only ever runs on native.
const isExpoGo = Constants.appOwnership === "expo";

export function SectionMap(props: SectionOnlyMapProps) {
  const { colors, fontScale } = useTheme();

  if (isExpoGo) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 16 }}>
        <Card>
          <Text style={{ fontSize: 14 * fontScale, fontWeight: "600", color: colors.text }}>
            The map needs the development build
          </Text>
          <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginTop: 4 }}>
            Expo Go can&apos;t load the native MapLibre module. Install the development build on
            this device, then reopen the app.
          </Text>
        </Card>
      </View>
    );
  }

  // Deferred require so Expo Go never evaluates the native module.
  const { SectionMapNative } = require("./SectionMapNative") as typeof import("./SectionMapNative");
  return <SectionMapNative {...props} />;
}
