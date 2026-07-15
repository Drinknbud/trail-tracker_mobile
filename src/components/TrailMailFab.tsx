import { router } from "expo-router";
import { Mail } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tripStore, type TrailMailRow } from "@/db";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useOnTrail } from "@/lib/onTrail";
import { useTheme } from "@/theme/ThemeContext";

// "You've got mail" — floating letter button, On Trail mode only, visible
// only while unread Trail Mail exists. Reads from the local SQLite cache
// (works in airplane mode) with a best-effort server refresh when online;
// disappears once the mail screen marks everything read.

const POLL_MS = 20_000; // local SQLite count — cheap

export function TrailMailFab() {
  const { colors, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { onTrail } = useOnTrail();
  const [unread, setUnread] = useState(0);

  const checkLocal = useCallback(async () => {
    try {
      await tripStore.init();
      const mail = await tripStore.listTrailMail();
      setUnread(mail.filter((m) => !m.isRead).length);
    } catch {
      // Badge is best-effort
    }
  }, []);

  const refreshFromServer = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch<{ mail: TrailMailRow[] }>("/api/mobile/trail-mail", { token });
      await tripStore.upsertTrailMail(res.mail);
    } catch {
      // Offline — local cache stands
    }
    await checkLocal();
  }, [token, checkLocal]);

  useEffect(() => {
    if (!onTrail) return;
    void refreshFromServer();
    const interval = setInterval(() => void checkLocal(), POLL_MS);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void refreshFromServer();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [onTrail, refreshFromServer, checkLocal]);

  if (!onTrail || unread === 0) return null;

  return (
    <Pressable
      onPress={() => router.push("/trail-mail")}
      style={{
        position: "absolute",
        right: 16,
        bottom: 62 + insets.bottom + 14, // floats just above the field tab bar
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
        elevation: 6,
        shadowColor: "#000",
        shadowOpacity: 0.3,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
      }}
    >
      <Mail color="#FFFFFF" size={24} />
      <View
        style={{
          position: "absolute",
          top: -4,
          right: -4,
          minWidth: 20,
          height: 20,
          borderRadius: 10,
          paddingHorizontal: 5,
          backgroundColor: colors.offlineAmber,
          borderWidth: 2,
          borderColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 11 * fontScale, fontWeight: "700" }}>
          {unread > 9 ? "9+" : unread}
        </Text>
      </View>
    </Pressable>
  );
}
