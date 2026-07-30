import { router } from "expo-router";
import { ArrowLeft, MessageCircle, WifiOff } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Card, Screen } from "@/components/Screen";
import { useAuth } from "@/lib/auth";
import { fetchDmThreads, type DmThread } from "@/lib/dms";
import { useTheme } from "@/theme/ThemeContext";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

export default function DmInboxScreen() {
  const { colors, fontScale } = useTheme();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [threads, setThreads] = useState<DmThread[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchDmThreads(token);
      setThreads(res);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

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
        <Text style={{ color: colors.accent, fontSize: 14 * fontScale, fontWeight: "600" }}>Back</Text>
      </Pressable>

      <Text style={{ fontSize: 24 * fontScale, fontWeight: "700", color: colors.text, marginBottom: 16 }}>
        Messages
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : offline ? (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <WifiOff color={colors.offlineAmber} size={16} />
            <Text style={{ fontSize: 14 * fontScale, fontWeight: "600", color: colors.text }}>
              You&apos;re offline
            </Text>
          </View>
          <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginBottom: 12 }}>
            Messages need a connection — they&apos;ll load again once you&apos;re back in signal.
          </Text>
          <Pressable
            onPress={() => {
              setLoading(true);
              void load();
            }}
            style={{ borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingVertical: 10, alignItems: "center" }}
          >
            <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 * fontScale }}>Try again</Text>
          </Pressable>
        </Card>
      ) : threads.length === 0 ? (
        <Card>
          <Text style={{ fontSize: 14 * fontScale, fontWeight: "600", color: colors.text }}>
            No messages yet
          </Text>
          <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginTop: 4 }}>
            Conversations with other hikers will show up here.
          </Text>
        </Card>
      ) : (
        threads.map((t) => (
          <Pressable
            key={t.userId}
            onPress={() =>
              router.push({
                pathname: "/dms/[userId]",
                params: { userId: t.userId, name: t.user.name ?? "", trailName: t.user.trailName ?? "" },
              })
            }
          >
            <Card style={{ marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: `${colors.accent}15`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MessageCircle color={colors.accent} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 15 * fontScale,
                    fontWeight: t.unreadCount > 0 ? "700" : "600",
                    color: colors.text,
                  }}
                  numberOfLines={1}
                >
                  {t.user.trailName || t.user.name || "Hiker"}
                </Text>
                <Text
                  style={{
                    fontSize: 12 * fontScale,
                    color: t.unreadCount > 0 ? colors.text : colors.muted,
                    marginTop: 1,
                  }}
                  numberOfLines={1}
                >
                  {t.lastMessage}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>{timeAgo(t.lastAt)}</Text>
                {t.unreadCount > 0 ? (
                  <View
                    style={{
                      marginTop: 4,
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      paddingHorizontal: 4,
                      backgroundColor: colors.accent,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "700" }}>
                      {t.unreadCount > 99 ? "99+" : t.unreadCount}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}
