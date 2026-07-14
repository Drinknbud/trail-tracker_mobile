import { router } from "expo-router";
import {
  ArrowLeft,
  ArrowUp,
  Bot,
  Check,
  Compass,
  Home,
  Lock,
  Mountain,
  RotateCcw,
  Tent,
  TriangleAlert,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/Screen";
import { PremiumGate } from "@/components/PremiumGate";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { usePremium } from "@/lib/usePremium";
import {
  createSection,
  fetchWebUser,
  scoutPlan,
  type CanonicalPlan,
  type PlanDay,
  type ScoutTurn,
} from "@/lib/webApi";
import { useTheme } from "@/theme/ThemeContext";

// Plan-first Scout: the screen IS the current plan. Each revision replaces it
// in place — no chat transcript, no superseded tables. All numbers shown come
// from the server-validated canonical plan, never from model prose.

function fmtMiles(mi: number, unit: string): string {
  return unit === "km" ? `${(mi * 1.60934).toFixed(1)} km` : `${mi.toFixed(1)} mi`;
}

function stopIcon(kind: PlanDay["to"]["kind"]) {
  switch (kind) {
    case "shelter": return Home;
    case "town": return Mountain;
    default: return Tent;
  }
}

/** Deterministic markdown itinerary built from the canonical plan (stored on the Section). */
function planToItinerary(plan: CanonicalPlan): string {
  const lines = [
    `# ${plan.name}\n${plan.direction} · ${plan.totalMiles} miles · ${plan.days.length} day${plan.days.length !== 1 ? "s" : ""}`,
    ...plan.days.map((d) => {
      const parts = [
        `## Day ${d.day}: ${d.from.name} → ${d.to.name} (${d.miles} mi)`,
        ...(d.note ? [d.note] : []),
        ...(d.permitRequired ? ["⚠ Permit required at this site — reserve before your trip."] : []),
        ...d.warnings.filter((w) => !w.startsWith("Permit required")).map((w) => `⚠ ${w}`),
      ];
      return parts.join("\n");
    }),
  ];
  return lines.join("\n\n");
}

export default function ScoutScreen() {
  const { colors, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { isPremium, isLoading: premiumLoading } = usePremium();

  const [plan, setPlan] = useState<CanonicalPlan | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [history, setHistory] = useState<ScoutTurn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [unit, setUnit] = useState("mi");

  useEffect(() => {
    if (!token) return;
    fetchWebUser(token)
      .then((u) => setUnit(u.distanceUnit === "km" ? "km" : "mi"))
      .catch(() => {}); // unit stays "mi" — display-only preference
  }, [token]);

  const send = useCallback(async () => {
    const message = input.trim();
    if (!message || !token || loading) return;
    setLoading(true);
    setError(null);
    setInput("");
    try {
      const res = await scoutPlan(token, { message, history, plan });
      setNote(res.note);
      setPlan(res.plan);
      setAccepted(false);
      setHistory((h) => [
        ...h.slice(-14),
        { role: "user", content: message },
        { role: "assistant", content: JSON.stringify(res) },
      ]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        // Server rejected every attempt — surface the note-style message
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Scout is unavailable — try again.");
      }
      setInput(message); // give the message back for editing
    } finally {
      setLoading(false);
    }
  }, [input, token, loading, history, plan]);

  const accept = useCallback(async () => {
    if (!plan || !token || accepting) return;
    setAccepting(true);
    try {
      await createSection(token, {
        name: plan.name,
        status: "planned",
        startMile: Math.min(plan.start.mile, plan.end.mile),
        endMile: Math.max(plan.start.mile, plan.end.mile),
        miles: plan.totalMiles,
        itinerary: planToItinerary(plan),
        plannedCamps: plan.days.slice(0, -1).map((d) => d.to.name),
        plannedCampMiles: plan.days.slice(0, -1).map((d) => d.to.mile),
      });
      setAccepted(true);
      Alert.alert(
        "Added to Trail Journal",
        `"${plan.name}" is now a planned section with the day-by-day itinerary attached.`,
        [
          { text: "View Journal", onPress: () => router.replace("/journal") },
          { text: "Keep Planning", style: "cancel" },
        ],
      );
    } catch (err) {
      Alert.alert("Couldn't save", err instanceof Error ? err.message : "Try again.");
    } finally {
      setAccepting(false);
    }
  }, [plan, token, accepting]);

  const reset = useCallback(() => {
    setPlan(null);
    setNote(null);
    setHistory([]);
    setError(null);
    setAccepted(false);
  }, []);

  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
        <ArrowLeft color={colors.accent} size={22} />
      </Pressable>
      <View
        style={{
          width: 34, height: 34, borderRadius: 17,
          backgroundColor: `${colors.accent}1A`,
          alignItems: "center", justifyContent: "center",
        }}
      >
        <Bot color={colors.accent} size={19} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 18 * fontScale, fontWeight: "700", color: colors.text }}>Scout</Text>
        <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>Trip planner</Text>
      </View>
      {plan ? (
        <Pressable onPress={reset} style={{ flexDirection: "row", alignItems: "center", gap: 4, padding: 6 }}>
          <RotateCcw color={colors.muted} size={14} />
          <Text style={{ fontSize: 12 * fontScale, color: colors.muted }}>New plan</Text>
        </Pressable>
      ) : null}
    </View>
  );

  if (!premiumLoading && !isPremium) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 12, paddingHorizontal: 16 }}>
        {header}
        <PremiumGate feature="Scout trip planning" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ flex: 1, paddingTop: insets.top + 12, paddingHorizontal: 16 }}>
        {header}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
          {/* Scout's note — the only prose on screen */}
          {note ? (
            <View
              style={{
                flexDirection: "row", gap: 8, alignItems: "flex-start",
                backgroundColor: `${colors.accent}12`,
                borderRadius: 12, padding: 12, marginBottom: 12,
              }}
            >
              <Bot color={colors.accent} size={15} style={{ marginTop: 2 }} />
              <Text style={{ flex: 1, fontSize: 13 * fontScale, color: colors.text, lineHeight: 19 * fontScale }}>
                {note}
              </Text>
            </View>
          ) : null}

          {error ? (
            <View
              style={{
                flexDirection: "row", gap: 8, alignItems: "flex-start",
                backgroundColor: `${colors.destructiveRed}15`,
                borderRadius: 12, padding: 12, marginBottom: 12,
              }}
            >
              <TriangleAlert color={colors.destructiveRed} size={15} style={{ marginTop: 2 }} />
              <Text style={{ flex: 1, fontSize: 13 * fontScale, color: colors.text }}>{error}</Text>
            </View>
          ) : null}

          {plan ? (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {/* Plan header */}
              <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ flex: 1, fontSize: 16 * fontScale, fontWeight: "700", color: colors.text }} numberOfLines={2}>
                    {plan.name}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 4,
                      backgroundColor: `${colors.accent}1A`,
                      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
                    }}
                  >
                    <Compass color={colors.accent} size={11} />
                    <Text style={{ fontSize: 11 * fontScale, fontWeight: "700", color: colors.accent }}>
                      {plan.direction}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginTop: 3 }}>
                  {fmtMiles(plan.totalMiles, unit)} over {plan.days.length} day{plan.days.length !== 1 ? "s" : ""} · mi {plan.start.mile} → {plan.end.mile}
                </Text>
              </View>

              {/* Day rows */}
              {plan.days.map((d, i) => {
                const Icon = stopIcon(d.to.kind);
                const last = i === plan.days.length - 1;
                return (
                  <View
                    key={d.day}
                    style={{
                      flexDirection: "row", gap: 12, padding: 14,
                      borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border,
                    }}
                  >
                    <View style={{ alignItems: "center", width: 34 }}>
                      <Text style={{ fontSize: 10 * fontScale, color: colors.muted, textTransform: "uppercase" }}>Day</Text>
                      <Text style={{ fontSize: 18 * fontScale, fontWeight: "700", color: colors.accent }}>{d.day}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13 * fontScale, color: colors.muted }} numberOfLines={1}>
                        {d.from.name}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
                        <Icon color={d.permitRequired ? colors.offlineAmber : colors.accent} size={13} />
                        <Text style={{ flex: 1, fontSize: 14 * fontScale, fontWeight: "600", color: colors.text }} numberOfLines={2}>
                          {d.to.name}
                        </Text>
                      </View>
                      {d.note ? (
                        <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginTop: 3 }}>{d.note}</Text>
                      ) : null}
                      {d.warnings.map((w) => (
                        <View key={w} style={{ flexDirection: "row", gap: 4, alignItems: "flex-start", marginTop: 3 }}>
                          <TriangleAlert color={colors.offlineAmber} size={11} style={{ marginTop: 1.5 }} />
                          <Text style={{ flex: 1, fontSize: 11 * fontScale, color: colors.offlineAmber }}>{w}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={{ fontSize: 14 * fontScale, fontWeight: "700", color: colors.text }}>
                      {fmtMiles(d.miles, unit)}
                    </Text>
                  </View>
                );
              })}

              {/* Accept */}
              <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Pressable
                  onPress={accept}
                  disabled={accepting || accepted}
                  style={{
                    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                    backgroundColor: accepted ? colors.completed : colors.accent,
                    borderRadius: 10, paddingVertical: 12,
                    opacity: accepting ? 0.6 : 1,
                  }}
                >
                  {accepting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Check color="#FFFFFF" size={17} />
                  )}
                  <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 * fontScale }}>
                    {accepted ? "Added to Trail Journal" : "Accept plan"}
                  </Text>
                </Pressable>
              </View>
            </Card>
          ) : !note && !loading ? (
            /* Empty state */
            <View style={{ alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 }}>
              <View
                style={{
                  width: 64, height: 64, borderRadius: 32,
                  backgroundColor: `${colors.accent}12`,
                  alignItems: "center", justifyContent: "center", marginBottom: 16,
                }}
              >
                <Bot color={colors.accent} size={30} />
              </View>
              <Text style={{ fontSize: 16 * fontScale, fontWeight: "700", color: colors.text, textAlign: "center" }}>
                Where do you want to hike?
              </Text>
              <Text style={{ fontSize: 13 * fontScale, color: colors.muted, textAlign: "center", marginTop: 6, lineHeight: 19 * fontScale }}>
                Scout builds day-by-day plans from official trail data — every stop is a real shelter,
                campsite, or town, and every distance comes from official mile markers.
              </Text>
              <Text style={{ fontSize: 12 * fontScale, color: colors.muted, textAlign: "center", marginTop: 14, fontStyle: "italic" }}>
                &ldquo;Plan a 3-day hike from Springer Mountain to Neels Gap&rdquo;
              </Text>
            </View>
          ) : null}

          {loading ? (
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingVertical: 24 }}>
              <ActivityIndicator color={colors.accent} />
              <Text style={{ fontSize: 13 * fontScale, color: colors.muted }}>
                {plan ? "Updating your plan…" : "Building your plan…"}
              </Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Input bar */}
        <View
          style={{
            flexDirection: "row", alignItems: "flex-end", gap: 8,
            paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={plan ? "Adjust the plan…" : "Tell Scout about your trip…"}
            placeholderTextColor={colors.muted}
            multiline
            editable={!loading}
            style={{
              flex: 1, maxHeight: 100,
              borderWidth: 1, borderColor: colors.border, borderRadius: 20,
              paddingHorizontal: 14, paddingVertical: 9,
              backgroundColor: colors.surface, color: colors.text,
              fontSize: 14 * fontScale,
            }}
          />
          <Pressable
            onPress={send}
            disabled={!input.trim() || loading}
            style={{
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: input.trim() && !loading ? colors.accent : colors.border,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <ArrowUp color="#FFFFFF" size={19} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
