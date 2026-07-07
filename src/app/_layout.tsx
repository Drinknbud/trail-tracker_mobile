import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { OutboxSyncManager } from "@/components/OutboxSyncManager";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider, useTheme } from "@/theme/ThemeContext";

function RootNavigator() {
  const { scheme, colors } = useTheme();

  // Tapping a morning-briefing notification lands on the Briefing tab
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      router.push("/briefing");
    });
    return () => sub.remove();
  }, []);

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <OutboxSyncManager />
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
