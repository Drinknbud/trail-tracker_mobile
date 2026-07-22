import { router } from "expo-router";
import { ArrowLeft, Mail, MailOpen } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Card, Screen } from "@/components/Screen";
import { tripStore, type TrailMailRow } from "@/db";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { enqueueWrite } from "@/lib/outbox";
import { useUnits } from "@/lib/units-context";
import { useTheme } from "@/theme/ThemeContext";

export default function TrailMailScreen() {
  const { colors, fontScale } = useTheme();
  const { fmtDate } = useUnits();
  const { token } = useAuth();
  const [mail, setMail] = useState<TrailMailRow[]>([]);
  const [offline, setOffline] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    await tripStore.init();
    setMail(await tripStore.listTrailMail());
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      if (!token) return;
      try {
        const res = await apiFetch<{ mail: TrailMailRow[] }>("/api/mobile/trail-mail", { token });
        await tripStore.upsertTrailMail(res.mail);
        setOffline(false);
        await load();
      } catch {
        setOffline(true);
      }
    })();
  }, [token, load]);

  const openMessage = async (m: TrailMailRow) => {
    setOpenId(openId === m.id ? null : m.id);
    if (!m.isRead) {
      await tripStore.markTrailMailRead(m.id);
      await enqueueWrite("/api/mobile/trail-mail/read", { id: m.id }, `mail-read-${m.id}`, token);
      await load();
    }
  };

  const unread = mail.filter((m) => !m.isRead).length;

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
        Trail Mail
      </Text>
      <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginTop: 2, marginBottom: 16 }}>
        Messages from your share-page visitors{unread > 0 ? ` · ${unread} unread` : ""}
        {offline ? " · offline, showing saved" : ""}
      </Text>

      {mail.length === 0 ? (
        <Card>
          <Text style={{ fontSize: 14 * fontScale, fontWeight: "600", color: colors.text }}>
            No mail yet
          </Text>
          <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginTop: 4 }}>
            When friends and family leave messages on your share page, they land here — readable
            offline once synced.
          </Text>
        </Card>
      ) : (
        mail.map((m) => {
          const open = openId === m.id;
          return (
            <Pressable key={m.id} onPress={() => openMessage(m)}>
              <Card style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {m.isRead ? (
                    <MailOpen color={colors.muted} size={16} />
                  ) : (
                    <Mail color={colors.accent} size={16} />
                  )}
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 14 * fontScale,
                      fontWeight: m.isRead ? "400" : "700",
                      color: colors.text,
                    }}
                    numberOfLines={1}
                  >
                    {m.senderName || "Anonymous"}
                  </Text>
                  <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
                    {fmtDate(m.createdAt)}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 13 * fontScale,
                    color: m.isRead && !open ? colors.muted : colors.text,
                    marginTop: 6,
                    lineHeight: 19 * fontScale,
                  }}
                  numberOfLines={open ? undefined : 2}
                >
                  {m.message}
                </Text>
              </Card>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}
