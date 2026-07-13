import { router } from "expo-router";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  Crown,
  ShieldCheck,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Share,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FormField } from "@/components/FormField";
import { PickerModal } from "@/components/PickerModal";
import { Card } from "@/components/Screen";
import { ACCENT_PRESETS, CARRIER_OPTIONS, carrierLabel } from "@/lib/carriers";
import { GPS_MODES, fromWebPowerMode, toWebPowerMode, type GpsMode } from "@/lib/gps";
import { useAuth } from "@/lib/auth";
import {
  disable2fa,
  generateShareSlug,
  start2faSetup,
  updateWebUser,
  verify2fa,
  type WebUser,
  type WebUserUpdate,
} from "@/lib/webApi";
import { apiFetch } from "@/lib/api";
import { getBriefingHour, setBriefingHour } from "@/lib/prefs";
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

function SaveButton({ onPress, saving, saved }: { onPress: () => void; saving: boolean; saved: boolean }) {
  const { colors, fontScale } = useTheme();
  return (
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
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) return;
      try {
        setUser(await apiFetch<WebUser>("/api/user", { token }));
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Couldn't load your profile");
      }
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
        {!user ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            {tab === "trailMode" ? <TrailModeTab user={user} setUser={setUser} /> : null}
            {tab === "profile" ? <ProfileTab user={user} setUser={setUser} /> : null}
            {tab === "appearance" ? <AppearanceTab user={user} setUser={setUser} /> : null}
            {tab === "account" ? <AccountTab user={user} setUser={setUser} /> : null}
          </>
        )}
      </ScrollView>
    </View>
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
  const [onTrailMode, setOnTrailMode] = useState(user.onTrailMode);
  const [daysAhead, setDaysAhead] = useState(user.daysAheadForBriefings ?? 2);
  const [gpsEnabled, setGpsEnabled] = useState(user.gpsTrackingEnabled);
  const [powerMode, setPowerMode] = useState<GpsMode>(fromWebPowerMode(user.gpsPowerMode));
  const [briefingHour, setBriefingHourState] = useState(7);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void getBriefingHour().then(setBriefingHourState);
  }, []);

  const save = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await setBriefingHour(briefingHour);
      const updated = await updateWebUser(token, {
        onTrailMode,
        daysAheadForBriefings: daysAhead,
        gpsTrackingEnabled: gpsEnabled,
        gpsPowerMode: toWebPowerMode(powerMode),
      });
      setUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Non-fatal — form state stays editable
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
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
      </Card>

      <SaveButton onPress={save} saving={saving} saved={saved} />
    </View>
  );
}

// ─── Profile ─────────────────────────────────────────────────────────────────

function ProfileTab({
  user,
  setUser,
}: {
  user: WebUser;
  setUser: (u: WebUser) => void;
}) {
  const { colors, fontScale } = useTheme();
  const { token } = useAuth();
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const updated = await updateWebUser(token, {
        name,
        trailName,
        bio,
        homeZip,
        carrierProvider: carrier || null,
        typicalDailyMiles: dailyMiles ? Number(dailyMiles) : null,
        hikingSpeedMph: speed ? Number(speed) : null,
        ...visibility,
      } as WebUserUpdate);
      setUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Non-fatal
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

      <SaveButton onPress={save} saving={saving} saved={saved} />

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
}: {
  user: WebUser;
  setUser: (u: WebUser) => void;
}) {
  const { colors, fontScale, mode, setMode, textSize, setTextSize, setAccentColor } = useTheme();
  const { token } = useAuth();
  const [distanceUnit, setDistanceUnit] = useState(user.distanceUnit);
  const [tempUnit, setTempUnit] = useState(user.tempUnit);
  const [weightUnit, setWeightUnit] = useState(user.weightUnit);
  const [timeFormat, setTimeFormat] = useState(user.timeFormat);
  const [dateFormat, setDateFormat] = useState(user.dateFormat);
  const [accentHex, setAccentHex] = useState(user.accentColor ?? DEFAULT_ACCENT);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const applyAccent = (hex: string) => {
    setAccentHex(hex);
    setAccentColor(hex);
  };

  const save = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const updated = await updateWebUser(token, {
        distanceUnit,
        tempUnit,
        weightUnit,
        timeFormat,
        dateFormat,
        accentColor: accentHex,
      });
      setUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Non-fatal
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

      <SaveButton onPress={save} saving={saving} saved={saved} />
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
