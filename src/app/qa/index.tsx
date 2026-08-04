import { router } from "expo-router";
import { ArrowLeft, ChevronRight, HelpCircle, Plus, WifiOff } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { FormField } from "@/components/FormField";
import { Card, Screen } from "@/components/Screen";
import { useAuth } from "@/lib/auth";
import { askQuestion, fetchAllQuestions, fetchEligibleQuestions, type QuestionSummary } from "@/lib/qa";
import { useTheme } from "@/theme/ThemeContext";

function Segmented({
  value,
  onChange,
  eligibleCount,
  allCount,
}: {
  value: "eligible" | "all";
  onChange: (v: "eligible" | "all") => void;
  eligibleCount: number;
  allCount: number;
}) {
  const { colors, fontScale } = useTheme();
  return (
    <View style={{ flexDirection: "row", borderRadius: 8, borderWidth: 1, borderColor: colors.border, overflow: "hidden", marginBottom: 14 }}>
      {(["eligible", "all"] as const).map((v) => {
        const active = v === value;
        return (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            style={{ flex: 1, paddingVertical: 9, alignItems: "center", backgroundColor: active ? colors.accent : "transparent" }}
          >
            <Text style={{ fontSize: 13 * fontScale, fontWeight: active ? "700" : "500", color: active ? "#FFFFFF" : colors.text }}>
              {v === "eligible" ? `For You (${eligibleCount})` : `All (${allCount})`}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function QAScreen() {
  const { colors, fontScale } = useTheme();
  const { token } = useAuth();

  const [tab, setTab] = useState<"eligible" | "all">("eligible");
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [eligible, setEligible] = useState<QuestionSummary[]>([]);
  const [all, setAll] = useState<QuestionSummary[]>([]);

  const [showAsk, setShowAsk] = useState(false);
  const [trailKey, setTrailKey] = useState("at");
  const [startMile, setStartMile] = useState("");
  const [endMile, setEndMile] = useState("");
  const [body, setBody] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [eligibleRes, allRes] = await Promise.all([fetchEligibleQuestions(token), fetchAllQuestions(token)]);
      setEligible(eligibleRes);
      setAll(allRes);
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

  const handleAsk = async () => {
    if (!token || !trailKey.trim() || !body.trim() || asking) return;
    setAsking(true);
    setAskError(null);
    try {
      await askQuestion(token, {
        trailKey: trailKey.trim().toLowerCase(),
        startMile: startMile ? parseFloat(startMile) : undefined,
        endMile: endMile ? parseFloat(endMile) : undefined,
        body: body.trim(),
      });
      setShowAsk(false);
      setStartMile("");
      setEndMile("");
      setBody("");
      await load();
    } catch (e) {
      setAskError(e instanceof Error ? e.message : "Couldn't post question");
    } finally {
      setAsking(false);
    }
  };

  const displayed = tab === "eligible" ? eligible : all;

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <ArrowLeft color={colors.accent} size={20} />
        <Text style={{ color: colors.accent, fontSize: 14 * fontScale, fontWeight: "600" }}>Back</Text>
      </Pressable>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{ fontSize: 24 * fontScale, fontWeight: "700", color: colors.text }}>Trail Q&amp;A</Text>
          <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginTop: 1 }}>
            Anonymous questions — only your trail name is shared
          </Text>
        </View>
        <Pressable
          onPress={() => setShowAsk((v) => !v)}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.accent, flexShrink: 0 }}
        >
          <Plus color="#FFFFFF" size={16} />
          <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 12 * fontScale }}>Ask</Text>
        </Pressable>
      </View>

      {showAsk ? (
        <Card style={{ marginBottom: 14 }}>
          <FormField
            label="What do you want to know?"
            value={body}
            onChangeText={setBody}
            placeholder="Is the shelter at mile 105 reliable for water in August?"
            multiline
            maxLength={500}
          />
          <FormField label="Trail key" value={trailKey} onChangeText={(v) => setTrailKey(v.toLowerCase())} placeholder="at" autoCapitalize="none" />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <FormField label="Start mile (optional)" value={startMile} onChangeText={setStartMile} placeholder="60" keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <FormField label="End mile (optional)" value={endMile} onChangeText={setEndMile} placeholder="120" keyboardType="numeric" />
            </View>
          </View>
          <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginBottom: 10 }}>
            Answers will only show a trail name — never your real name or email.
          </Text>
          {askError ? (
            <Text style={{ fontSize: 12 * fontScale, color: colors.destructiveRed, marginBottom: 8 }}>{askError}</Text>
          ) : null}
          <Pressable
            onPress={() => void handleAsk()}
            disabled={!trailKey.trim() || !body.trim() || asking}
            style={{ backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 10, alignItems: "center", opacity: !trailKey.trim() || !body.trim() || asking ? 0.5 : 1 }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14 * fontScale }}>
              {asking ? "Posting…" : "Post Question"}
            </Text>
          </Pressable>
        </Card>
      ) : null}

      <Segmented value={tab} onChange={setTab} eligibleCount={eligible.length} allCount={all.length} />

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : offline ? (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <WifiOff color={colors.offlineAmber} size={16} />
            <Text style={{ fontSize: 14 * fontScale, fontWeight: "600", color: colors.text }}>You&apos;re offline</Text>
          </View>
          <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginBottom: 12 }}>
            Q&amp;A needs a connection — try again once you&apos;re back in signal.
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
      ) : displayed.length === 0 ? (
        <Card style={{ alignItems: "center", paddingVertical: 28 }}>
          <HelpCircle color={colors.muted} size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
          <Text style={{ fontSize: 13 * fontScale, color: colors.muted }}>
            {tab === "eligible" ? "No questions match your recent sections." : "No questions yet."}
          </Text>
        </Card>
      ) : (
        displayed.map((q) => (
          <Pressable key={q.id} onPress={() => router.push(`/qa/${q.id}`)}>
            <Card style={{ marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13 * fontScale, color: colors.text, fontWeight: "600" }} numberOfLines={2}>
                  {q.body}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <Text style={{ fontSize: 11 * fontScale, color: colors.muted, textTransform: "uppercase" }}>{q.trailKey}</Text>
                  {q.startMile != null && q.endMile != null ? (
                    <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
                      mi {q.startMile}–{q.endMile}
                    </Text>
                  ) : null}
                  <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
                    {q._count.answers} {q._count.answers === 1 ? "answer" : "answers"}
                  </Text>
                </View>
              </View>
              <ChevronRight color={colors.muted} size={16} />
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}
