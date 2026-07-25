import { router } from "expo-router";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Crown,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
  Trophy,
  WifiOff,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AvatarPicker } from "@/components/AvatarPicker";
import { BadgeGate } from "@/components/BadgeGate";
import { FormField } from "@/components/FormField";
import { HeroImagePicker } from "@/components/HeroImagePicker";
import { PickerModal } from "@/components/PickerModal";
import { Card } from "@/components/Screen";
import { ACCENT_PRESETS, CARRIER_OPTIONS, carrierLabel } from "@/lib/carriers";
import { GPS_MODES, fromWebPowerMode, toWebPowerMode, type GpsMode } from "@/lib/gps";
import { useAuth } from "@/lib/auth";
import { useOnTrail } from "@/lib/onTrail";
import { useUnits } from "@/lib/units-context";
import { directionsFor, VISIBLE_TRAILS } from "@/lib/trailCatalog";
import {
  activateTrail,
  addTrail,
  BADGE_UNLOCKS,
  deleteTrail,
  disable2fa,
  fetchStats,
  fetchTrails,
  generateShareSlug,
  start2faSetup,
  toggleTrailComplete,
  updateTrailDirection,
  updateWebUser,
  verify2fa,
  type WebTrail,
  type WebUser,
  type WebUserUpdate,
} from "@/lib/webApi";
import { ApiError, apiFetch } from "@/lib/api";
import { enqueueWrite } from "@/lib/outbox";
import { getBriefingHour, setBriefingHour } from "@/lib/prefs";
import { cacheUser, getCachedUser } from "@/lib/userCache";
import { DEFAULT_ACCENT } from "@/theme/colors";
import { useTheme, type TextSize, type ThemeMode } from "@/theme/ThemeContext";

type Tab = "trailMode" | "profile" | "appearance" | "account";
const TABS: { id: Tab; label: string }[] = [
  { id: "trailMode", label: "Trail Mode" },
  { id: "profile", label: "Profile" },
  { id: "appearance", label: "Appearance" },
  { id: "account", label: "Account" },
];

function SectionLabel({ children }: { children: string }) {
  const { colors, fontScale } = useTheme();
  return (
    <Text
      style={{
        fontSize: 12 * fontScale,
        fontWeight: "600",
        color: colors.muted,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 10,
      }}
    >
      {children}
    </Text>
  );
}

function SaveButton({
  onPress,
  saving,
  saved,
  error,
  offlineNote,
}: {
  onPress: () => void;
  saving: boolean;
  saved: boolean;
  /** Shown above the button when the last save attempt failed — without this,
   * a failed save (bad connection, wrong API host, server rejection, etc.)
   * looked identical to a successful one: the button just goes back to
   * "Save" with zero indication anything went wrong. */
  error?: string | null;
  /** Shown instead of `error` when a save couldn't reach the server but was
   * applied locally and queued to sync automatically once back online —
   * distinct from `error` so "offline, but handled" doesn't read as a failure. */
  offlineNote?: string | null;
}) {
  const { colors, fontScale } = useTheme();
  return (
    <>
      {offlineNote ? (
        <Text style={{ fontSize: 13 * fontScale, color: colors.offlineAmber, marginBottom: 8 }}>
          {offlineNote}
        </Text>
      ) : error ? (
        <Text style={{ fontSize: 13 * fontScale, color: colors.offlineAmber, marginBottom: 8 }}>
          {error}
        </Text>
      ) : null}
      <Pressable
        onPress={onPress}
        disabled={saving}
        style={{
          backgroundColor: colors.accent,
          borderRadius: 8,
          paddingVertical: 14,
          alignItems: "center",
          marginTop: 4,
          marginBottom: 24,
          flexDirection: "row",
          justifyContent: "center",
          gap: 8,
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : saved ? (
          <Check color="#FFFFFF" size={16} />
        ) : null}
        <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 * fontScale }}>
          {saved ? "Saved!" : saving ? "Saving…" : "Save"}
        </Text>
      </Pressable>
    </>
  );
}

function ToggleRow({
  label,
  desc,
  value,
  onChange,
  last = false,
}: {
  label: string;
  desc?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  const { colors, fontScale } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={{ fontSize: 14 * fontScale, color: colors.text, fontWeight: "500" }}>
          {label}
        </Text>
        {desc ? (
          <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginTop: 2 }}>
            {desc}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors, fontScale } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => onChange(opt.value)}
            style={{
              flex: 1,
              paddingVertical: 8,
              alignItems: "center",
              backgroundColor: active ? colors.accent : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 12 * fontScale,
                fontWeight: active ? "600" : "400",
                color: active ? "#FFFFFF" : colors.text,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const { colors, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>("trailMode");
  const [user, setUser] = useState<WebUser | null>(null);
  const [offline, setOffline] = useState(false);
  const [earnedBadgeCount, setEarnedBadgeCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // Show the last-known settings immediately (works offline) — replaced
      // by the live copy below the moment that succeeds.
      const cached = await getCachedUser();
      if (cached) setUser(cached);

      if (!token) return;
      try {
        const fresh = await apiFetch<WebUser>("/api/user", { token });
        setUser(fresh);
        setOffline(false);
        setLoadError(null);
        void cacheUser(fresh);
      } catch (err) {
        if (cached) {
          // Local copy still stands — just flag it as stale instead of
          // blocking the whole screen behind a spinner + error.
          setOffline(true);
        } else {
          setLoadError(err instanceof Error ? err.message : "Couldn't load your profile");
        }
      }
      // Badge count drives the avatar/hero-image/accent-color unlock gates —
      // best-effort, no user-facing error if it fails (gates just stay locked).
      fetchStats(token)
        .then((s) => setEarnedBadgeCount(s.earnedBadgeCount))
        .catch(() => {});
    })();
  }, [token]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16 }}>
        <Pressable
          onPress={() => router.back()}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}
        >
          <ArrowLeft color={colors.accent} size={20} />
          <Text style={{ color: colors.accent, fontSize: 14 * fontScale, fontWeight: "600" }}>
            Back
          </Text>
        </Pressable>
        <Text style={{ fontSize: 24 * fontScale, fontWeight: "700", color: colors.text, marginBottom: 12 }}>
          Settings
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 8, paddingBottom: 12 }}>
            {TABS.map((t) => {
              const active = t.id === tab;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTab(t.id)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 999,
                    backgroundColor: active ? colors.accent : colors.surface,
                    borderColor: active ? colors.accent : colors.border,
                    borderWidth: 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13 * fontScale,
                      fontWeight: active ? "700" : "400",
                      color: active ? "#FFFFFF" : colors.text,
                    }}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
      >
        {loadError && !user ? (
          <Card style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 13 * fontScale, color: colors.offlineAmber }}>{loadError}</Text>
          </Card>
        ) : null}
        {offline && user ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: colors.surface,
              borderColor: colors.offlineAmber,
              borderWidth: 1,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              marginBottom: 12,
            }}
          >
            <WifiOff color={colors.offlineAmber} size={16} />
            <Text style={{ color: colors.offlineAmber, fontSize: 13 * fontScale, flex: 1 }}>
              Offline — showing your last-saved settings. Trail Mode, Profile, and Appearance
              changes still apply and sync once you're back online.
            </Text>
          </View>
        ) : null}
        {!user ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            {tab === "trailMode" ? <TrailModeTab user={user} setUser={setUser} /> : null}
            {tab === "profile" ? (
              <ProfileTab user={user} setUser={setUser} earnedBadgeCount={earnedBadgeCount} />
            ) : null}
            {tab === "appearance" ? (
              <AppearanceTab user={user} setUser={setUser} earnedBadgeCount={earnedBadgeCount} />
            ) : null}
            {tab === "account" ? <AccountTab user={user} setUser={setUser} /> : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── My Trails ───────────────────────────────────────────────────────────────

function MyTrailsSection() {
  const { colors, fontScale } = useTheme();
  const { token } = useAuth();
  const { fmtMiles } = useUnits();
  const [trails, setTrails] = useState<WebTrail[] | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [search, setSearch] = useState("");
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    try {
      setTrails(await fetchTrails(token));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load trails");
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  const filteredCatalog = VISIBLE_TRAILS.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) || c.states.some((s) => s.toLowerCase().includes(q))
    );
  }).filter((c) => !trails?.some((t) => t.catalogKey === c.key));

  const onAdd = async (catalogKey: string) => {
    if (!token) return;
    setAddingKey(catalogKey);
    try {
      await addTrail(token, catalogKey);
      await load();
      setShowCatalog(false);
      setSearch("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add trail");
    } finally {
      setAddingKey(null);
    }
  };

  const onActivate = async (id: string) => {
    if (!token) return;
    setBusyId(id);
    try {
      await activateTrail(token, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't switch trail");
    } finally {
      setBusyId(null);
    }
  };

  const onToggleComplete = async (id: string) => {
    if (!token) return;
    setBusyId(id);
    try {
      await toggleTrailComplete(token, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update trail");
    } finally {
      setBusyId(null);
    }
  };

  const onDirection = async (id: string, direction: string) => {
    if (!token) return;
    setTrails((prev) => prev?.map((t) => (t.id === id ? { ...t, hikeDirection: direction } : t)) ?? prev);
    await updateTrailDirection(token, id, direction);
  };

  const onDelete = (id: string, name: string) => {
    Alert.alert(
      "Remove trail?",
      `Remove ${name} and all its sections? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            if (!token) return;
            setBusyId(id);
            try {
              await deleteTrail(token, id);
              await load();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't remove trail");
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <Text style={{ flex: 1, fontSize: 15 * fontScale, fontWeight: "700", color: colors.text }}>
          My Trails
        </Text>
        <Pressable
          onPress={() => setShowCatalog((s) => !s)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            borderWidth: 1,
            borderColor: colors.accent,
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 5,
          }}
        >
          <Plus color={colors.accent} size={14} />
          <Text style={{ fontSize: 12 * fontScale, color: colors.accent, fontWeight: "600" }}>
            Add Trail
          </Text>
          {showCatalog ? (
            <ChevronUp color={colors.accent} size={14} />
          ) : (
            <ChevronDown color={colors.accent} size={14} />
          )}
        </Pressable>
      </View>

      {error ? (
        <Text style={{ fontSize: 12 * fontScale, color: colors.destructiveRed, marginBottom: 8 }}>
          {error}
        </Text>
      ) : null}

      {showCatalog ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            marginBottom: 12,
            maxHeight: 260,
            overflow: "hidden",
          }}
        >
          <View style={{ padding: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <FormField
              label=""
              value={search}
              onChangeText={setSearch}
              placeholder="Search trails by name or state…"
              autoFocus
            />
          </View>
          <ScrollView style={{ maxHeight: 200 }}>
            {filteredCatalog.length === 0 ? (
              <Text
                style={{
                  fontSize: 13 * fontScale,
                  color: colors.muted,
                  textAlign: "center",
                  padding: 16,
                }}
              >
                No trails found
              </Text>
            ) : (
              filteredCatalog.map((c) => (
                <View
                  key={c.key}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13 * fontScale, fontWeight: "600", color: colors.text }}>
                      {c.name}
                    </Text>
                    <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
                      {fmtMiles(c.totalMiles)} · {c.states.join(", ")}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => onAdd(c.key)}
                    disabled={addingKey === c.key}
                    style={{
                      backgroundColor: colors.accent,
                      borderRadius: 6,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      opacity: addingKey === c.key ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: "#FFFFFF", fontSize: 12 * fontScale, fontWeight: "600" }}>
                      {addingKey === c.key ? "…" : "Add"}
                    </Text>
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      ) : null}

      {trails === null ? (
        <ActivityIndicator color={colors.accent} />
      ) : trails.length === 0 ? (
        <Text style={{ fontSize: 13 * fontScale, color: colors.muted }}>No trails added yet.</Text>
      ) : (
        trails.map((t) => {
          const pct = Math.min(Math.round((t.completedMiles / t.totalMiles) * 100), 100);
          const isCompleted = !!t.completedAt;
          const dirs = directionsFor(t.catalogKey);
          const busy = busyId === t.id;
          return (
            <View
              key={t.id}
              style={{
                borderWidth: 1,
                borderColor: t.isActive ? colors.accent : colors.border,
                borderRadius: 10,
                padding: 12,
                marginBottom: 10,
                opacity: busy ? 0.6 : 1,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 6 }}>
                <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  <Text style={{ fontSize: 14 * fontScale, fontWeight: "700", color: colors.text }}>
                    {t.displayName}
                  </Text>
                  {t.isActive ? (
                    <View style={{ backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 9 * fontScale, color: "#FFFFFF", fontWeight: "700" }}>ACTIVE</Text>
                    </View>
                  ) : null}
                  {isCompleted ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: colors.badgeGold + "33", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <Trophy color={colors.badgeGold} size={9} />
                      <Text style={{ fontSize: 9 * fontScale, color: colors.badgeGold, fontWeight: "700" }}>
                        COMPLETED
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {!t.isActive ? (
                    <Pressable onPress={() => onActivate(t.id)} disabled={busy}>
                      <Text style={{ fontSize: 12 * fontScale, color: colors.accent, fontWeight: "600" }}>
                        Switch
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => onDelete(t.id, t.displayName)} disabled={busy}>
                    <Trash2 color={colors.muted} size={15} />
                  </Pressable>
                </View>
              </View>

              <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginBottom: 6 }}>
                {t.startPoint} → {t.endPoint} · {fmtMiles(t.totalMiles)}
              </Text>

              <View style={{ height: 6, borderRadius: 999, backgroundColor: colors.border, marginBottom: 4, overflow: "hidden" }}>
                <View style={{ height: "100%", width: `${pct}%`, backgroundColor: colors.accent }} />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
                  {fmtMiles(t.completedMiles)} / {fmtMiles(t.totalMiles)} ({pct}%)
                </Text>
                <Pressable onPress={() => onToggleComplete(t.id)} disabled={busy}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    {isCompleted ? (
                      <Trophy color={colors.badgeGold} size={11} />
                    ) : (
                      <Star color={colors.muted} size={11} />
                    )}
                    <Text style={{ fontSize: 11 * fontScale, color: isCompleted ? colors.badgeGold : colors.muted }}>
                      {isCompleted ? "Unmark" : "Mark Complete"}
                    </Text>
                  </View>
                </Pressable>
              </View>

              {dirs.length > 1 ? (
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {dirs.map(({ value, label }) => {
                    const active = t.hikeDirection === value;
                    return (
                      <Pressable
                        key={value}
                        onPress={() => onDirection(t.id, value)}
                        style={{
                          flex: 1,
                          paddingVertical: 6,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: active ? colors.accent : colors.border,
                          backgroundColor: active ? colors.accent : "transparent",
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ fontSize: 11 * fontScale, color: active ? "#FFFFFF" : colors.muted, fontWeight: active ? "700" : "400" }}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </Card>
  );
}

// ─── Trail Mode ──────────────────────────────────────────────────────────────

function TrailModeTab({
  user,
  setUser,
}: {
  user: WebUser;
  setUser: (u: WebUser) => void;
}) {
  const { colors, fontScale } = useTheme();
  const { token } = useAuth();
  const { applyServerValue } = useOnTrail();
  const [onTrailMode, setOnTrailMode] = useState(user.onTrailMode);
  const [daysAhead, setDaysAhead] = useState(user.daysAheadForBriefings ?? 2);
  const [gpsEnabled, setGpsEnabled] = useState(user.gpsTrackingEnabled);
  const [powerMode, setPowerMode] = useState<GpsMode>(fromWebPowerMode(user.gpsPowerMode));
  const [briefingHour, setBriefingHourState] = useState(7);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [offlineNote, setOfflineNote] = useState<string | null>(null);

  useEffect(() => {
    void getBriefingHour().then(setBriefingHourState);
  }, []);

  const save = async () => {
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    setOfflineNote(null);
    const patch: WebUserUpdate = {
      onTrailMode,
      daysAheadForBriefings: daysAhead,
      gpsTrackingEnabled: gpsEnabled,
      gpsPowerMode: toWebPowerMode(powerMode),
    };
    try {
      await setBriefingHour(briefingHour);
      const updated = await updateWebUser(token, patch);
      setUser(updated);
      void cacheUser(updated);
      // Keep the adaptive tab bar in sync. Use the form value the server just
      // accepted — the PATCH response doesn't echo every field back.
      applyServerValue(onTrailMode);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      if (err instanceof ApiError) {
        // Form state stays editable — but the user needs to actually see this
        // failed, or a lost connection looks identical to a successful save.
        setSaveError(err.message);
      } else {
        // Network-level failure (offline, not a server rejection): apply the
        // change locally right away — GPS power mode and on-trail auto-sync
        // are exactly the settings a hiker needs to adjust with no signal —
        // and queue the PATCH via the same outbox every other offline mobile
        // write uses, so it syncs automatically once back online.
        const optimistic = { ...user, ...patch } as WebUser;
        setUser(optimistic);
        void cacheUser(optimistic);
        applyServerValue(onTrailMode);
        await enqueueWrite("/api/user", patch, `user-trailmode-${Date.now()}`, token, "PATCH");
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        setOfflineNote("Saved on this device — will sync once you're back online.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <MyTrailsSection />

      <Card style={{ marginBottom: 16 }}>
        <SectionLabel>On Trail</SectionLabel>
        <ToggleRow
          label="Auto-sync briefings when signal returns"
          desc="Fetches fresh morning briefings for upcoming days when you get cell service."
          value={onTrailMode}
          onChange={setOnTrailMode}
          last={!onTrailMode}
        />
        {onTrailMode ? (
          <View style={{ paddingTop: 12 }}>
            <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginBottom: 6 }}>
              Prefetch briefings {daysAhead} day{daysAhead !== 1 ? "s" : ""} ahead
            </Text>
            <Segmented
              options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))}
              value={daysAhead}
              onChange={setDaysAhead}
            />
          </View>
        ) : null}

        <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginBottom: 6 }}>
            Morning briefing notification time
          </Text>
          <Segmented
            options={[5, 6, 7, 8].map((h) => ({ value: h, label: `${h} AM` }))}
            value={briefingHour}
            onChange={setBriefingHourState}
          />
        </View>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <SectionLabel>GPS Tracking</SectionLabel>
        <ToggleRow
          label="Track my location on the map"
          desc="Default for new tracking sessions. Requires location permission."
          value={gpsEnabled}
          onChange={setGpsEnabled}
          last={!gpsEnabled}
        />
        {gpsEnabled ? (
          <View style={{ gap: 8, paddingTop: 12 }}>
            {(Object.keys(GPS_MODES) as GpsMode[]).map((key) => {
              const m = GPS_MODES[key];
              const active = key === powerMode;
              return (
                <Pressable key={key} onPress={() => setPowerMode(key)}>
                  <View
                    style={{
                      borderWidth: active ? 2 : 1,
                      borderColor: active ? colors.accent : colors.border,
                      borderRadius: 8,
                      padding: 10,
                    }}
                  >
                    <Text style={{ fontSize: 13 * fontScale, fontWeight: "600", color: colors.text }}>
                      {m.label}
                    </Text>
                    <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginTop: 1 }}>
                      Every {m.intervalS >= 60 ? `${m.intervalS / 60} min` : `${m.intervalS}s`} · {m.battery}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {/* GPS lives here now (removed from the nav menus) — this row opens
            the live tracking screen for start/stop + dead-zone reporting */}
        <Pressable
          onPress={() => router.push("/gps")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 13 * fontScale, fontWeight: "600", color: colors.accent }}>
            Open GPS tracking screen →
          </Text>
        </Pressable>
      </Card>

      <SaveButton onPress={save} saving={saving} saved={saved} error={saveError} offlineNote={offlineNote} />
    </View>
  );
}

// ─── Profile ─────────────────────────────────────────────────────────────────

function ProfileTab({
  user,
  setUser,
  earnedBadgeCount,
}: {
  user: WebUser;
  setUser: (u: WebUser) => void;
  earnedBadgeCount: number;
}) {
  const { colors, fontScale } = useTheme();
  const { token } = useAuth();
  const isPremium = user.subscriptionTier === "premium";
  const [name, setName] = useState(user.name ?? "");
  const [trailName, setTrailName] = useState(user.trailName ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [homeZip, setHomeZip] = useState(user.homeZip ?? "");
  const [carrier, setCarrier] = useState(user.carrierProvider ?? "");
  const [carrierPickerOpen, setCarrierPickerOpen] = useState(false);
  const [dailyMiles, setDailyMiles] = useState(
    user.typicalDailyMiles != null ? String(user.typicalDailyMiles) : ""
  );
  const [speed, setSpeed] = useState(user.hikingSpeedMph != null ? String(user.hikingSpeedMph) : "");
  const [visibility, setVisibility] = useState({
    shareShowPhotos: user.shareShowPhotos,
    shareShowDayLogs: user.shareShowDayLogs,
    shareShowNightLogs: user.shareShowNightLogs,
    shareShowNotes: user.shareShowNotes,
    shareShowLocation: user.shareShowLocation,
  });
  const [shareSlug, setShareSlug] = useState(user.shareSlug);
  const [generatingSlug, setGeneratingSlug] = useState(false);
  const [heroImage, setHeroImage] = useState(user.heroImage ?? "");
  const [heroPosition, setHeroPosition] = useState(user.heroImagePosition ?? "50% 50%");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [offlineNote, setOfflineNote] = useState<string | null>(null);

  const save = async () => {
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    setOfflineNote(null);
    const patch = {
      name,
      trailName,
      bio,
      homeZip,
      carrierProvider: carrier || null,
      typicalDailyMiles: dailyMiles ? Number(dailyMiles) : null,
      hikingSpeedMph: speed ? Number(speed) : null,
      heroImage: heroImage || null,
      heroImagePosition: heroPosition,
      ...visibility,
    } as WebUserUpdate;
    try {
      const updated = await updateWebUser(token, patch);
      setUser(updated);
      void cacheUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      if (err instanceof ApiError) {
        // The carrier field (and everything else on this tab) needs visible
        // failure feedback — silently doing nothing here is exactly what made
        // a failed save look identical to "the app just isn't saving my choice."
        setSaveError(err.message);
      } else {
        // Network-level failure — the carrier field in particular drives the
        // offline dead-zone map layer, so it needs to take effect right away
        // rather than waiting for a round trip that can't happen yet.
        const optimistic = { ...user, ...patch } as WebUser;
        setUser(optimistic);
        void cacheUser(optimistic);
        await enqueueWrite("/api/user", patch, `user-profile-${Date.now()}`, token, "PATCH");
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        setOfflineNote("Saved on this device — will sync once you're back online.");
      }
    } finally {
      setSaving(false);
    }
  };

  const onGenerateSlug = async () => {
    if (!token) return;
    setGeneratingSlug(true);
    try {
      const res = await generateShareSlug(token);
      setShareSlug(res.shareSlug);
    } finally {
      setGeneratingSlug(false);
    }
  };

  const shareUrl = shareSlug ? `https://trailtracker.app/share/${shareSlug}` : null;

  return (
    <View>
      <Card style={{ marginBottom: 16 }}>
        <SectionLabel>Profile</SectionLabel>

        <View style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginBottom: 6 }}>
            Avatar
            {!isPremium && earnedBadgeCount < BADGE_UNLOCKS.avatar ? (
              <Text style={{ color: colors.muted }}>
                {"  🏅 "}
                {earnedBadgeCount}/{BADGE_UNLOCKS.avatar} badges
              </Text>
            ) : null}
          </Text>
          <BadgeGate
            earned={earnedBadgeCount}
            required={BADGE_UNLOCKS.avatar}
            isPremium={isPremium}
            feature="Custom Avatar"
          >
            <AvatarPicker
              imageUrl={user.image}
              token={token}
              onUploaded={(url) => setUser({ ...user, image: url })}
            />
          </BadgeGate>
        </View>

        <FormField label="Display Name" value={name} onChangeText={setName} placeholder="Your name" />
        <FormField
          label="Trail Name / Thru-hiker Name"
          value={trailName}
          onChangeText={setTrailName}
          placeholder="e.g., Ridgerunner"
        />
        <FormField
          label="Bio"
          value={bio}
          onChangeText={setBio}
          placeholder="A bit about your hiking journey…"
          multiline
        />
        <FormField
          label="Home ZIP Code"
          value={homeZip}
          onChangeText={setHomeZip}
          placeholder="e.g. 28203"
          keyboardType="number-pad"
          maxLength={10}
        />
        <View style={{ marginBottom: 4 }}>
          <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginBottom: 4 }}>
            Mobile Carrier
          </Text>
          <Pressable
            onPress={() => setCarrierPickerOpen(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Text style={{ flex: 1, fontSize: 14 * fontScale, color: colors.text }}>
              {carrierLabel(carrier)}
            </Text>
            <ChevronRight color={colors.muted} size={16} />
          </Pressable>
          <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginTop: 4 }}>
            Helps filter dead zone reports to ones that affect your carrier.
          </Text>
        </View>

        <View>
          {!isPremium && earnedBadgeCount < BADGE_UNLOCKS.heroImage ? (
            <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginBottom: 6 }}>
              🏅 {earnedBadgeCount}/{BADGE_UNLOCKS.heroImage} badges to unlock hero image
            </Text>
          ) : null}
          <BadgeGate
            earned={earnedBadgeCount}
            required={BADGE_UNLOCKS.heroImage}
            isPremium={isPremium}
            feature="Custom Hero Image"
          >
            <HeroImagePicker
              url={heroImage}
              position={heroPosition}
              token={token}
              onChange={(url, pos) => {
                setHeroImage(url);
                setHeroPosition(pos);
              }}
            />
          </BadgeGate>
        </View>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <SectionLabel>Read-Only Share Link</SectionLabel>
        <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginBottom: 10 }}>
          Share your progress with family and friends without them logging in.
        </Text>
        {shareUrl ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 10,
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 11 * fontScale, color: colors.text }} numberOfLines={1}>
                {shareUrl}
              </Text>
            </View>
            <Pressable
              onPress={() => Share.share({ message: shareUrl })}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                paddingHorizontal: 14,
                justifyContent: "center",
              }}
            >
              <Copy color={colors.text} size={16} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={onGenerateSlug}
            disabled={generatingSlug}
            style={{
              backgroundColor: colors.accent,
              borderRadius: 8,
              paddingVertical: 10,
              alignItems: "center",
              opacity: generatingSlug ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 * fontScale }}>
              {generatingSlug ? "Generating…" : "Generate Share Link"}
            </Text>
          </Pressable>
        )}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <SectionLabel>Share Page Visibility</SectionLabel>
        <ToggleRow
          label="Photos"
          desc="Trail photos grouped under each section"
          value={visibility.shareShowPhotos}
          onChange={(v) => setVisibility((s) => ({ ...s, shareShowPhotos: v }))}
        />
        <ToggleRow
          label="Day Logs"
          desc="Miles hiked and mood for each day"
          value={visibility.shareShowDayLogs}
          onChange={(v) => setVisibility((s) => ({ ...s, shareShowDayLogs: v }))}
        />
        <ToggleRow
          label="Night Logs"
          desc="Camp location and nightly notes"
          value={visibility.shareShowNightLogs}
          onChange={(v) => setVisibility((s) => ({ ...s, shareShowNightLogs: v }))}
        />
        <ToggleRow
          label="Notes"
          desc="Section planning notes"
          value={visibility.shareShowNotes}
          onChange={(v) => setVisibility((s) => ({ ...s, shareShowNotes: v }))}
        />
        <ToggleRow
          label="Live Location"
          desc="Last known GPS position while on trail"
          value={visibility.shareShowLocation}
          onChange={(v) => setVisibility((s) => ({ ...s, shareShowLocation: v }))}
          last
        />
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <SectionLabel>Hiking Style</SectionLabel>
        <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginBottom: 10 }}>
          Scout uses these to set smarter itinerary defaults.
        </Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <FormField
              label={user.distanceUnit === "km" ? "Typical daily km" : "Typical daily miles"}
              value={dailyMiles}
              onChangeText={setDailyMiles}
              placeholder="e.g. 15"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormField
              label="Avg hiking speed"
              value={speed}
              onChangeText={setSpeed}
              placeholder="e.g. 2.5"
              keyboardType="decimal-pad"
            />
          </View>
        </View>
      </Card>

      <SaveButton onPress={save} saving={saving} saved={saved} error={saveError} offlineNote={offlineNote} />

      <PickerModal
        visible={carrierPickerOpen}
        title="Mobile Carrier"
        options={CARRIER_OPTIONS}
        value={carrier}
        onSelect={setCarrier}
        onClose={() => setCarrierPickerOpen(false)}
      />
    </View>
  );
}

// ─── Appearance ──────────────────────────────────────────────────────────────

function AppearanceTab({
  user,
  setUser,
  earnedBadgeCount,
}: {
  user: WebUser;
  setUser: (u: WebUser) => void;
  earnedBadgeCount: number;
}) {
  const { colors, fontScale, mode, setMode, textSize, setTextSize, setAccentColor } = useTheme();
  const { token } = useAuth();
  const { applyPrefs } = useUnits();
  const isPremium = user.subscriptionTier === "premium";
  const [distanceUnit, setDistanceUnit] = useState(user.distanceUnit);
  const [tempUnit, setTempUnit] = useState(user.tempUnit);
  const [weightUnit, setWeightUnit] = useState(user.weightUnit);
  const [timeFormat, setTimeFormat] = useState(user.timeFormat);
  const [dateFormat, setDateFormat] = useState(user.dateFormat);
  const [accentHex, setAccentHex] = useState(user.accentColor ?? DEFAULT_ACCENT);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [offlineNote, setOfflineNote] = useState<string | null>(null);

  const applyAccent = (hex: string) => {
    setAccentHex(hex);
    setAccentColor(hex);
  };

  const save = async () => {
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    setOfflineNote(null);
    const patch: WebUserUpdate = {
      distanceUnit,
      tempUnit,
      weightUnit,
      timeFormat,
      dateFormat,
      accentColor: accentHex,
    };
    try {
      const updated = await updateWebUser(token, patch);
      setUser(updated);
      void cacheUser(updated);
      // Push the saved prefs into the app-wide units context so every screen
      // reformats immediately without waiting for a refetch.
      applyPrefs({ distanceUnit, tempUnit, weightUnit, timeFormat, dateFormat });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      if (err instanceof ApiError) {
        setSaveError(err.message);
      } else {
        // Network-level failure — units are exactly the kind of preference a
        // hiker wants to change on trail, so apply immediately and queue the
        // sync for whenever signal returns (theme/text size/accent already
        // apply instantly above, independent of this Save button; distance/
        // temp/weight/time/date units are the ones that were waiting on it).
        const optimistic = { ...user, ...patch } as WebUser;
        setUser(optimistic);
        void cacheUser(optimistic);
        applyPrefs({ distanceUnit, tempUnit, weightUnit, timeFormat, dateFormat });
        await enqueueWrite("/api/user", patch, `user-appearance-${Date.now()}`, token, "PATCH");
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        setOfflineNote("Saved on this device — will sync once you're back online.");
      }
    } finally {
      setSaving(false);
    }
  };

  const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(accentHex);

  return (
    <View>
      <Card style={{ marginBottom: 16 }}>
        <SectionLabel>Theme</SectionLabel>
        <Segmented<ThemeMode>
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "System" },
          ]}
          value={mode}
          onChange={setMode}
        />
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <SectionLabel>Units</SectionLabel>
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginBottom: 4 }}>
              Distance
            </Text>
            <Segmented
              options={[
                { value: "mi", label: "mi / ft" },
                { value: "km", label: "km / m" },
              ]}
              value={distanceUnit}
              onChange={setDistanceUnit}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginBottom: 4 }}>
              Temperature
            </Text>
            <Segmented
              options={[
                { value: "F", label: "°F" },
                { value: "C", label: "°C" },
              ]}
              value={tempUnit}
              onChange={setTempUnit}
            />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginBottom: 4 }}>
              Weight
            </Text>
            <Segmented
              options={[
                { value: "lbs", label: "lbs" },
                { value: "kg", label: "kg" },
              ]}
              value={weightUnit}
              onChange={setWeightUnit}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginBottom: 4 }}>
              Time
            </Text>
            <Segmented
              options={[
                { value: "12h", label: "12h" },
                { value: "24h", label: "24h" },
              ]}
              value={timeFormat}
              onChange={setTimeFormat}
            />
          </View>
        </View>
        <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginBottom: 4 }}>
          Date Format
        </Text>
        <Segmented
          options={[
            { value: "MDY", label: "MM/DD/YYYY" },
            { value: "DMY", label: "DD/MM/YYYY" },
            { value: "YMD", label: "YYYY-MM-DD" },
          ]}
          value={dateFormat}
          onChange={setDateFormat}
        />
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <SectionLabel>Accent Color</SectionLabel>
        {!isPremium && earnedBadgeCount < BADGE_UNLOCKS.accentColor ? (
          <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginBottom: 10 }}>
            🏅 {earnedBadgeCount}/{BADGE_UNLOCKS.accentColor} badges to unlock
          </Text>
        ) : null}
        <BadgeGate
          earned={earnedBadgeCount}
          required={BADGE_UNLOCKS.accentColor}
          isPremium={isPremium}
          feature="Custom Accent Color"
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            {ACCENT_PRESETS.map(({ hex, label }) => {
              const active = accentHex.toLowerCase() === hex.toLowerCase();
              return (
                <Pressable key={hex} onPress={() => applyAccent(hex)} accessibilityLabel={label}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: hex,
                      borderWidth: active ? 3 : 0,
                      borderColor: colors.text,
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
          <FormField
            label="Custom hex"
            value={accentHex}
            onChangeText={(v) => setAccentHex(v)}
            onBlur={() => isValidHex && setAccentColor(accentHex)}
            placeholder="#2D6A4F"
            autoCapitalize="none"
          />
          {accentHex.toLowerCase() !== DEFAULT_ACCENT.toLowerCase() ? (
            <Pressable onPress={() => applyAccent(DEFAULT_ACCENT)}>
              <Text style={{ fontSize: 12 * fontScale, color: colors.muted, textDecorationLine: "underline" }}>
                Reset to default
              </Text>
            </Pressable>
          ) : null}
        </BadgeGate>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <SectionLabel>Text Size</SectionLabel>
        <Segmented<TextSize>
          options={[
            { value: "standard", label: "Standard" },
            { value: "large", label: "Large" },
            { value: "xlarge", label: "X-Large" },
          ]}
          value={textSize}
          onChange={setTextSize}
        />
      </Card>

      <SaveButton onPress={save} saving={saving} saved={saved} error={saveError} offlineNote={offlineNote} />
    </View>
  );
}

// ─── Account ─────────────────────────────────────────────────────────────────

function AccountTab({
  user,
  setUser,
}: {
  user: WebUser;
  setUser: (u: WebUser) => void;
}) {
  const { colors, fontScale } = useTheme();
  const { token } = useAuth();
  const isPremium = user.subscriptionTier === "premium";

  const [setup, setSetup] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDisable, setShowDisable] = useState(false);
  const [disableCode, setDisableCode] = useState("");

  const startSetup = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      setSetup(await start2faSetup(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start 2FA setup");
    } finally {
      setBusy(false);
    }
  };

  const confirmVerify = async () => {
    if (!token || !setup) return;
    setBusy(true);
    setError(null);
    try {
      await verify2fa(token, code, setup.secret);
      setUser({ ...user, twoFactorEnabled: true });
      setSetup(null);
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  };

  const confirmDisable = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await disable2fa(token, disableCode);
      setUser({ ...user, twoFactorEnabled: false });
      setShowDisable(false);
      setDisableCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Card style={{ marginBottom: 16 }}>
        <SectionLabel>Plan &amp; Billing</SectionLabel>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14 * fontScale, fontWeight: "600", color: colors.text }}>
              Current Plan
            </Text>
            <View
              style={{
                alignSelf: "flex-start",
                backgroundColor: isPremium ? colors.badgeGold : colors.border,
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 2,
                marginTop: 4,
              }}
            >
              <Text style={{ fontSize: 11 * fontScale, color: isPremium ? "#5C4400" : colors.muted, fontWeight: "600" }}>
                {isPremium ? "Premium ✓" : "Free"}
              </Text>
            </View>
          </View>
          {!isPremium ? (
            <Pressable
              onPress={() => router.push("/upgrade")}
              style={{
                backgroundColor: colors.accent,
                borderRadius: 8,
                paddingHorizontal: 14,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Crown color="#FFFFFF" size={14} />
              <Text style={{ color: "#FFFFFF", fontSize: 12 * fontScale, fontWeight: "600" }}>
                {user.trialUsed ? "Subscribe" : "Start Trial"}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push("/upgrade")}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <Text style={{ fontSize: 12 * fontScale, color: colors.text }}>Manage</Text>
            </Pressable>
          )}
        </View>
      </Card>

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <ShieldCheck color={colors.accent} size={18} />
          <SectionLabel>Security</SectionLabel>
        </View>

        {user.twoFactorEnabled ? (
          showDisable ? (
            <View>
              <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginBottom: 8 }}>
                Enter your authenticator code to disable:
              </Text>
              <FormField
                label="6-digit code"
                value={disableCode}
                onChangeText={(v) => setDisableCode(v.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
              />
              {error ? (
                <Text style={{ fontSize: 12 * fontScale, color: colors.destructiveRed, marginBottom: 8 }}>
                  {error}
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={confirmDisable}
                  disabled={busy || disableCode.length !== 6}
                  style={{
                    flex: 1,
                    backgroundColor: colors.destructiveRed,
                    borderRadius: 8,
                    paddingVertical: 10,
                    alignItems: "center",
                    opacity: busy || disableCode.length !== 6 ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 * fontScale }}>
                    {busy ? "Disabling…" : "Confirm Disable"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { setShowDisable(false); setDisableCode(""); setError(null); }}
                  style={{ paddingVertical: 10, paddingHorizontal: 16 }}
                >
                  <Text style={{ color: colors.muted, fontSize: 13 * fontScale }}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: colors.completed + "22",
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 10,
                }}
              >
                <ShieldCheck color={colors.completed} size={16} />
                <Text style={{ fontSize: 13 * fontScale, color: colors.completed, fontWeight: "600" }}>
                  Two-factor authentication is enabled
                </Text>
              </View>
              <Pressable
                onPress={() => setShowDisable(true)}
                style={{
                  borderWidth: 1,
                  borderColor: colors.destructiveRed,
                  borderRadius: 8,
                  paddingVertical: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.destructiveRed, fontSize: 13 * fontScale }}>Disable 2FA</Text>
              </Pressable>
            </View>
          )
        ) : setup ? (
          <View>
            <Text style={{ fontSize: 12 * fontScale, fontWeight: "600", color: colors.text, marginBottom: 8 }}>
              Step 1: Scan with your authenticator app
            </Text>
            <Image
              source={{ uri: setup.qrCodeDataUrl }}
              style={{ width: 140, height: 140, borderRadius: 8, marginBottom: 8 }}
            />
            <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginBottom: 4 }}>
              Or enter this code manually:
            </Text>
            <Text
              style={{
                fontSize: 11 * fontScale,
                color: colors.text,
                backgroundColor: colors.bg,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                padding: 8,
                marginBottom: 12,
              }}
              selectable
            >
              {setup.secret}
            </Text>
            <Text style={{ fontSize: 12 * fontScale, fontWeight: "600", color: colors.text, marginBottom: 8 }}>
              Step 2: Enter the 6-digit code to confirm
            </Text>
            <FormField
              label="6-digit code"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
            />
            {error ? (
              <Text style={{ fontSize: 12 * fontScale, color: colors.destructiveRed, marginBottom: 8 }}>
                {error}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={confirmVerify}
                disabled={busy || code.length !== 6}
                style={{
                  flex: 1,
                  backgroundColor: colors.accent,
                  borderRadius: 8,
                  paddingVertical: 10,
                  alignItems: "center",
                  opacity: busy || code.length !== 6 ? 0.6 : 1,
                }}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 * fontScale }}>
                  {busy ? "Verifying…" : "Verify & Enable"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { setSetup(null); setCode(""); setError(null); }}
                style={{ paddingVertical: 10, paddingHorizontal: 16 }}
              >
                <Text style={{ color: colors.muted, fontSize: 13 * fontScale }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View>
            <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginBottom: 10 }}>
              Add an extra layer of security with an authenticator app.
            </Text>
            <Pressable
              onPress={startSetup}
              disabled={busy}
              style={{
                backgroundColor: colors.accent,
                borderRadius: 8,
                paddingVertical: 10,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
                opacity: busy ? 0.6 : 1,
              }}
            >
              <ShieldCheck color="#FFFFFF" size={16} />
              <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 * fontScale }}>
                {busy ? "Setting up…" : "Enable Two-Factor Authentication"}
              </Text>
            </Pressable>
          </View>
        )}
      </Card>
    </View>
  );
}
