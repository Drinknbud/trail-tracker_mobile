import { router } from "expo-router";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Mountain,
  Plus,
  Trash2,
  Trophy,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/Screen";
import { StatTile } from "@/components/StatTile";
import { TrailBadge } from "@/components/TrailBadge";
import {
  BADGE_DEFS,
  CATEGORY_EMOJIS,
  CATEGORY_LABELS,
  SYSTEM_CHALLENGES,
  type BadgeCategory,
  type BadgeStats,
  type BadgeTier,
  type DistanceUnit,
  type SystemChallengeStats,
} from "@/lib/badges";
import { useAuth } from "@/lib/auth";
import {
  claimSystemChallenge,
  completeChallenge,
  createChallenge,
  deleteChallenge,
  fetchChallengeCompletions,
  fetchChallenges,
  fetchStats,
  fetchWebUser,
  type ChallengeCompletion,
  type UserChallenge,
  type WebStats,
} from "@/lib/webApi";
import { useTheme } from "@/theme/ThemeContext";

function fmtMiles(mi: number, unit: DistanceUnit): string {
  return unit === "km" ? `${(mi * 1.60934).toFixed(1)} km` : `${mi.toFixed(1)} mi`;
}

const BASE_CATEGORIES: BadgeCategory[] = ["distance", "elevation", "sections", "pace", "community", "gear"];
const CHALLENGE_TYPES = ["miles", "sections", "days", "custom"] as const;

function tierColors(colors: ReturnType<typeof useTheme>["colors"], tier: BadgeTier) {
  const base =
    tier === "bronze" ? colors.badgeBronze :
    tier === "silver" ? colors.badgeSilver :
    tier === "gold"   ? colors.badgeGold :
                         colors.badgeSpecial;
  return { text: base, bg: `${base}22`, border: `${base}66` };
}

export default function AccomplishmentsScreen() {
  const { colors, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [stats, setStats] = useState<WebStats | null>(null);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>("mi");
  const [challenges, setChallenges] = useState<UserChallenge[]>([]);
  const [completions, setCompletions] = useState<ChallengeCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<BadgeCategory>("distance");
  const [showHistory, setShowHistory] = useState(false);
  const [showNewChallenge, setShowNewChallenge] = useState(false);
  const [confirmCompleteId, setConfirmCompleteId] = useState<string | null>(null);

  const [ncTitle, setNcTitle] = useState("");
  const [ncType, setNcType] = useState<(typeof CHALLENGE_TYPES)[number]>("miles");
  const [ncTarget, setNcTarget] = useState("");
  const [ncDeadline, setNcDeadline] = useState("");
  const [ncSaving, setNcSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const [s, u, c, h] = await Promise.all([
        fetchStats(token),
        fetchWebUser(token),
        fetchChallenges(token),
        fetchChallengeCompletions(token),
      ]);
      setStats(s);
      setDistanceUnit(u.distanceUnit === "km" ? "km" : "mi");
      setChallenges(c);
      setCompletions(h);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const now = new Date();

  // dayLogsThisWeek/Month aren't in /api/stats (server-side claim re-verifies
  // anyway) — mirrors the same gap in the web Accomplishments page.
  const sysStats: SystemChallengeStats = {
    milesThisWeek: stats?.milesThisWeek ?? 0,
    dayLogsThisWeek: 0,
    milesThisMonth: stats?.milesThisMonth ?? 0,
    sectionsThisMonth: stats?.sectionsThisMonth ?? 0,
    dayLogsThisMonth: stats?.daysOnTrailThisMonth ?? 0,
    milesThisYear: stats?.milesThisYear ?? 0,
    sectionsThisYear: stats?.sectionsThisYear ?? 0,
    daysOnTrailThisYear: stats?.daysOnTrailThisYear ?? 0,
  };

  const badgeStats: BadgeStats = {
    milesCompleted: stats?.milesCompleted ?? 0,
    elevGainTotal: stats?.elevGainTotal ?? 0,
    sectionsCompleted: stats?.sectionsCompleted ?? 0,
    photoCount: stats?.photoCount ?? 0,
    communityContributions: stats?.communityContributions ?? 0,
    beatClockCount: stats?.beatClockCount ?? 0,
    packWeightLogged: stats?.packWeightLogged ?? false,
    minPackWeight: stats?.minPackWeight ?? null,
    percentComplete: stats?.percentComplete ?? 0,
    trailCompleted: stats?.trailCompleted ?? false,
    trailCatalogKey: stats?.trailCatalogKey,
    atRegionCoverage: stats?.atRegionCoverage,
    trailsStarted: stats?.trailsStarted,
    trailsCompleted: stats?.trailsCompleted,
    hasTripleCrown: stats?.hasTripleCrown,
  };

  const visibleCategories = useMemo<BadgeCategory[]>(() => [
    ...BASE_CATEGORIES,
    ...(stats?.trailCatalogKey === "at" ? ["regions" as BadgeCategory] : []),
    "trails" as BadgeCategory,
  ], [stats?.trailCatalogKey]);

  const categoryBadges = BADGE_DEFS.filter(
    (b) => b.category === activeCategory && (!b.trailKey || b.trailKey === stats?.trailCatalogKey)
  );
  const applicableBadges = BADGE_DEFS.filter((b) => !b.trailKey || b.trailKey === stats?.trailCatalogKey);
  const totalEarned = applicableBadges.filter((b) => b.earned(badgeStats)).length;

  const completedKeys = new Set(completions.map((c) => c.challengeKey));
  const activeChallenges = challenges.filter((c) => c.status === "active");

  async function recordSystemCompletion(ch: (typeof SYSTEM_CHALLENGES)[number]) {
    if (!token) return;
    const key = ch.key(now);
    if (completedKeys.has(key)) return;
    try {
      await claimSystemChallenge(token, key);
      await load();
    } catch {
      // Criteria not actually met (or already claimed) — silently ignore,
      // the server is the source of truth here.
    }
  }

  async function handleCreateChallenge() {
    if (!token || !ncTitle.trim() || ncSaving) return;
    setNcSaving(true);
    try {
      await createChallenge(token, {
        title: ncTitle,
        targetType: ncType,
        targetValue: ncType !== "custom" && ncTarget ? Number(ncTarget) : null,
        deadline: ncDeadline || null,
      });
      setNcTitle(""); setNcType("miles"); setNcTarget(""); setNcDeadline("");
      setShowNewChallenge(false);
      await load();
    } finally {
      setNcSaving(false);
    }
  }

  async function handleCompleteChallenge(id: string) {
    if (!token) return;
    await completeChallenge(token, id);
    await load();
  }

  async function handleDeleteChallenge(id: string) {
    if (!token) return;
    await deleteChallenge(token, id);
    await load();
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.muted }}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <Pressable
        onPress={() => router.back()}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}
      >
        <ArrowLeft color={colors.accent} size={20} />
        <Text style={{ color: colors.accent, fontSize: 14 * fontScale, fontWeight: "600" }}>Back</Text>
      </Pressable>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <TrailBadge catalogKey={stats?.trailCatalogKey} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22 * fontScale, fontWeight: "700", color: colors.text }}>
            Accomplishments
          </Text>
          <Text style={{ fontSize: 13 * fontScale, color: colors.muted }}>
            {stats?.trailName ?? "Your trail"}
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: `${colors.accent}1A`,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
          }}
        >
          <Trophy color={colors.accent} size={15} />
          <Text style={{ fontSize: 13 * fontScale, fontWeight: "700", color: colors.accent }}>
            {totalEarned} / {applicableBadges.length}
          </Text>
        </View>
      </View>

      {/* ── Stats row ──────────────────────────────────────────────────── */}
      {stats ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
          <StatTile icon={Trophy} label="Hiked" value={fmtMiles(stats.milesCompleted, distanceUnit)} sub={`of ${fmtMiles(stats.totalMiles, distanceUnit)}`} accent />
          <StatTile icon={Mountain} label="Trail Complete" value={`${stats.percentComplete.toFixed(1)}%`} sub="progress" />
          <StatTile icon={Check} label="Sections Done" value={`${stats.sectionsCompleted}`} sub="completed" />
          <StatTile icon={Clock} label={`${now.getFullYear()} ${distanceUnit === "km" ? "KM" : "Miles"}`} value={fmtMiles(stats.milesThisYear, distanceUnit)} sub="this year" />
        </View>
      ) : null}

      {/* ── Badges ─────────────────────────────────────────────────────── */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Trophy color={colors.badgeGold} size={18} />
        <Text style={{ fontSize: 17 * fontScale, fontWeight: "700", color: colors.text }}>Badges</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {visibleCategories.map((cat) => {
            const catBadges = BADGE_DEFS.filter(
              (b) => b.category === cat && (!b.trailKey || b.trailKey === stats?.trailCatalogKey)
            );
            const catEarned = catBadges.filter((b) => b.earned(badgeStats)).length;
            const active = activeCategory === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setActiveCategory(cat)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: active ? colors.accent : colors.surface,
                  borderWidth: active ? 0 : 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 13 * fontScale }}>{CATEGORY_EMOJIS[cat]}</Text>
                <Text style={{ fontSize: 13 * fontScale, fontWeight: "600", color: active ? "#FFFFFF" : colors.text }}>
                  {CATEGORY_LABELS[cat]}
                </Text>
                <View
                  style={{
                    paddingHorizontal: 6,
                    borderRadius: 999,
                    backgroundColor: active ? "rgba(255,255,255,0.25)" : colors.border,
                  }}
                >
                  <Text style={{ fontSize: 11 * fontScale, color: active ? "#FFFFFF" : colors.muted }}>
                    {catEarned}/{catBadges.length}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ gap: 10, marginBottom: 24 }}>
        {categoryBadges.map((badge) => {
          const earned = badge.earned(badgeStats);
          const tc = tierColors(colors, badge.tier);
          return (
            <Card
              key={badge.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                opacity: earned ? 1 : 0.5,
                borderColor: earned ? tc.border : colors.border,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: earned ? tc.bg : colors.border,
                }}
              >
                <Text style={{ fontSize: 22 }}>{badge.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 14 * fontScale, fontWeight: "600", color: colors.text }}>
                    {badge.name}
                  </Text>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tc.text }} />
                </View>
                <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginTop: 2 }}>
                  {badge.description(distanceUnit)}
                </Text>
                <Text style={{ fontSize: 12 * fontScale, fontWeight: "500", color: earned ? tc.text : colors.muted, marginTop: 4 }}>
                  {earned ? `✓ ${badge.progress(badgeStats, distanceUnit)}` : badge.progress(badgeStats, distanceUnit)}
                </Text>
              </View>
            </Card>
          );
        })}
      </View>

      {/* ── Challenges ─────────────────────────────────────────────────── */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Mountain color={colors.accent} size={18} />
          <Text style={{ fontSize: 17 * fontScale, fontWeight: "700", color: colors.text }}>Challenges</Text>
        </View>
        <Pressable onPress={() => setShowNewChallenge((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Plus color={colors.accent} size={15} />
          <Text style={{ fontSize: 13 * fontScale, color: colors.accent, fontWeight: "600" }}>Add Goal</Text>
        </Pressable>
      </View>

      {showNewChallenge ? (
        <Card style={{ marginBottom: 16, borderColor: `${colors.accent}4D`, gap: 10 }}>
          <Text style={{ fontSize: 13 * fontScale, fontWeight: "600", color: colors.text }}>New Personal Goal</Text>
          <TextInput
            value={ncTitle}
            onChangeText={setNcTitle}
            placeholder="Goal title…"
            placeholderTextColor={colors.muted}
            maxLength={100}
            style={{
              borderWidth: 1, borderColor: colors.border, borderRadius: 8,
              paddingHorizontal: 12, paddingVertical: 8, color: colors.text, fontSize: 14 * fontScale,
            }}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {CHALLENGE_TYPES.map((t) => {
              const active = ncType === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setNcType(t)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                    backgroundColor: active ? colors.accent : "transparent",
                    borderWidth: 1, borderColor: active ? "transparent" : colors.border,
                  }}
                >
                  <Text style={{ fontSize: 12 * fontScale, fontWeight: "500", color: active ? "#FFFFFF" : colors.text }}>
                    {t === "custom" ? "Free-form" : t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {ncType !== "custom" ? (
            <TextInput
              value={ncTarget}
              onChangeText={setNcTarget}
              placeholder={`Target ${ncType}…`}
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={{
                borderWidth: 1, borderColor: colors.border, borderRadius: 8,
                paddingHorizontal: 12, paddingVertical: 8, color: colors.text, fontSize: 14 * fontScale,
              }}
            />
          ) : null}
          <TextInput
            value={ncDeadline}
            onChangeText={setNcDeadline}
            placeholder="Deadline (YYYY-MM-DD, optional)"
            placeholderTextColor={colors.muted}
            style={{
              borderWidth: 1, borderColor: colors.border, borderRadius: 8,
              paddingHorizontal: 12, paddingVertical: 8, color: colors.text, fontSize: 14 * fontScale,
            }}
          />
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
            <Pressable
              onPress={() => setShowNewChallenge(false)}
              style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
            >
              <Text style={{ fontSize: 13 * fontScale, color: colors.text }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleCreateChallenge}
              disabled={!ncTitle.trim() || ncSaving}
              style={{
                paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
                backgroundColor: colors.accent, opacity: !ncTitle.trim() || ncSaving ? 0.4 : 1,
              }}
            >
              <Text style={{ fontSize: 13 * fontScale, color: "#FFFFFF", fontWeight: "600" }}>Save Goal</Text>
            </Pressable>
          </View>
        </Card>
      ) : null}

      <Text style={{ fontSize: 11 * fontScale, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
        System Challenges
      </Text>
      <View style={{ gap: 8, marginBottom: 16 }}>
        {SYSTEM_CHALLENGES.map((ch) => {
          const key = ch.key(now);
          const done = completedKeys.has(key);
          const active = ch.check(sysStats, now);
          return (
            <Card
              key={key}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                borderColor: done ? `${colors.accent}4D` : colors.border,
                opacity: done ? 0.7 : 1,
              }}
            >
              <Text style={{ fontSize: 20 }}>{ch.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13 * fontScale, fontWeight: "500", color: colors.text }}>
                  {ch.description(distanceUnit)}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <Text style={{ fontSize: 12 * fontScale, color: colors.muted }}>
                    {ch.progressLabel(sysStats, distanceUnit)}
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999,
                      backgroundColor: ch.reset === "weekly" ? "#3B82F633" : ch.reset === "monthly" ? "#A855F733" : "#F59E0B33",
                    }}
                  >
                    <Text style={{ fontSize: 10 * fontScale, color: ch.reset === "weekly" ? "#3B82F6" : ch.reset === "monthly" ? "#A855F7" : "#F59E0B" }}>
                      {ch.reset}
                    </Text>
                  </View>
                </View>
              </View>
              {done ? (
                <Check color={colors.accent} size={20} />
              ) : active ? (
                <Pressable
                  onPress={() => recordSystemCompletion(ch)}
                  style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.accent }}
                >
                  <Text style={{ fontSize: 12 * fontScale, color: "#FFFFFF", fontWeight: "600" }}>Claim</Text>
                </Pressable>
              ) : (
                <Clock color={colors.muted} size={16} />
              )}
            </Card>
          );
        })}
      </View>

      {activeChallenges.length > 0 ? (
        <>
          <Text style={{ fontSize: 11 * fontScale, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            My Goals
          </Text>
          <View style={{ gap: 8, marginBottom: 16 }}>
            {activeChallenges.map((ch) => (
              <Card key={ch.id}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Text style={{ fontSize: 20 }}>🎯</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13 * fontScale, fontWeight: "500", color: colors.text }}>{ch.title}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
                      {ch.targetValue ? (
                        <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
                          Target: {ch.targetValue} {ch.targetType}
                        </Text>
                      ) : null}
                      {ch.deadline ? (
                        <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
                          Due: {new Date(ch.deadline).toLocaleDateString()}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Pressable onPress={() => setConfirmCompleteId(ch.id)} style={{ padding: 6 }}>
                    <Check color={colors.accent} size={18} />
                  </Pressable>
                  <Pressable onPress={() => handleDeleteChallenge(ch.id)} style={{ padding: 6 }}>
                    <Trash2 color={colors.muted} size={18} />
                  </Pressable>
                </View>
                {confirmCompleteId === ch.id ? (
                  <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <Text style={{ fontSize: 11 * fontScale, color: colors.muted, flex: 1 }}>Mark as complete? This can&apos;t be undone.</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Pressable onPress={() => setConfirmCompleteId(null)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ fontSize: 11 * fontScale, color: colors.text }}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => { void handleCompleteChallenge(ch.id); setConfirmCompleteId(null); }}
                        style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.accent }}
                      >
                        <Text style={{ fontSize: 11 * fontScale, color: "#FFFFFF", fontWeight: "600" }}>Confirm</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </Card>
            ))}
          </View>
        </>
      ) : (
        <Pressable onPress={() => setShowNewChallenge(true)} style={{ alignItems: "center", paddingVertical: 8, marginBottom: 16 }}>
          <Text style={{ fontSize: 13 * fontScale, color: colors.muted }}>
            No personal goals yet — <Text style={{ color: colors.accent, textDecorationLine: "underline" }}>add one</Text>
          </Text>
        </Pressable>
      )}

      {/* ── Challenge History ─────────────────────────────────────────── */}
      {completions.length > 0 ? (
        <View>
          <Pressable onPress={() => setShowHistory((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Trophy color={colors.accent} size={17} />
            <Text style={{ flex: 1, fontSize: 17 * fontScale, fontWeight: "700", color: colors.text }}>Challenge History</Text>
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.border }}>
              <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>{completions.length}</Text>
            </View>
            {showHistory ? <ChevronUp color={colors.muted} size={16} /> : <ChevronDown color={colors.muted} size={16} />}
          </Pressable>
          {showHistory ? (
            <View style={{ gap: 8 }}>
              {completions.map((c) => (
                <Card key={c.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderColor: `${colors.accent}33` }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.accent}1A` }}>
                    <Check color={colors.accent} size={16} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13 * fontScale, fontWeight: "500", color: colors.text }}>{c.title}</Text>
                    <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
                      Completed {new Date(c.completedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                    </Text>
                  </View>
                </Card>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
