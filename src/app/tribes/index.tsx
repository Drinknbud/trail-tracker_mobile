import { router } from "expo-router";
import { ArrowLeft, Plus, Users, WifiOff } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { FormField } from "@/components/FormField";
import { Card, Screen } from "@/components/Screen";
import { useAuth } from "@/lib/auth";
import {
  createTribe,
  fetchTribes,
  joinTrailTribe,
  type JoinableTrailTribe,
  type TribeSummary,
} from "@/lib/tribes";
import { useTheme } from "@/theme/ThemeContext";

export default function TribesScreen() {
  const { colors, fontScale } = useTheme();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [tribes, setTribes] = useState<TribeSummary[]>([]);
  const [joinable, setJoinable] = useState<JoinableTrailTribe | null>(null);
  const [joining, setJoining] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchTribes(token);
      setTribes(res.tribes);
      setJoinable(res.joinableTrailTribe);
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

  const handleJoin = async () => {
    if (!token || !joinable || joining) return;
    setJoining(true);
    try {
      await joinTrailTribe(token, joinable.trailKey);
      await load();
    } catch {
      // best-effort; user can retry via the button
    } finally {
      setJoining(false);
    }
  };

  const handleCreate = async () => {
    if (!token || !name.trim() || creating) return;
    setCreating(true);
    try {
      const tribe = await createTribe(token, { name: name.trim(), description: description.trim() || undefined });
      setShowCreate(false);
      setName("");
      setDescription("");
      await load();
      router.push(`/tribes/${tribe.id}`);
    } catch {
      // best-effort; form stays open so the user can retry
    } finally {
      setCreating(false);
    }
  };

  return (
    <Screen>
      <Pressable
        onPress={() => router.back()}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}
      >
        <ArrowLeft color={colors.accent} size={20} />
        <Text style={{ color: colors.accent, fontSize: 14 * fontScale, fontWeight: "600" }}>Back</Text>
      </Pressable>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <Text style={{ fontSize: 24 * fontScale, fontWeight: "700", color: colors.text }}>Tribes</Text>
        <Pressable
          onPress={() => setShowCreate((v) => !v)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 8,
            backgroundColor: colors.accent,
          }}
        >
          <Plus color="#FFFFFF" size={16} />
          <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 * fontScale }}>New Tribe</Text>
        </Pressable>
      </View>

      {showCreate ? (
        <Card style={{ marginBottom: 16 }}>
          <FormField label="Name" value={name} onChangeText={setName} placeholder="Trail Ghosts" maxLength={80} />
          <FormField
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="What's this tribe about?"
            maxLength={300}
            multiline
          />
          <Pressable
            onPress={() => void handleCreate()}
            disabled={!name.trim() || creating}
            style={{
              backgroundColor: colors.accent,
              borderRadius: 8,
              paddingVertical: 10,
              alignItems: "center",
              opacity: !name.trim() || creating ? 0.5 : 1,
            }}
          >
            {creating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14 * fontScale }}>Create</Text>
            )}
          </Pressable>
        </Card>
      ) : null}

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
            Tribes needs a connection — your tribes will load again once you&apos;re back in signal.
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
      ) : (
        <>
          {joinable && !joinable.joined ? (
            <Card style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 14 * fontScale, fontWeight: "700", color: colors.text }}>
                {joinable.trailShortName} Hikers
              </Text>
              <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginTop: 2, marginBottom: 10 }}>
                {joinable.memberCount} member{joinable.memberCount === 1 ? "" : "s"} · open to all{" "}
                {joinable.trailShortName} hikers
              </Text>
              <Pressable
                onPress={() => void handleJoin()}
                disabled={joining}
                style={{
                  borderColor: colors.accent,
                  borderWidth: 1,
                  borderRadius: 8,
                  paddingVertical: 10,
                  alignItems: "center",
                  opacity: joining ? 0.6 : 1,
                }}
              >
                <Text style={{ color: colors.accent, fontWeight: "600", fontSize: 13 * fontScale }}>
                  {joining ? "Joining…" : "Join trail tribe"}
                </Text>
              </Pressable>
            </Card>
          ) : null}

          {tribes.length === 0 ? (
            <Card>
              <Text style={{ fontSize: 14 * fontScale, fontWeight: "600", color: colors.text }}>
                No tribes yet
              </Text>
              <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginTop: 4 }}>
                Create one, or join the trail tribe above to meet hikers on the same trail.
              </Text>
            </Card>
          ) : (
            tribes.map((t) => (
              <Pressable key={t.id} onPress={() => router.push(`/tribes/${t.id}`)}>
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
                    <Users color={colors.accent} size={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15 * fontScale, fontWeight: "700", color: colors.text }} numberOfLines={1}>
                      {t.name}
                    </Text>
                    <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginTop: 1 }}>
                      {t.memberCount} member{t.memberCount === 1 ? "" : "s"}
                      {t.myRole !== "member" ? ` · ${t.myRole}` : ""}
                    </Text>
                  </View>
                </Card>
              </Pressable>
            ))
          )}
        </>
      )}
    </Screen>
  );
}
