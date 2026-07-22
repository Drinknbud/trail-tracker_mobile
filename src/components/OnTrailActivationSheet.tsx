import { Check, MapPin, Radio, Tent } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tripStore, type SectionRow } from "@/db";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { GPS_MODES, fromWebPowerMode, startTracking, toWebPowerMode, type GpsMode } from "@/lib/gps";
import { useOnTrail } from "@/lib/onTrail";
import { downloadTrip } from "@/lib/trip-download";
import { useUnits } from "@/lib/units-context";
import { fetchWebUser } from "@/lib/webApi";
import { useTheme } from "@/theme/ThemeContext";

// Mobile port of web's OnTrailActivationModal ("You're heading on trail!"):
// pick the section, set GPS mode + live-location sharing, set briefing
// prefetch days — one confirm PATCHes everything, starts the GPS session
// (which web can't do), and downloads the section's offline package.

type SectionsResponse = { sections: SectionRow[] };

const GPS_MODE_KEYS = Object.keys(GPS_MODES) as GpsMode[];

// Deliberately NOT using the dateFormat setting here — this is a compact
// "Jul 4 – Jul 8" list-item label (no year), and fmtDate's MDY/DMY output
// always includes the year, which would make this picker row much longer.
// Unambiguous short-month-name dates like this don't need the MDY/DMY
// distinction anyway (matches web, which also always uses this fixed style
// for compact date ranges rather than the dateFormat setting).
function fmtRange(startDate: string | null, endDate: string | null): string {
  if (!startDate) return "";
  const fmt = (d: string) =>
    new Date(d.slice(0, 10) + "T12:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  const s = startDate.slice(0, 10);
  const e = endDate?.slice(0, 10);
  return e && e !== s ? `${fmt(s)} – ${fmt(e)}` : fmt(s);
}

export function OnTrailActivationSheet() {
  const { colors, fontScale } = useTheme();
  const { fmtMiles } = useUnits();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { activationVisible, cancelActivation, applyServerValue } = useOnTrail();

  const [sections, setSections] = useState<SectionRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enableGps, setEnableGps] = useState(true);
  const [gpsMode, setGpsMode] = useState<GpsMode>("low");
  const [shareLocation, setShareLocation] = useState(false);
  const [enableBriefings, setEnableBriefings] = useState(true);
  const [daysAhead, setDaysAhead] = useState(2);
  const [saving, setSaving] = useState(false);
  const [statusLine, setStatusLine] = useState<string | null>(null);

  // Load planned sections (local first — this must work offline) + prefill
  // from saved settings when the sheet opens.
  useEffect(() => {
    if (!activationVisible) return;
    let cancelled = false;
    (async () => {
      await tripStore.init();
      let planned = (await tripStore.listSections()).filter((s) => s.status === "planned");
      if (token) {
        try {
          const res = await apiFetch<SectionsResponse>("/api/mobile/sections", { token });
          await tripStore.upsertSections(res.sections);
          planned = (await tripStore.listSections()).filter((s) => s.status === "planned");
        } catch {
          // Offline — local list stands
        }
        try {
          const user = await fetchWebUser(token);
          if (!cancelled) {
            setGpsMode(fromWebPowerMode(user.gpsPowerMode));
            setShareLocation(user.shareShowLocation);
            setDaysAhead(user.daysAheadForBriefings ?? 2);
          }
        } catch {
          // Defaults stand
        }
      }
      if (cancelled) return;
      // Soonest upcoming first (nulls last), matching web's default pick
      planned.sort((a, b) => (a.startDate ?? "9999") < (b.startDate ?? "9999") ? -1 : 1);
      setSections(planned);
      setSelectedId(planned[0]?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [activationVisible, token]);

  const confirm = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (token) {
        setStatusLine("Saving your trail settings…");
        try {
          await apiFetch("/api/user", {
            method: "PATCH",
            token,
            body: {
              onTrailMode: true,
              onTrailSectionId: selectedId,
              gpsTrackingEnabled: enableGps,
              gpsPowerMode: toWebPowerMode(gpsMode),
              shareShowLocation: enableGps ? shareLocation : false,
              daysAheadForBriefings: enableBriefings ? daysAhead : undefined,
            },
          });
        } catch {
          // Spotty signal at the trailhead can't block going on trail — this
          // app is offline-first. Activate locally; settings reconcile on the
          // next successful sync.
        }
      }
      applyServerValue(true); // the bar flips to the field layout now

      if (enableGps) {
        setStatusLine("Starting GPS tracking…");
        try {
          await startTracking(gpsMode, selectedId);
        } catch {
          // Permission denied or Expo Go limitation — mode still activates;
          // tracking can be started later from Settings > GPS.
        }
      }

      if (selectedId) {
        setStatusLine("Saving section data for offline use…");
        try {
          await downloadTrip(selectedId, token);
        } catch {
          // Non-fatal — the Journal's Download button retries this
        }
      }

      cancelActivation();
    } finally {
      setSaving(false);
      setStatusLine(null);
    }
  }, [saving, token, selectedId, enableGps, gpsMode, shareLocation, enableBriefings, daysAhead, applyServerValue, cancelActivation]);

  const journal = sections.filter((s) => s.inJournal);
  const planner = sections.filter((s) => !s.inJournal);

  const SectionRowItem = ({ s }: { s: SectionRow }) => {
    const active = s.id === selectedId;
    const dates = fmtRange(s.startDate, s.endDate);
    return (
      <Pressable
        onPress={() => setSelectedId(s.id)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingVertical: 9,
          paddingHorizontal: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: active ? colors.accent : colors.border,
          backgroundColor: active ? `${colors.accent}14` : "transparent",
          marginBottom: 6,
        }}
      >
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            borderWidth: 2,
            borderColor: active ? colors.accent : colors.muted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {active ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13 * fontScale, fontWeight: "600", color: colors.text }} numberOfLines={1}>
            {s.name}
          </Text>
          <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
            {fmtMiles(s.miles)}{dates ? ` · ${dates}` : ""}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <Modal visible={activationVisible} transparent animationType="slide" onRequestClose={cancelActivation}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" }}>
        <Pressable style={{ flex: 1 }} onPress={saving ? undefined : cancelActivation} />
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: "88%",
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 18, paddingBottom: 10 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: `${colors.accent}18`,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Tent color={colors.accent} size={19} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16 * fontScale, fontWeight: "700", color: colors.text }}>
                You&apos;re heading on trail!
              </Text>
              <Text style={{ fontSize: 12 * fontScale, color: colors.muted }}>
                Choose your section and settings below.
              </Text>
            </View>
          </View>

          <ScrollView style={{ paddingHorizontal: 18 }} contentContainerStyle={{ paddingBottom: 8 }}>
            {/* Section picker */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <MapPin color={colors.muted} size={14} />
              <Text style={{ fontSize: 12 * fontScale, fontWeight: "600", color: colors.muted }}>Section</Text>
            </View>
            {sections.length === 0 ? (
              <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginBottom: 10 }}>
                No upcoming planned sections found.
              </Text>
            ) : (
              <View style={{ maxHeight: 190, marginBottom: 4 }}>
                <ScrollView nestedScrollEnabled>
                  {journal.length > 0 ? (
                    <Text style={{ fontSize: 10 * fontScale, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                      Trail Journal
                    </Text>
                  ) : null}
                  {journal.map((s) => (
                    <SectionRowItem key={s.id} s={s} />
                  ))}
                  {planner.length > 0 ? (
                    <Text style={{ fontSize: 10 * fontScale, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginVertical: 4 }}>
                      Trip Planner
                    </Text>
                  ) : null}
                  {planner.map((s) => (
                    <SectionRowItem key={s.id} s={s} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* GPS */}
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Radio color={colors.accent} size={15} />
                <Text style={{ flex: 1, fontSize: 14 * fontScale, fontWeight: "600", color: colors.text }}>
                  GPS Tracking
                </Text>
                <Switch
                  value={enableGps}
                  onValueChange={setEnableGps}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>
              {enableGps ? (
                <View style={{ marginTop: 10 }}>
                  {GPS_MODE_KEYS.map((key) => {
                    const m = GPS_MODES[key];
                    const active = gpsMode === key;
                    return (
                      <Pressable
                        key={key}
                        onPress={() => setGpsMode(key)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: active ? colors.accent : colors.border,
                          backgroundColor: active ? `${colors.accent}14` : "transparent",
                          marginBottom: 6,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13 * fontScale, fontWeight: "600", color: colors.text }}>
                            {m.label}
                          </Text>
                          <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
                            Every {m.intervalS >= 60 ? `${Math.round((m.intervalS / 60) * 10) / 10} min` : `${m.intervalS}s`} · {m.battery} battery
                          </Text>
                        </View>
                        {active ? <Check color={colors.accent} size={16} /> : null}
                      </Pressable>
                    );
                  })}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
                    <Text style={{ flex: 1, fontSize: 12 * fontScale, color: colors.text }}>
                      Share live location on your share page
                    </Text>
                    <Switch
                      value={shareLocation}
                      onValueChange={setShareLocation}
                      trackColor={{ false: colors.border, true: colors.accent }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                </View>
              ) : null}
            </View>

            {/* Briefings */}
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ flex: 1, fontSize: 14 * fontScale, fontWeight: "600", color: colors.text }}>
                  Auto-sync morning briefings
                </Text>
                <Switch
                  value={enableBriefings}
                  onValueChange={setEnableBriefings}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>
              {enableBriefings ? (
                <View style={{ marginTop: 10 }}>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {[1, 2, 3, 4, 5].map((n) => {
                      const active = daysAhead === n;
                      return (
                        <Pressable
                          key={n}
                          onPress={() => setDaysAhead(n)}
                          style={{
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: 8,
                            borderWidth: 1,
                            alignItems: "center",
                            borderColor: active ? colors.accent : colors.border,
                            backgroundColor: active ? colors.accent : "transparent",
                          }}
                        >
                          <Text style={{ fontSize: 13 * fontScale, fontWeight: "600", color: active ? "#FFFFFF" : colors.text }}>
                            {n}d
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginTop: 6 }}>
                    Prefetch briefings for the next {daysAhead} day{daysAhead !== 1 ? "s" : ""} when signal returns.
                  </Text>
                </View>
              ) : null}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={{ paddingHorizontal: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
            {statusLine ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={{ fontSize: 12 * fontScale, color: colors.muted }}>{statusLine}</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={cancelActivation}
                disabled={saving}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  opacity: saving ? 0.5 : 1,
                }}
              >
                <Text style={{ fontSize: 14 * fontScale, fontWeight: "600", color: colors.text }}>Not yet</Text>
              </Pressable>
              <Pressable
                onPress={confirm}
                disabled={saving}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: colors.accent,
                  alignItems: "center",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                <Text style={{ fontSize: 14 * fontScale, fontWeight: "700", color: "#FFFFFF" }}>
                  {saving ? "Setting up…" : "Start hiking!"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
