import { router } from "expo-router";
import { Sparkles, Lock } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Card } from "@/components/Screen";
import type { SectionDetailRow } from "@/db";
import { tripStore } from "@/db";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { usePremium } from "@/lib/usePremium";
import {
  generateSectionDetails,
  generateSectionGear,
  generateSectionItinerary,
  type SectionDetails,
} from "@/lib/webApi";
import { useTheme } from "@/theme/ThemeContext";

// Scout's per-section AI generation — mirrors the web section-detail buttons.
// Calls the bearer-enabled /api/sections/[id]/generate-* endpoints (online,
// premium), persists the result to the local store so it survives a reload,
// and updates the parent via onUpdated.

type Kind = "details" | "itinerary" | "gear";

const DETAIL_LABELS: { key: keyof SectionDetails; label: string }[] = [
  { key: "summits", label: "Summits & Ridgeline" },
  { key: "naturalHighlights", label: "Natural Highlights" },
  { key: "water", label: "Water Sources" },
  { key: "resupply", label: "Resupply & Towns" },
  { key: "historical", label: "History & Culture" },
  { key: "planAround", label: "Plan Around" },
  { key: "gearRecommendations", label: "Gear" },
  { key: "foodRecommendations", label: "Food Strategy" },
];

function parseDetails(raw: string | null): SectionDetails | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SectionDetails;
  } catch {
    return null;
  }
}

// AI-generated content isn't schema-guaranteed — a field can come back as
// something other than a plain string (e.g. an array), which would throw on
// .trim(). Coerce defensively rather than trusting the stored JSON's shape.
function detailText(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function SectionAiAssistant({
  section,
  onUpdated,
}: {
  section: SectionDetailRow;
  /** Called after a successful generation so the parent can refresh from the store. */
  onUpdated: () => void;
}) {
  const { colors, fontScale } = useTheme();
  const { token } = useAuth();
  const { isPremium } = usePremium();
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const details = parseDetails(section.details);
  const hasDetailContent =
    !!details && DETAIL_LABELS.some(({ key }) => detailText(details[key]).trim().length > 0);

  async function run(kind: Kind) {
    if (!token || busy) return;
    if (!isPremium) return; // gate handled at the button level
    setBusy(kind);
    setError(null);
    try {
      if (kind === "details") {
        const { details: d } = await generateSectionDetails(token, section.id);
        await tripStore.updateSectionAi(section.id, { details: JSON.stringify(d) });
      } else if (kind === "gear") {
        const g = await generateSectionGear(token, section.id);
        const merged: SectionDetails = {
          ...(parseDetails(section.details) ?? ({} as SectionDetails)),
          gearRecommendations: g.gearRecommendations,
          foodRecommendations: g.foodRecommendations,
        };
        await tripStore.updateSectionAi(section.id, { details: JSON.stringify(merged) });
      } else {
        const it = await generateSectionItinerary(token, section.id);
        await tripStore.updateSectionAi(section.id, {
          itinerary: it.itinerary,
          plannedCamps: JSON.stringify(it.plannedCamps),
          plannedCampMiles: JSON.stringify(it.plannedCampMiles),
        });
      }
      onUpdated();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.status === 402
            ? "Premium subscription required."
            : err.message
          : "Generation failed. Check your connection and try again.";
      setError(msg);
    } finally {
      setBusy(null);
    }
  }

  const buttons: { kind: Kind; label: string }[] = [
    { kind: "details", label: hasDetailContent ? "Regenerate Details" : "Pre-Hike Details" },
    { kind: "itinerary", label: section.itinerary ? "Regenerate Itinerary" : "Day-by-Day Itinerary" },
    { kind: "gear", label: "Gear & Food" },
  ];

  return (
    <Card style={{ marginTop: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Sparkles color={colors.accent} size={16} />
        <Text style={{ flex: 1, fontSize: 14 * fontScale, fontWeight: "700", color: colors.text }}>
          Scout AI Assistant
        </Text>
        {!isPremium ? <Lock color={colors.muted} size={14} /> : null}
      </View>
      <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginBottom: 10 }}>
        {isPremium
          ? "Generate trail intel, a day-by-day plan, and gear tips for this section."
          : "Premium — unlock AI-generated details, itinerary, and gear tips."}
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {buttons.map(({ kind, label }) => {
          const loading = busy === kind;
          const disabled = busy != null;
          return (
            <Pressable
              key={kind}
              onPress={() => (isPremium ? run(kind) : router.push("/upgrade"))}
              disabled={disabled}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 9,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.accent,
                backgroundColor: `${colors.accent}14`,
                opacity: disabled && !loading ? 0.5 : 1,
              }}
            >
              {loading ? <ActivityIndicator size="small" color={colors.accent} /> : null}
              <Text style={{ color: colors.accent, fontSize: 13 * fontScale, fontWeight: "600" }}>
                {loading ? "Generating…" : label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <Text style={{ fontSize: 12 * fontScale, color: colors.destructiveRed, marginTop: 10 }}>
          {error}
        </Text>
      ) : null}

      {hasDetailContent ? (
        <View style={{ marginTop: 14, gap: 12 }}>
          {DETAIL_LABELS.map(({ key, label }) => {
            const val = detailText(details?.[key]).trim();
            if (!val) return null;
            return (
              <View key={key}>
                <Text
                  style={{
                    fontSize: 11 * fontScale,
                    fontWeight: "700",
                    color: colors.muted,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 4,
                  }}
                >
                  {label}
                </Text>
                <Text style={{ fontSize: 13 * fontScale, color: colors.text, lineHeight: 19 * fontScale }}>
                  {val}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}
