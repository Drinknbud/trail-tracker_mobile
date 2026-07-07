import { router } from "expo-router";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Card, Screen } from "@/components/Screen";
import { tripStore, type TripStatusEntry } from "@/db";
import { useAuth } from "@/lib/auth";
import { flushOutbox } from "@/lib/outbox";
import { useTheme } from "@/theme/ThemeContext";

function formatBytes(n: number): string {
  if (n > 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n > 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

const COUNT_LABELS: [keyof TripStatusEntry["liveCounts"], string][] = [
  ["briefings", "Briefings"],
  ["pois", "POIs"],
  ["nightLogs", "Night logs"],
  ["dayLogs", "Day logs"],
  ["elevationPoints", "Elevation pts"],
];

export default function TripStatusScreen() {
  const { colors, fontScale } = useTheme();
  const { token } = useAuth();
  const [entries, setEntries] = useState<TripStatusEntry[]>([]);
  const [outboxCount, setOutboxCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    await tripStore.init();
    setEntries(await tripStore.getTripStatus());
    setOutboxCount(await tripStore.getOutboxCount());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

      <Text
        style={{ fontSize: 24 * fontScale, fontWeight: "700", color: colors.text, marginBottom: 4 }}
      >
        Trip Status
      </Text>
      <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginBottom: 16 }}>
        What&apos;s stored on this device for offline use.
      </Text>

      <Card style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 14 * fontScale, color: colors.text }}>
            Pending sync (outbox)
          </Text>
          <Text style={{ fontSize: 14 * fontScale, fontWeight: "700", color: colors.text }}>
            {outboxCount}
          </Text>
        </View>
        {outboxCount > 0 ? (
          <Pressable
            onPress={async () => {
              setSyncing(true);
              try {
                await flushOutbox(token);
              } finally {
                setSyncing(false);
                await load();
              }
            }}
            disabled={syncing}
            style={{
              backgroundColor: colors.accent,
              borderRadius: 8,
              paddingVertical: 10,
              alignItems: "center",
              marginTop: 10,
              opacity: syncing ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 * fontScale }}>
              {syncing ? "Syncing…" : "Sync now"}
            </Text>
          </Pressable>
        ) : null}
      </Card>

      {entries.length === 0 ? (
        <Card>
          <Text style={{ fontSize: 14 * fontScale, fontWeight: "600", color: colors.text }}>
            No trips downloaded
          </Text>
          <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginTop: 4 }}>
            Use the Download button on a section in the Trail Journal.
          </Text>
        </Card>
      ) : (
        entries.map((e) => (
          <Card key={e.sectionId} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              {e.verified ? (
                <CheckCircle2 color={colors.completed} size={18} />
              ) : (
                <XCircle color={colors.destructiveRed} size={18} />
              )}
              <Text
                style={{
                  flex: 1,
                  fontSize: 15 * fontScale,
                  fontWeight: "600",
                  color: colors.text,
                  marginLeft: 8,
                }}
                numberOfLines={1}
              >
                {e.sectionName}
              </Text>
              <Text style={{ fontSize: 12 * fontScale, color: colors.muted }}>
                {formatBytes(e.bytes)}
              </Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {COUNT_LABELS.map(([key, label]) => (
                <View
                  key={key}
                  style={{
                    backgroundColor: colors.bg,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
                    {label}: <Text style={{ color: colors.text, fontWeight: "600" }}>{e.liveCounts[key]}</Text>
                  </Text>
                </View>
              ))}
            </View>
            <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginTop: 8 }}>
              Downloaded {e.downloadedAt.slice(0, 16).replace("T", " ")}
              {e.verified ? " · verified ✓" : ""}
            </Text>
            {e.error ? (
              <Text style={{ fontSize: 12 * fontScale, color: colors.destructiveRed, marginTop: 4 }}>
                {e.error}
              </Text>
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}
