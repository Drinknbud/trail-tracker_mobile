import { router } from "expo-router";
import { ArrowLeft, MapPin } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { FormField } from "@/components/FormField";
import { Card, Screen } from "@/components/Screen";
import { TrailheadPicker, type TrailheadOption } from "@/components/TrailheadPicker";
import { tripStore } from "@/db";
import { useAuth } from "@/lib/auth";
import { createSection, fetchTrailheads, fetchTrails } from "@/lib/webApi";
import { useTheme } from "@/theme/ThemeContext";

// Manual section-creation screen — mobile equivalent of web's "New Section"
// form in app/log/page.tsx (minus the Scout chat panel, which mobile already
// covers with its own deterministic plan-first Scout screen). Journal was
// previously read-only aside from Scout's accept flow and web-side sync;
// this fills that gap for logging a section without invoking AI at all.

const DIFFICULTIES = ["Easy", "Moderate", "Strenuous", "Very Strenuous"];

export default function NewSectionScreen() {
  const { colors, fontScale } = useTheme();
  const { token } = useAuth();

  const [name, setName] = useState("");
  const [status, setStatus] = useState<"planned" | "completed">("planned");
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startMile, setStartMile] = useState("");
  const [endMile, setEndMile] = useState("");
  const [miles, setMiles] = useState("");

  const [catalogKey, setCatalogKey] = useState<string | null>(null);
  const [useTrailheadEntry, setUseTrailheadEntry] = useState(false);
  const [trailheads, setTrailheads] = useState<TrailheadOption[]>([]);
  const [trailheadsLoading, setTrailheadsLoading] = useState(false);
  const [startTrailheadId, setStartTrailheadId] = useState<number | "">("");
  const [endTrailheadId, setEndTrailheadId] = useState<number | "">("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const trails = await fetchTrails(token);
        const active = trails.find((t) => t.isActive) ?? trails[0] ?? null;
        setCatalogKey(active?.catalogKey ?? null);
      } catch {
        // non-fatal — trailhead entry mode just stays unavailable
      }
    })();
  }, [token]);

  const loadTrailheads = useCallback(async () => {
    if (!catalogKey || trailheads.length > 0 || trailheadsLoading) return;
    setTrailheadsLoading(true);
    try {
      const list = await fetchTrailheads(catalogKey);
      setTrailheads(list);
    } catch {
      // non-fatal — user can still enter miles manually
    }
    setTrailheadsLoading(false);
  }, [catalogKey, trailheads.length, trailheadsLoading]);

  // Auto-fill name/miles when both trailheads are selected — mirrors web's
  // applyTrailheadSelection, preserving direction (SOBO: startMile > endMile).
  const applyTrailheadSelection = useCallback(
    (startId: number | "", endId: number | "") => {
      const start = trailheads.find((t) => t.id === startId);
      const end = trailheads.find((t) => t.id === endId);
      if (!start || !end) return;
      const m = Math.round(Math.abs(end.mile - start.mile) * 10) / 10;
      setName(`${start.name} to ${end.name}`);
      setStartMile(String(start.mile));
      setEndMile(String(end.mile));
      setMiles(String(m));
    },
    [trailheads]
  );

  const computedMiles = useMemo(() => {
    const s = parseFloat(startMile);
    const e = parseFloat(endMile);
    if (isNaN(s) || isNaN(e)) return null;
    return Math.round(Math.abs(e - s) * 10) / 10;
  }, [startMile, endMile]);

  async function onSave() {
    if (!token || saving) return;
    if (!name.trim()) { setError("Section name is required."); return; }
    const sMile = startMile ? Number(startMile) : NaN;
    const eMile = endMile ? Number(endMile) : NaN;
    if (isNaN(sMile) || isNaN(eMile)) { setError("Start and end mile are required."); return; }
    const finalMiles = miles ? Number(miles) : computedMiles ?? Math.abs(eMile - sMile);

    setSaving(true);
    setError(null);
    try {
      const created = await createSection(token, {
        name: name.trim(),
        status,
        startMile: sMile,
        endMile: eMile,
        miles: finalMiles,
        difficulty: difficulty ?? undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      // Reflect locally right away so it shows in Journal before the next
      // full /api/mobile/sections resync.
      await tripStore.init();
      await tripStore.upsertSections([
        {
          id: created.id,
          trailId: null,
          name: name.trim(),
          status,
          startMile: sMile,
          endMile: eMile,
          startDate: startDate || null,
          endDate: endDate || null,
          miles: finalMiles,
          elevGain: null,
          difficulty: difficulty ?? null,
          inJournal: true,
          updatedAt: new Date().toISOString(),
        },
      ]);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save section.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Pressable
        onPress={() => router.back()}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}
      >
        <ArrowLeft color={colors.accent} size={18} />
        <Text style={{ color: colors.accent, fontSize: 14 * fontScale, fontWeight: "600" }}>
          Journal
        </Text>
      </Pressable>
      <Text style={{ fontSize: 22 * fontScale, fontWeight: "700", color: colors.text, marginBottom: 16 }}>
        New Section
      </Text>

      {catalogKey === "at" ? (
        <Pressable
          onPress={() => {
            const next = !useTrailheadEntry;
            setUseTrailheadEntry(next);
            if (next) loadTrailheads();
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            alignSelf: "flex-start",
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: useTrailheadEntry ? colors.accent : colors.border,
            backgroundColor: useTrailheadEntry ? `${colors.accent}14` : "transparent",
            marginBottom: 14,
          }}
        >
          <MapPin color={useTrailheadEntry ? colors.accent : colors.muted} size={14} />
          <Text
            style={{
              fontSize: 13 * fontScale,
              fontWeight: "600",
              color: useTrailheadEntry ? colors.accent : colors.muted,
            }}
          >
            {useTrailheadEntry ? "Using Trailheads" : "Use Trailheads"}
          </Text>
        </Pressable>
      ) : null}

      {useTrailheadEntry ? (
        <Card style={{ marginBottom: 14 }}>
          {trailheadsLoading ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={{ fontSize: 13 * fontScale, color: colors.muted }}>Loading trailheads…</Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <TrailheadPicker
                label="Start Trailhead"
                trailheads={trailheads}
                value={startTrailheadId}
                onChange={(id) => {
                  setStartTrailheadId(id);
                  applyTrailheadSelection(id, endTrailheadId);
                }}
                placeholder="Search start trailhead…"
              />
              <TrailheadPicker
                label="End Trailhead"
                trailheads={trailheads}
                value={endTrailheadId}
                onChange={(id) => {
                  setEndTrailheadId(id);
                  applyTrailheadSelection(startTrailheadId, id);
                }}
                placeholder="Search end trailhead…"
              />
            </View>
          )}
          {startTrailheadId !== "" && endTrailheadId !== "" && miles ? (
            <Text style={{ fontSize: 12 * fontScale, color: colors.accent, marginTop: 10 }}>
              Auto-filled: {miles} mi · mi {startMile}–{endMile}
            </Text>
          ) : null}
        </Card>
      ) : null}

      <FormField
        label="Section Name *"
        value={name}
        onChangeText={setName}
        placeholder="e.g., Springer Mountain to Gooch Mountain"
      />

      {!useTrailheadEntry ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <FormField
              label="Start Mile"
              value={startMile}
              onChangeText={setStartMile}
              placeholder="0"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormField
              label="End Mile"
              value={endMile}
              onChangeText={setEndMile}
              placeholder="31.5"
              keyboardType="decimal-pad"
            />
          </View>
        </View>
      ) : null}

      <FormField
        label={`Miles${computedMiles != null ? ` (computed: ${computedMiles})` : ""}`}
        value={miles}
        onChangeText={setMiles}
        placeholder={computedMiles != null ? String(computedMiles) : "31.5"}
        keyboardType="decimal-pad"
      />

      <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginBottom: 6 }}>Status</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        {(["planned", "completed"] as const).map((s) => (
          <Pressable
            key={s}
            onPress={() => setStatus(s)}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: status === s ? colors.accent : colors.border,
              backgroundColor: status === s ? `${colors.accent}14` : "transparent",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 13 * fontScale,
                fontWeight: "600",
                color: status === s ? colors.accent : colors.text,
                textTransform: "capitalize",
              }}
            >
              {s}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginBottom: 6 }}>
        Difficulty (optional)
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {DIFFICULTIES.map((d) => (
          <Pressable
            key={d}
            onPress={() => setDifficulty(difficulty === d ? null : d)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: difficulty === d ? colors.accent : colors.border,
              backgroundColor: difficulty === d ? `${colors.accent}14` : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 12 * fontScale,
                fontWeight: "600",
                color: difficulty === d ? colors.accent : colors.muted,
              }}
            >
              {d}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <FormField
            label="Start Date (optional)"
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2026-07-10"
          />
        </View>
        <View style={{ flex: 1 }}>
          <FormField
            label="End Date (optional)"
            value={endDate}
            onChangeText={setEndDate}
            placeholder="2026-07-12"
          />
        </View>
      </View>

      {error ? (
        <Text style={{ fontSize: 13 * fontScale, color: colors.destructiveRed, marginBottom: 10 }}>
          {error}
        </Text>
      ) : null}

      <Pressable
        onPress={onSave}
        disabled={saving}
        style={{
          backgroundColor: colors.accent,
          borderRadius: 10,
          paddingVertical: 13,
          alignItems: "center",
          marginTop: 6,
          opacity: saving ? 0.6 : 1,
          flexDirection: "row",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
        <Text style={{ color: "#FFFFFF", fontSize: 15 * fontScale, fontWeight: "700" }}>
          {saving ? "Saving…" : "Save Section"}
        </Text>
      </Pressable>
    </Screen>
  );
}
