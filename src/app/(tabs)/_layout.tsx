import { Redirect, Tabs } from "expo-router";
import { BookOpen, LayoutDashboard, MapPin, Menu, Sun } from "lucide-react-native";

import { useAuth } from "@/lib/auth";
import { useTheme } from "@/theme/ThemeContext";

export default function TabsLayout() {
  const { colors } = useTheme();
  const { token, isLoading } = useAuth();

  // Wait for SecureStore hydration before deciding — avoids a sign-in flash
  if (isLoading) return null;
  if (!token) return <Redirect href="/auth" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: "Journal",
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size }) => <MapPin color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="briefing"
        options={{
          title: "Briefing",
          tabBarIcon: ({ color, size }) => <Sun color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => <Menu color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
