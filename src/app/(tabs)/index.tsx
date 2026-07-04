import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProgressRing } from "@/components/ProgressRing";
import { Card } from "@/components/Screen";
import { apiFetch } from "@/lib/api";
import { useAuth, type MeResponse } from "@/lib/auth";
import { useTheme } from "@/theme/ThemeContext";

function StatCard({ label, value }: { label: string; value: string }) {
  const { colors, fontScale } = useTheme();
  return (
    <Card style={{ flex: 1, alignItems: "center", paddingVertical: 12, paddingHorizontal: 8 }}>
      <Text style={{ fontSize: 20 * fontScale, fontWeight: "700", color: colors.text }}>
        {value}
      </Text>
      <Text
        style={{
          fontSize: 11 * fontScale,
          color: colors.muted,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </Card>
  );
}

export default function DashboardScreen() {
  const { colors, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setMe(await apiFetch<MeResponse>("/api/mobile/me", { token }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your trail data");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const stats = me?.stats;
  const km = me?.user.distanceUnit === "km";
  const fmtMiles = (mi: number) =>
    km ? `${(mi * 1.60934).toFixed(1)} km` : `${mi.toFixed(1)} mi`;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 16,
        paddingBottom: 32,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
    >
      <Text style={{ fontSize: 24 * fontScale, fontWeight: "700", color: colors.text }}>
        Dashboard
      </Text>
      {me?.user.trailName || me?.user.name ? (
        <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginTop: 2 }}>
          {me.user.trailName ?? me.user.name} · {me.trail?.displayName ?? "Appalachian Trail"}
        </Text>
      ) : null}

      <Card style={{ alignItems: "center", paddingVertical: 24, marginTop: 16, marginBottom: 12 }}>
        <ProgressRing progress={stats?.percentComplete ?? 0} label="of trail complete" />
        {stats ? (
          <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginTop: 16 }}>
            {fmtMiles(stats.milesCompleted)} of {fmtMiles(stats.trailMiles)}
          </Text>
        ) : error ? (
          <Text
            style={{
              fontSize: 13 * fontScale,
              color: colors.offlineAmber,
              marginTop: 16,
              textAlign: "center",
            }}
          >
            {error}
            {"\n"}Offline data comes with the Trip Download milestone.
          </Text>
        ) : (
          <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginTop: 16 }}>
            Loading your trail data…
          </Text>
        )}
      </Card>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <StatCard label="Miles" value={stats ? fmtMiles(stats.milesCompleted) : "—"} />
        <StatCard
          label="Sections"
          value={stats ? `${stats.sectionsCompleted}/${stats.sectionsCompleted + stats.sectionsPlanned}` : "—"}
        />
        <StatCard
          label="Elev Gain"
          value={stats ? `${stats.elevGainCompleted.toLocaleString()} ft` : "—"}
        />
      </View>
    </ScrollView>
  );
}
