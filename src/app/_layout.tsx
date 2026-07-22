import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { OnTrailActivationSheet } from "@/components/OnTrailActivationSheet";
import { OutboxSyncManager } from "@/components/OutboxSyncManager";
import { AuthProvider } from "@/lib/auth";
import { UnitsProvider } from "@/lib/units-context";
import { getNotifications } from "@/lib/notifications-safe";
import { OnTrailProvider } from "@/lib/onTrail";
import { ThemeProvider, useTheme } from "@/theme/ThemeContext";

function RootNavigator() {
  const { scheme, colors } = useTheme();

  // Tapping a morning-briefing notification lands on the Briefing tab
  useEffect(() => {
    if (Platform.OS === "web") return;
    const Notifications = getNotifications();
    if (!Notifications) return;
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
          <UnitsProvider>
            <OnTrailProvider>
              <OutboxSyncManager />
              <RootNavigator />
              <OnTrailActivationSheet />
            </OnTrailProvider>
          </UnitsProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
