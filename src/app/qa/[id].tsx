import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, CheckCircle2, WifiOff } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { Card, Screen } from "@/components/Screen";
import { useAuth } from "@/lib/auth";
import { closeQuestion, fetchQuestion, submitAnswer, type QuestionDetail } from "@/lib/qa";
import { useTheme } from "@/theme/ThemeContext";

export default function QuestionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, fontScale } = useTheme();
  const { token } = useAuth();

  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [answerBody, setAnswerBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      const q = await fetchQuestion(token, id);
      setQuestion(q);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAnswer = async () => {
    if (!token || !id || !answerBody.trim() || posting) return;
    setPosting(true);
    setError(null);
    try {
      await submitAnswer(token, id, answerBody.trim());
      setAnswerBody("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post answer");
    } finally {
      setPosting(false);
    }
  };

  const handleClose = async () => {
    if (!token || !id) return;
    await closeQuestion(token, id);
    await load();
  };

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  if (offline || !question) {
    return (
      <Screen>
        <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <ArrowLeft color={colors.accent} size={20} />
          <Text style={{ color: colors.accent, fontSize: 14 * fontScale, fontWeight: "600" }}>Back</Text>
        </Pressable>
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <WifiOff color={colors.offlineAmber} size={16} />
            <Text style={{ fontSize: 14 * fontScale, fontWeight: "600", color: colors.text }}>You&apos;re offline</Text>
          </View>
          <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginBottom: 12 }}>
            This question needs a connection to load.
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

  const isClosed = question.status === "closed";

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
        <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <ArrowLeft color={colors.accent} size={20} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 }}>
          <Text style={{ fontSize: 11 * fontScale, color: colors.muted, textTransform: "uppercase" }}>{question.trailKey}</Text>
          {question.startMile != null && question.endMile != null ? (
            <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
              mi {question.startMile}–{question.endMile}
            </Text>
          ) : null}
          {isClosed ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <CheckCircle2 color={colors.muted} size={12} />
              <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>Closed</Text>
            </View>
          ) : null}
        </View>
        {question.isAsker && !isClosed ? (
          <Pressable onPress={() => void handleClose()}>
            <Text style={{ fontSize: 12 * fontScale, color: colors.muted }}>Close</Text>
          </Pressable>
        ) : null}
      </View>

      <Card style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14 * fontScale, color: colors.text, lineHeight: 20 * fontScale }}>{question.body}</Text>
      </Card>

      <Text style={{ fontSize: 13 * fontScale, fontWeight: "700", color: colors.text, marginBottom: 10 }}>
        {question.answers.length} {question.answers.length === 1 ? "Answer" : "Answers"}
      </Text>

      {question.answers.length === 0 ? (
        <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginBottom: 16 }}>No answers yet.</Text>
      ) : (
        question.answers.map((a) => (
          <Card key={a.id} style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 11 * fontScale, fontWeight: "700", color: colors.accent, marginBottom: 4 }}>
              {a.answerer.trailName ?? "Anonymous Hiker"}
            </Text>
            <Text style={{ fontSize: 13 * fontScale, color: colors.text, lineHeight: 19 * fontScale }}>{a.body}</Text>
          </Card>
        ))
      )}

      {!isClosed && !question.isAsker ? (
        <Card style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 13 * fontScale, fontWeight: "700", color: colors.text, marginBottom: 4 }}>
            Share Your Experience
          </Text>
          <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginBottom: 10 }}>
            Only your trail name will be shown — never your real name or email.
          </Text>
          <TextInput
            value={answerBody}
            onChangeText={setAnswerBody}
            placeholder="Share what you know about this section…"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={500}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: 10,
              fontSize: 13 * fontScale,
              color: colors.text,
              backgroundColor: colors.bg,
              marginBottom: 10,
              minHeight: 70,
            }}
          />
          {error ? (
            <Text style={{ fontSize: 12 * fontScale, color: colors.destructiveRed, marginBottom: 8 }}>{error}</Text>
          ) : null}
          <Pressable
            onPress={() => void handleAnswer()}
            disabled={!answerBody.trim() || posting}
            style={{ backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 10, alignItems: "center", opacity: !answerBody.trim() || posting ? 0.5 : 1 }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 * fontScale }}>
              {posting ? "Posting…" : "Post Answer"}
            </Text>
          </Pressable>
        </Card>
      ) : null}
    </Screen>
  );
}
