import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  Calendar,
  ChevronRight,
  Flag,
  Gauge,
  MapPin,
  Mountain,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CompassBadge, DIRECTION_LABEL } from "@/components/CompassBadge";
import { RingChart } from "@/components/RingChart";
import { Card } from "@/components/Screen";
import { StatTile } from "@/components/StatTile";
import { TrailBadge } from "@/components/TrailBadge";
import { Wordmark } from "@/components/Wordmark";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { heroContentPosition } from "@/lib/heroPosition";
import { fetchStats, fetchTrails, fetchWebUser, type WebStats, type WebTrail, type WebUser } from "@/lib/webApi";
import { useTheme } from "@/theme/ThemeContext";

function fmtMiles(mi: number, unit: string): string {
  return unit === "km" ? `${(mi * 1.60934).toFixed(1)} km` : `${mi.toFixed(1)} mi`;
}

export default function DashboardScreen() {
  const { colors, fontScale, setAccentColor } = useTheme();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [stats, setStats] = useState<WebStats | null>(null);
  const [user, setUser] = useState<WebUser | null>(null);
  const [activeTrail, setActiveTrail] = useState<WebTrail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [s, u, trails] = await Promise.all([
        fetchStats(token),
        fetchWebUser(token),
        fetchTrails(token),
      ]);
      setStats(s);
      setUser(u);
      setActiveTrail(trails.find((t) => t.isActive) ?? trails[0] ?? null);
      setAccentColor(u.accentColor);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your trail data");
    }
  }, [token, setAccentColor]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const saveGoal = async () => {
    if (!activeTrail || !token) return;
    setSavingGoal(true);
    try {
      await apiFetch(`/api/trails/${activeTrail.id}`, {
        method: "PATCH",
        token,
        body: { plannedCompletionDate: goalInput || null },
      });
      setEditingGoal(false);
      await load();
    } catch {
      // Goal date is a nice-to-have — silently leave the editor open on failure
    } finally {
      setSavingGoal(false);
    }
  };

  const clearGoal = async () => {
    if (!activeTrail || !token) return;
    await apiFetch(`/api/trails/${activeTrail.id}`, {
      method: "PATCH",
      token,
      body: { plannedCompletionDate: null },
    });
    await load();
  };

  const unit = user?.distanceUnit ?? "mi";
  const pct = stats ? Math.round(stats.percentComplete) : 0;
  const displayName = user?.trailName || user?.name || "Hiker";

  const headerBadge = <TrailBadge catalogKey={stats?.trailCatalogKey} size={56} />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
    >
      {/* Hero / header */}
      {user?.heroImage ? (
        <View style={{ height: 220, width: "100%" }}>
          <ExpoImage
            source={{ uri: user.heroImage }}
            style={{ position: "absolute", width: "100%", height: "100%" }}
            contentFit="cover"
            contentPosition={heroContentPosition(user.heroImagePosition ?? "50% 50%")}
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.2)", "rgba(0,0,0,0.65)"]}
            style={{ position: "absolute", width: "100%", height: "100%" }}
          />
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              flexDirection: "row",
              alignItems: "flex-end",
              gap: 12,
              padding: 20,
            }}
          >
            {headerBadge}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20 * fontScale, fontWeight: "700", color: "#FFFFFF" }}>
                Welcome back, {displayName}
              </Text>
              <Text style={{ fontSize: 13 * fontScale, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>
                Your {stats?.trailName ?? "trail"} progress
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20 }}>
          <Wordmark height={22} />
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: 16 }}>
            {headerBadge}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20 * fontScale, fontWeight: "700", color: colors.text }}>
                Welcome back, {displayName}
              </Text>
              <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginTop: 2 }}>
                Your {stats?.trailName ?? "trail"} progress
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={{ padding: 16, gap: 12 }}>
        {error && !stats ? (
          <Card>
            <Text style={{ fontSize: 13 * fontScale, color: colors.offlineAmber }}>{error}</Text>
          </Card>
        ) : null}

        {/* Progress card */}
        <Card>
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <RingChart
              pct={pct}
              completedLabel={fmtMiles(stats?.milesCompleted ?? 0, unit)}
              totalLabel={fmtMiles(stats?.totalMiles ?? 0, unit)}
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <TrailBadge catalogKey={stats?.trailCatalogKey} size={22} />
            <Text style={{ fontSize: 13 * fontScale, fontWeight: "600", color: colors.text }}>
              {stats?.trailShortName ?? "Trail"} Progress
            </Text>
            {stats?.trailCompleted ? <Trophy color={colors.badgeGold} size={16} /> : null}
            <View style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 4 }}>
              <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
                {DIRECTION_LABEL[activeTrail?.hikeDirection ?? "NOBO"]}
              </Text>
              <CompassBadge direction={activeTrail?.hikeDirection ?? "NOBO"} />
            </View>
          </View>

          <View
            style={{
              height: 10,
              borderRadius: 999,
              backgroundColor: colors.border,
              overflow: "hidden",
              marginBottom: 6,
            }}
          >
            <View
              style={{
                height: "100%",
                width: `${Math.min(pct, 100)}%`,
                backgroundColor: colors.accent,
                borderRadius: 999,
              }}
            />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
            <Text style={{ fontSize: 10 * fontScale, color: colors.muted }} numberOfLines={1}>
              {stats?.startPoint}
            </Text>
            <Text style={{ fontSize: 10 * fontScale, color: colors.muted }} numberOfLines={1}>
              {stats?.endPoint}
            </Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: 12 }}>
            <Text style={{ fontSize: 12 * fontScale }}>
              <Text style={{ fontWeight: "700", color: colors.accent }}>
                {fmtMiles(stats?.milesCompleted ?? 0, unit)}
              </Text>
              <Text style={{ color: colors.muted }}> done</Text>
            </Text>
            <Text style={{ fontSize: 12 * fontScale }}>
              <Text style={{ fontWeight: "700", color: colors.text }}>
                {fmtMiles(stats?.milesRemaining ?? 0, unit)}
              </Text>
              <Text style={{ color: colors.muted }}> remaining</Text>
            </Text>
            {stats?.milesPlanned ? (
              <Text style={{ fontSize: 12 * fontScale }}>
                <Text style={{ fontWeight: "700", color: colors.planned }}>
                  {fmtMiles(stats.milesPlanned, unit)}
                </Text>
                <Text style={{ color: colors.muted }}> planned</Text>
              </Text>
            ) : null}
          </View>

          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingTop: 10,
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <Target color={colors.muted} size={14} />
            <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>Goal:</Text>
            {editingGoal ? (
              <>
                <TextInputGoal value={goalInput} onChangeText={setGoalInput} />
                <Pressable onPress={saveGoal} disabled={savingGoal}>
                  <Text style={{ fontSize: 11 * fontScale, color: colors.accent, fontWeight: "600" }}>
                    {savingGoal ? "Saving…" : "Save"}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setEditingGoal(false)}>
                  <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>Cancel</Text>
                </Pressable>
              </>
            ) : activeTrail?.plannedCompletionDate ? (
              <>
                <Text style={{ fontSize: 11 * fontScale, fontWeight: "600", color: colors.text }}>
                  {new Date(activeTrail.plannedCompletionDate.slice(0, 10) + "T12:00:00").toLocaleDateString(
                    "en-US",
                    { month: "long", day: "numeric", year: "numeric" }
                  )}
                </Text>
                <Pressable
                  onPress={() => {
                    setGoalInput(activeTrail.plannedCompletionDate?.slice(0, 10) ?? "");
                    setEditingGoal(true);
                  }}
                >
                  <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>Edit</Text>
                </Pressable>
                <Pressable onPress={clearGoal}>
                  <Text style={{ fontSize: 11 * fontScale, color: colors.destructiveRed }}>Clear</Text>
                </Pressable>
              </>
            ) : (
              <Pressable onPress={() => { setGoalInput(""); setEditingGoal(true); }}>
                <Text style={{ fontSize: 11 * fontScale, color: colors.accent, fontWeight: "600" }}>
                  + Set goal date
                </Text>
              </Pressable>
            )}
          </View>
        </Card>

        {/* Stat tiles — 2-column grid */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <StatTile
            icon={TrendingUp}
            label="Distance Hiked"
            value={fmtMiles(stats?.milesCompleted ?? 0, unit)}
            sub={`of ${fmtMiles(stats?.totalMiles ?? 0, unit)} total`}
            accent
          />
          <StatTile
            icon={Flag}
            label="Distance Remaining"
            value={fmtMiles(stats?.milesRemaining ?? 0, unit)}
            sub={`${pct}% complete`}
          />
          <StatTile
            icon={Gauge}
            label="Avg Pace"
            value={stats?.avgPaceMilesPerDay ? `${fmtMiles(stats.avgPaceMilesPerDay, unit)}/day` : "—"}
            sub={`${unit === "km" ? "km" : "miles"} per day`}
          />
          <StatTile
            icon={Mountain}
            label="Elev. Gain"
            value={stats?.elevGainTotal ? `${stats.elevGainTotal.toLocaleString()} ft` : "—"}
            sub="total accumulated"
          />
          <StatTile
            icon={MapPin}
            label="Sections Done"
            value={`${stats?.sectionsCompleted ?? 0}`}
            sub={`${stats?.sectionsPlanned ?? 0} planned`}
          />
          <StatTile
            icon={Calendar}
            label={`Distance Hiked ${new Date().getFullYear()}`}
            value={fmtMiles(stats?.milesThisYear ?? 0, unit)}
            sub="completed sections this year"
          />
        </View>

        {/* Recent + Next Up */}
        <View style={{ gap: 12 }}>
          {stats?.recentSection ? (
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Calendar color={colors.accent} size={15} />
                <Text style={{ fontSize: 13 * fontScale, fontWeight: "600", color: colors.text }}>
                  Most Recent Hike
                </Text>
              </View>
              <Text style={{ fontSize: 14 * fontScale, fontWeight: "700", color: colors.text }} numberOfLines={1}>
                {stats.recentSection.name}
              </Text>
              <Text style={{ fontSize: 12 * fontScale, color: colors.muted }}>
                {fmtMiles(stats.recentSection.miles, unit)}
              </Text>
              {stats.recentSection.endDate ? (
                <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginTop: 2 }}>
                  {new Date(stats.recentSection.endDate).toLocaleDateString()}
                </Text>
              ) : null}
              <Pressable
                onPress={() => router.push("/journal")}
                style={{ flexDirection: "row", alignItems: "center", gap: 2, marginTop: 10 }}
              >
                <Text style={{ fontSize: 12 * fontScale, color: colors.accent, fontWeight: "600" }}>
                  View all sections
                </Text>
                <ChevronRight color={colors.accent} size={13} />
              </Pressable>
            </Card>
          ) : null}

          {stats?.nextPlannedSection ? (
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Flag color={colors.planned} size={15} />
                <Text style={{ fontSize: 13 * fontScale, fontWeight: "600", color: colors.text }}>
                  Next Up
                </Text>
              </View>
              <Text style={{ fontSize: 14 * fontScale, fontWeight: "700", color: colors.text }} numberOfLines={1}>
                {stats.nextPlannedSection.name}
              </Text>
              <Text style={{ fontSize: 12 * fontScale, color: colors.muted }}>
                {fmtMiles(stats.nextPlannedSection.miles, unit)} planned
              </Text>
              {stats.nextPlannedSection.startDate ? (
                <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginTop: 2 }}>
                  {new Date(stats.nextPlannedSection.startDate).toLocaleDateString()}
                </Text>
              ) : null}
            </Card>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

// Inline so the goal-edit row doesn't need the full FormField chrome
function TextInputGoal({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (v: string) => void;
}) {
  const { colors, fontScale } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder="YYYY-MM-DD"
      placeholderTextColor={colors.muted}
      style={{
        fontSize: 11 * fontScale,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    />
  );
}
