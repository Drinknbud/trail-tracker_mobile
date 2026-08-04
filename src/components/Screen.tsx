import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
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
  // Floor, not just insets.top: on some Android devices/OS versions,
  // useSafeAreaInsets briefly reports top:0 while the window is mid-resize
  // for the on-screen keyboard (a react-native-safe-area-context quirk with
  // windowSoftInputMode="adjustResize"), which pushes the header straight
  // under the status bar/clock. A status bar is never shorter than this on
  // any real device, so the floor is a no-op everywhere else.
  const topInset = Math.max(insets.top, 24);

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
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: topInset + 12, paddingHorizontal: 16 }}>
        {header}
        {children}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={topInset}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{
          paddingTop: topInset + 12,
          paddingHorizontal: 16,
          paddingBottom: 32,
        }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {header}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
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
