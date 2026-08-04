import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ArrowUp, WifiOff } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, Screen } from "@/components/Screen";
import { useAuth } from "@/lib/auth";
import { DM_POLL_MS, fetchDmMessages, sendDm, type DmMessage } from "@/lib/dms";
import { useTheme } from "@/theme/ThemeContext";

export default function DmThreadScreen() {
  const { userId: otherId, name, trailName } = useLocalSearchParams<{
    userId: string;
    name?: string;
    trailName?: string;
  }>();
  const { colors, fontScale } = useTheme();
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const displayName = trailName || name || "Hiker";

  const load = useCallback(async () => {
    if (!token || !otherId) return;
    try {
      const msgs = await fetchDmMessages(token, otherId);
      setMessages(msgs);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [token, otherId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Matches web's 10s poll (app/community/dms/[userId]/page.tsx POLL_MS).
  useEffect(() => {
    const timer = setInterval(() => void load(), DM_POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const send = async () => {
    if (!token || !otherId || !input.trim() || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");
    try {
      await sendDm(token, otherId, content);
      await load();
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch {
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  if (offline) {
    return (
      <Screen>
        <Pressable
          onPress={() => router.back()}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}
        >
          <ArrowLeft color={colors.accent} size={20} />
          <Text style={{ color: colors.accent, fontSize: 14 * fontScale, fontWeight: "600" }}>Back</Text>
        </Pressable>
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <WifiOff color={colors.offlineAmber} size={16} />
            <Text style={{ fontSize: 14 * fontScale, fontWeight: "600", color: colors.text }}>
              You&apos;re offline
            </Text>
          </View>
          <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginBottom: 12 }}>
            This conversation needs a connection to load.
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
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={{ flex: 1, paddingTop: insets.top + 12, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
          <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <ArrowLeft color={colors.accent} size={20} />
          </Pressable>
          <Text style={{ flex: 1, marginLeft: 8, fontSize: 17 * fontScale, fontWeight: "700", color: colors.text }} numberOfLines={1}>
            {displayName}
          </Text>
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 12 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.length === 0 ? (
            <Text style={{ fontSize: 13 * fontScale, color: colors.muted, textAlign: "center", marginTop: 24 }}>
              No messages yet — say hello.
            </Text>
          ) : (
            messages.map((m) => {
              const mine = m.senderId === user?.id;
              return (
                <View
                  key={m.id}
                  style={{
                    alignSelf: mine ? "flex-end" : "flex-start",
                    maxWidth: "80%",
                    marginBottom: 10,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: mine ? colors.accent : colors.surface,
                      borderWidth: mine ? 0 : 1,
                      borderColor: colors.border,
                      borderRadius: 16,
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                    }}
                  >
                    <Text style={{ fontSize: 14 * fontScale, color: mine ? "#FFFFFF" : colors.text }}>
                      {m.content}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, paddingTop: 8, paddingBottom: insets.bottom + 12 }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={`Message ${displayName}…`}
            placeholderTextColor={colors.muted}
            multiline
            maxLength={2000}
            style={{
              flex: 1,
              maxHeight: 100,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 9,
              backgroundColor: colors.surface,
              color: colors.text,
              fontSize: 14 * fontScale,
            }}
          />
          <Pressable
            onPress={() => void send()}
            disabled={!input.trim() || sending}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: input.trim() && !sending ? colors.accent : colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowUp color="#FFFFFF" size={19} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
