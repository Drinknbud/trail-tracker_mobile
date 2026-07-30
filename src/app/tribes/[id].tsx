import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  ArrowUp,
  Crown,
  LogOut,
  Shield,
  UserPlus,
  Users,
  WifiOff,
} from "lucide-react-native";
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

import { FormField } from "@/components/FormField";
import { Card, Screen } from "@/components/Screen";
import { useAuth } from "@/lib/auth";
import {
  fetchTribe,
  fetchTribeMessages,
  inviteToTribe,
  leaveTribe,
  removeMember,
  sendTribeMessage,
  setMemberRole,
  TRIBE_MESSAGE_POLL_MS,
  type TribeDetail,
  type TribeMessage,
} from "@/lib/tribes";
import { useTheme } from "@/theme/ThemeContext";

function RoleIcon({ role, color }: { role: string; color: string }) {
  if (role === "owner") return <Crown color={color} size={13} />;
  if (role === "admin") return <Shield color={color} size={13} />;
  return null;
}

export default function TribeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, fontScale } = useTheme();
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();

  const [tribe, setTribe] = useState<TribeDetail | null>(null);
  const [messages, setMessages] = useState<TribeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteValue, setInviteValue] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const loadTribe = useCallback(async () => {
    if (!token || !id) return;
    try {
      const t = await fetchTribe(token, id);
      setTribe(t);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  const loadMessages = useCallback(async () => {
    if (!token || !id) return;
    try {
      const msgs = await fetchTribeMessages(token, id);
      setMessages(msgs);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, [token, id]);

  useEffect(() => {
    void loadTribe();
    void loadMessages();
  }, [loadTribe, loadMessages]);

  // Match web's 10s poll (components/community/TribeChatPanel.tsx) — no
  // push/WebSocket transport yet, per the open question in requirements §5.3.
  useEffect(() => {
    const timer = setInterval(() => void loadMessages(), TRIBE_MESSAGE_POLL_MS);
    return () => clearInterval(timer);
  }, [loadMessages]);

  const send = async () => {
    if (!token || !id || !input.trim() || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");
    try {
      await sendTribeMessage(token, id, { content });
      await loadMessages();
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch {
      setInput(content); // restore so the user doesn't lose what they typed
    } finally {
      setSending(false);
    }
  };

  const handleInvite = async () => {
    if (!token || !id || !inviteValue.trim() || inviteBusy) return;
    setInviteBusy(true);
    setInviteError(null);
    try {
      const isEmail = inviteValue.includes("@");
      await inviteToTribe(token, id, isEmail ? { email: inviteValue.trim() } : { trailName: inviteValue.trim() });
      setInviteValue("");
      setShowInvite(false);
      await loadTribe();
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Couldn't send invite");
    } finally {
      setInviteBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!token || !tribe) return;
    await leaveTribe(token, tribe.id, tribe.myMemberId);
    router.back();
  };

  const handleRemove = async (memberId: string) => {
    if (!token || !tribe) return;
    await removeMember(token, tribe.id, memberId);
    await loadTribe();
  };

  const handlePromote = async (memberId: string, role: "admin" | "member") => {
    if (!token || !tribe) return;
    await setMemberRole(token, tribe.id, memberId, role);
    await loadTribe();
  };

  const canManage = tribe?.myRole === "owner" || tribe?.myRole === "admin";

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  if (offline || !tribe) {
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
            This tribe needs a connection to load.
          </Text>
          <Pressable
            onPress={() => {
              setLoading(true);
              void loadTribe();
              void loadMessages();
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flex: 1, paddingTop: insets.top + 12, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <ArrowLeft color={colors.accent} size={20} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={{ fontSize: 17 * fontScale, fontWeight: "700", color: colors.text }} numberOfLines={1}>
              {tribe.name}
            </Text>
            <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
              {tribe.members.filter((m) => m.status === "accepted").length} member
              {tribe.members.filter((m) => m.status === "accepted").length === 1 ? "" : "s"}
            </Text>
          </View>
          <Pressable onPress={() => setShowMembers((v) => !v)} style={{ padding: 6 }}>
            <Users color={colors.accent} size={20} />
          </Pressable>
        </View>

        {showMembers ? (
          <Card style={{ marginBottom: 10 }}>
            {tribe.members
              .filter((m) => m.status === "accepted")
              .map((m) => (
                <View key={m.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }}>
                  <RoleIcon role={m.role} color={colors.muted} />
                  <Text style={{ flex: 1, fontSize: 13 * fontScale, color: colors.text }} numberOfLines={1}>
                    {m.user?.trailName || m.user?.name || m.inviteeEmail}
                  </Text>
                  {canManage && m.role !== "owner" && m.userId !== user?.id ? (
                    <>
                      {m.role === "member" ? (
                        <Pressable onPress={() => void handlePromote(m.id, "admin")}>
                          <Text style={{ fontSize: 11 * fontScale, color: colors.accent }}>Make admin</Text>
                        </Pressable>
                      ) : (
                        <Pressable onPress={() => void handlePromote(m.id, "member")}>
                          <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>Demote</Text>
                        </Pressable>
                      )}
                      <Pressable onPress={() => void handleRemove(m.id)}>
                        <Text style={{ fontSize: 11 * fontScale, color: colors.destructiveRed, marginLeft: 8 }}>
                          Remove
                        </Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>
              ))}

            {canManage ? (
              showInvite ? (
                <View style={{ marginTop: 10 }}>
                  <FormField
                    label="Invite by email or trail name"
                    value={inviteValue}
                    onChangeText={setInviteValue}
                    placeholder="trail.name@example.com"
                    autoCapitalize="none"
                  />
                  {inviteError ? (
                    <Text style={{ fontSize: 12 * fontScale, color: colors.destructiveRed, marginBottom: 8 }}>
                      {inviteError}
                    </Text>
                  ) : null}
                  <Pressable
                    onPress={() => void handleInvite()}
                    disabled={!inviteValue.trim() || inviteBusy}
                    style={{
                      backgroundColor: colors.accent,
                      borderRadius: 8,
                      paddingVertical: 9,
                      alignItems: "center",
                      opacity: !inviteValue.trim() || inviteBusy ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 * fontScale }}>
                      {inviteBusy ? "Sending…" : "Send invite"}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => setShowInvite(true)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}
                >
                  <UserPlus color={colors.accent} size={15} />
                  <Text style={{ fontSize: 13 * fontScale, color: colors.accent, fontWeight: "600" }}>Invite</Text>
                </Pressable>
              )
            ) : null}

            {!tribe.isAutoTrail ? (
              <Pressable
                onPress={() => void handleLeave()}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 }}
              >
                <LogOut color={colors.destructiveRed} size={15} />
                <Text style={{ fontSize: 13 * fontScale, color: colors.destructiveRed, fontWeight: "600" }}>
                  Leave tribe
                </Text>
              </Pressable>
            ) : null}
          </Card>
        ) : null}

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
              const mine = m.userId === user?.id;
              return (
                <View
                  key={m.id}
                  style={{
                    alignSelf: mine ? "flex-end" : "flex-start",
                    maxWidth: "80%",
                    marginBottom: 10,
                  }}
                >
                  {!mine ? (
                    <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginBottom: 2, marginLeft: 4 }}>
                      {m.user.trailName || m.user.name || "Hiker"}
                    </Text>
                  ) : null}
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

        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, paddingTop: 8, paddingBottom: 12 }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Message the tribe…"
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
