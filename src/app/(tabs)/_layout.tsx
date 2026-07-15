import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";

import { FlyoutTabBar } from "@/components/FlyoutTabBar";
import { TrailMailFab } from "@/components/TrailMailFab";
import { useAuth } from "@/lib/auth";

// The bar itself lives in FlyoutTabBar (nav v2): planning mode shows a
// category dock with slide-up flyouts; On Trail mode shows the flat field
// bar. All six routes stay registered here so both modes (and deep links)
// can reach them regardless of which bar is showing.

export default function TabsLayout() {
  const { token, isLoading } = useAuth();

  // Wait for SecureStore hydration before deciding — avoids a sign-in flash
  if (isLoading) return null;
  if (!token) return <Redirect href="/auth" />;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <FlyoutTabBar state={props.state} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="journal" />
        <Tabs.Screen name="scout" />
        <Tabs.Screen name="map" />
        <Tabs.Screen name="briefing" />
        <Tabs.Screen name="more" />
      </Tabs>
      <TrailMailFab />
    </View>
  );
}
