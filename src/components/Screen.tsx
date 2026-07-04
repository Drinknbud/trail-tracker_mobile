import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeContext";

export function Screen({
  title,
  children,
  scroll = true,
}: {
  title?: string;
  children: ReactNode;
  scroll?: boolean;
}) {
  const { colors, fontScale } = useTheme();
  const insets = useSafeAreaInsets();

  const header = title ? (
    <Text
      style={{
        fontSize: 24 * fontScale,
        fontWeight: "700",
        color: colors.text,
        marginBottom: 16,
      }}
    >
      {title}
    </Text>
  ) : null;

  if (!scroll) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 12, paddingHorizontal: 16 }}>
        {header}
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 16,
        paddingBottom: 32,
      }}
    >
      {header}
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </View>
  );
}
