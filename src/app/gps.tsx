import { router } from "expo-router";
import { ArrowLeft, CircleDot, Play, RefreshCw, Square } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Card, Screen } from "@/components/Screen";
import { tripStore, type GpsSessionRow } from "@/db";
import { useAuth } from "@/lib/auth";
import { GPS_MODES, isTracking, startTracking, stopTracking, syncGpsSessions, type GpsMode } from "@/lib/gps";
import { useTheme } from "@/theme/ThemeContext";

export default function GpsScreen() {
  const { colors, fontScale } = useTheme();
  const { token } = useAuth();

  const [mode, setMode] = useState<GpsMode>("standard");
  const [active, setActive] = useState<GpsSessionRow | null>(null);
  const [sessions, setSessions] = useState<GpsSessionRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setActive(await isTracking());
    setSessions(await tripStore.gpsListSessions(10));
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [refresh]);

  const onStart = async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await startTracking(mode, null);
      setNotice(
        result.background
          ? "Background tracking active — screen can be off."
          : "Foreground tracking (background needs the dev build) — keep the app open."
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not start tracking");
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const onStop = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await stopTracking();
      const res = await syncGpsSessions(token);
      setNotice(
        res.sessions > 0
          ? `Session saved — synced ${res.points} points to the server.`
          : "Session saved locally — will sync when online."
      );
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const onSync = async () => {
    setBusy(true);
    try {
      const res = await syncGpsSessions(token);
      setNotice(
        res.sessions > 0
          ? `Synced ${res.sessions} session${res.sessions === 1 ? "" : "s"} (${res.points} points).`
          : "Nothing to sync."
      );
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const trackingSince = active
    ? Math.max(0, Math.round((Date.now() - new Date(active.startedAt).getTime()) / 60000))
    : 0;

  return (
    <Screen>
      <Pressable
        onPress={() => router.back()}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}
      >
        <ArrowLeft color={colors.accent} size={20} />
        <Text style={{ color: colors.accent, fontSize: 14 * fontScale, fontWeight: "600" }}>
          Back
        </Text>
      </Pressable>

      <Text style={{ fontSize: 24 * fontScale, fontWeight: "700", color: colors.text }}>
        GPS Tracking
      </Text>
      <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginTop: 2, marginBottom: 16 }}>
        Points record to the on-device database and batch-sync when you have signal.
      </Text>

      {active ? (
        <Card style={{ marginBottom: 12, borderColor: colors.completed }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <CircleDot color={colors.completed} size={18} />
            <Text style={{ flex: 1, fontSize: 14 * fontScale, fontWeight: "700", color: colors.text }}>
              Recording — {GPS_MODES[active.mode as GpsMode]?.label ?? active.mode}
            </Text>
          </View>
          <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginTop: 6 }}>
            {active.pointCount} points · {trackingSince} min
          </Text>
          <Pressable
            onPress={onStop}
            disabled={busy}
            style={{
              backgroundColor: colors.destructiveRed,
              borderRadius: 8,
              paddingVertical: 12,
              alignItems: "center",
              marginTop: 12,
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Square color="#FFFFFF" size={16} />
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 * fontScale }}>
              Stop & save
            </Text>
          </Pressable>
        </Card>
      ) : (
        <>
          {(Object.keys(GPS_MODES) as GpsMode[]).map((key) => {
            const m = GPS_MODES[key];
            const selected = key === mode;
            return (
              <Pressable key={key} onPress={() => setMode(key)}>
                <Card
                  style={{
                    marginBottom: 8,
                    borderColor: selected ? colors.accent : colors.border,
                    borderWidth: selected ? 2 : 1,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 14 * fontScale,
                        fontWeight: "600",
                        color: colors.text,
                      }}
                    >
                      {m.label}
                    </Text>
                    <Text style={{ fontSize: 12 * fontScale, color: colors.accent, fontWeight: "600" }}>
                      {m.battery}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginTop: 2 }}>
                    Every {m.intervalS >= 60 ? `${m.intervalS / 60} min` : `${m.intervalS}s`} ·{" "}
                    {m.distanceM} m filter
                  </Text>
                </Card>
              </Pressable>
            );
          })}
          <Pressable
            onPress={onStart}
            disabled={busy}
            style={{
              backgroundColor: colors.accent,
              borderRadius: 8,
              paddingVertical: 14,
              alignItems: "center",
              marginTop: 4,
              marginBottom: 12,
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Play color="#FFFFFF" size={16} />
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 * fontScale }}>
              Start tracking
            </Text>
          </Pressable>
        </>
      )}

      {notice ? (
        <Text style={{ fontSize: 13 * fontScale, color: colors.offlineAmber, marginBottom: 12 }}>
          {notice}
        </Text>
      ) : null}

      {sessions.length > 0 ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ flex: 1, fontSize: 14 * fontScale, fontWeight: "700", color: colors.text }}>
              Recent sessions
            </Text>
            <Pressable
              onPress={onSync}
              disabled={busy}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <RefreshCw color={colors.accent} size={14} />
              <Text style={{ color: colors.accent, fontSize: 13 * fontScale, fontWeight: "600" }}>
                Sync
              </Text>
            </Pressable>
          </View>
          {sessions.map((s) => (
            <Card key={s.id} style={{ marginBottom: 8, paddingVertical: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ flex: 1, fontSize: 13 * fontScale, color: colors.text }}>
                  {s.startedAt.slice(0, 16).replace("T", " ")} ·{" "}
                  {GPS_MODES[s.mode as GpsMode]?.label ?? s.mode}
                </Text>
                <Text
                  style={{
                    fontSize: 12 * fontScale,
                    color: s.synced ? colors.completed : colors.offlineAmber,
                    fontWeight: "600",
                  }}
                >
                  {s.pointCount} pts {s.synced ? "✓ synced" : "· pending"}
                </Text>
              </View>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
