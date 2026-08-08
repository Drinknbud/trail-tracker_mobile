import * as Crypto from "expo-crypto";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Camera as CameraIcon,
  CheckCircle2,
  ImagePlus,
  Moon,
  Pencil,
  Plus,
  Share2,
  Sun,
  Tent,
  Trash2,
  Undo2,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from "react-native";

import { DatePickerField } from "@/components/DatePickerField";
import { FormField } from "@/components/FormField";
import { Card, Screen } from "@/components/Screen";
import { SectionAiAssistant } from "@/components/SectionAiAssistant";
import { SectionCelebration } from "@/components/SectionCelebration";
import { SectionElevationProfile } from "@/components/SectionElevationProfile";
import { SectionMapCard } from "@/components/SectionMapCard";
import {
  tripStore,
  type DayLogRow,
  type ElevationProfile,
  type NightLogRow,
  type PhotoQueueRow,
  type PoiRow,
  type SectionDetailRow,
} from "@/db";
import { useAuth } from "@/lib/auth";
import { projectGpsToDist } from "@/lib/elevation";
import { enqueueWrite } from "@/lib/outbox";
import { capturePhoto } from "@/lib/photos";
import { exportSectionPdf, pdfExportAvailable } from "@/lib/sectionPdf";
import { TRAIL_CATALOG } from "@/lib/trailCatalog";
import { deleteTripData } from "@/lib/trip-download";
import { miToKm } from "@/lib/units";
import { useUnits } from "@/lib/units-context";
import { usePremium } from "@/lib/usePremium";
import { fetchLiveElevationProfile, fetchLiveStaticPois } from "@/lib/webApi";
import { useTheme } from "@/theme/ThemeContext";

// Single-trail (AT) MVP — same assumption as TRAILHEAD_FILES/SHELTER_FILES
// elsewhere in this codebase. Used only as the fallback catalogKey/totalMiles
// for the live elevation fetch when a section has no local trail row yet
// (never downloaded — see load() below).
const AT_TOTAL_MILES = TRAIL_CATALOG.find((t) => t.key === "at")?.totalMiles ?? 2198;

const STATUS_COLORS: Record<string, string> = {
  planned: "#3B82F6",
  completed: "#22C55E",
};

function Stat({ value, label }: { value: string; label: string }) {
  const { colors, fontScale } = useTheme();
  return (
    // Fixed ~46% width (not flex:1 in a 4-across row) so each stat gets a
    // full half-screen column to wrap into at larger accessibility text
    // sizes, instead of squeezing "elev gain"/"AT miles" into a quarter of
    // the screen where they collide with their neighbors.
    <View style={{ width: "46%", alignItems: "center", marginBottom: 10 }}>
      <Text
        style={{ fontSize: 17 * fontScale, fontWeight: "700", color: colors.text }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 10 * fontScale,
          color: colors.muted,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

type NightDraft = Partial<NightLogRow>;
type DayDraft = Partial<DayLogRow>;

export default function SectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, fontScale } = useTheme();
  const { fmtMiles, fmtElev, fmtDate, distanceUnit } = useUnits();
  const { token } = useAuth();
  const { isPremium } = usePremium();

  const [section, setSection] = useState<SectionDetailRow | null>(null);
  const [pois, setPois] = useState<PoiRow[]>([]);
  const [nights, setNights] = useState<NightLogRow[]>([]);
  const [days, setDays] = useState<DayLogRow[]>([]);
  const [nightDraft, setNightDraft] = useState<NightDraft | null>(null);
  const [dayDraft, setDayDraft] = useState<DayDraft | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [showItinerary, setShowItinerary] = useState(false);
  const [photos, setPhotos] = useState<PhotoQueueRow[]>([]);
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);
  const [elevation, setElevation] = useState<ElevationProfile | null>(null);
  const [gpsDistMi, setGpsDistMi] = useState<number | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [hasDownload, setHasDownload] = useState(false);
  const [elevationLoading, setElevationLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    await tripStore.init();
    const detail = await tripStore.getSectionDetail(id);
    setSection(detail);
    const localPois = await tripStore.listPois(id);
    // Local pois are only ever written by a full trip download — a section
    // still in Planning has none yet. Fall back to a live fetch of the same
    // curated files the offline-package endpoint reads, same pattern as the
    // elevation-profile fallback below. Best-effort: no connectivity just
    // means no POI markers, same as before this fallback existed.
    //
    // This screen instance persists across refocuses (see the useFocusEffect
    // note below), so load() re-runs on every focus — don't clear pois to []
    // before the live fetch resolves, or a refocus during a connectivity
    // blip wipes previously-shown POIs with no retry (the catch is silent).
    if (localPois.length > 0) {
      setPois(localPois);
    } else if (detail?.startMile != null && detail?.endMile != null) {
      fetchLiveStaticPois("at", detail.startMile, detail.endMile)
        .then((live) => setPois(live.map((p) => ({ ...p, meta: {} }))))
        .catch(() => {});
    } else {
      setPois([]);
    }
    setNights(await tripStore.listNightLogs(id));
    setDays(await tripStore.listDayLogs(id));
    setPhotos((await tripStore.photoList()).filter((p) => p.sectionId === id));
    setHasDownload((await tripStore.listTripDownloads()).some((d) => d.sectionId === id));

    // Elevation profile: prefer the local copy (offline-safe, from a full
    // trip download). A section still in Planning has never been downloaded,
    // so there's no local copy yet — fall back to a live fetch of the same
    // public endpoint web uses. Best-effort: needs connectivity, and simply
    // shows no elevation card (same as before) if it fails.
    let profile: ElevationProfile | null = await tripStore.getElevationProfile(id);
    if (!profile && detail?.startMile != null && detail?.endMile != null) {
      setElevationLoading(true);
      try {
        profile = await fetchLiveElevationProfile({
          catalogKey: "at",
          startMile: detail.startMile,
          endMile: detail.endMile,
          totalMiles: AT_TOTAL_MILES,
        });
      } catch {
        // offline or fetch failed — leave profile null, matches prior behavior
      } finally {
        setElevationLoading(false);
      }
    }
    setElevation(profile);
    if (profile) {
      const gps = await tripStore.gpsLatestPoint();
      setGpsDistMi(
        gps ? projectGpsToDist(profile.coords, profile.points, { lat: gps.lat, lon: gps.lon }) : null,
      );
    } else {
      setGpsDistMi(null);
    }
  }, [id]);

  // Focus, not mount-only: editing this same section (router.push to
  // /section/new?editId=... then back()) returns to this same screen
  // instance without remounting it, so a plain useEffect([id]) never
  // re-fires and every field — not just the date — kept showing whatever
  // was loaded before the edit.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!section) {
    return (
      <Screen title="Section">
        <Card>
          <Text style={{ color: colors.muted, fontSize: 13 * fontScale }}>
            Section not found in local storage.
          </Text>
        </Card>
      </Screen>
    );
  }

  const saveNight = async () => {
    if (!nightDraft) return;
    const now = new Date().toISOString();
    const row: NightLogRow = {
      id: nightDraft.id ?? `nl_${Crypto.randomUUID()}`,
      sectionId: section.id,
      date: nightDraft.date || null,
      campedAt: nightDraft.campedAt || null,
      campedWith: nightDraft.campedWith || null,
      arrivedAt: nightDraft.arrivedAt || null,
      leftAt: nightDraft.leftAt || null,
      notes: nightDraft.notes || null,
      updatedAt: now,
    };
    await tripStore.upsertNightLog(row);
    await enqueueWrite(
      "/api/mobile/night-logs",
      row as unknown as Record<string, unknown>,
      `night-${row.id}-${now}`,
      token
    );
    setNightDraft(null);
    await load();
  };

  const saveDay = async () => {
    if (!dayDraft) return;
    const now = new Date().toISOString();
    const row: DayLogRow = {
      id: dayDraft.id ?? `dl_${Crypto.randomUUID()}`,
      sectionId: section.id,
      date: dayDraft.date || null,
      milesHiked: dayDraft.milesHiked ?? null,
      startTime: dayDraft.startTime || null,
      endTime: dayDraft.endTime || null,
      terrainNotes: dayDraft.terrainNotes || null,
      mood: dayDraft.mood ?? null,
      updatedAt: now,
    };
    await tripStore.upsertDayLog(row);
    await enqueueWrite(
      "/api/mobile/day-logs",
      row as unknown as Record<string, unknown>,
      `day-${row.id}-${now}`,
      token
    );
    setDayDraft(null);
    await load();
  };

  const markComplete = async () => {
    await tripStore.setSectionStatus(section.id, "completed");
    await enqueueWrite(
      `/api/mobile/sections/${section.id}/status`,
      { status: "completed" },
      `status-${section.id}-completed`,
      token
    );
    setCelebrate(true);
    await load();
  };

  const setInJournal = async (inJournal: boolean) => {
    await tripStore.setSectionInJournal(section.id, inJournal);
    await enqueueWrite(
      `/api/mobile/sections/${section.id}/journal`,
      { inJournal },
      `journal-${section.id}-${inJournal}`,
      token
    );
    await load();
  };

  const confirmDeleteDownloadedData = () => {
    Alert.alert(
      "Delete offline data?",
      `This removes "${section.name}"'s downloaded trip data and map tiles from this device. You can download it again anytime.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteTripData(section.id);
            // Full reload, not just setHasDownload(false) — deleteTripData
            // also wipes the local night/day logs, POIs, and elevation
            // profile, all of which are already rendered on this screen and
            // need to clear along with the "Offline" badge. load() re-runs
            // the same fallback path used when a section has never been
            // downloaded (live elevation fetch if online, blank otherwise).
            await load();
          },
        },
      ]
    );
  };

  const onSharePdf = async () => {
    if (!section || exportingPdf) return;
    if (!pdfExportAvailable()) {
      Alert.alert("Not available here", "PDF export works on the iOS/Android app, not the web preview.");
      return;
    }
    setExportingPdf(true);
    try {
      await exportSectionPdf(section, elevation, pois, distanceUnit);
    } catch {
      Alert.alert("Export failed", "Couldn't generate the PDF. Try again.");
    } finally {
      setExportingPdf(false);
    }
  };

  const statusColor = STATUS_COLORS[section.status] ?? colors.muted;

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <Pressable
          onPress={() => router.back()}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          <ArrowLeft color={colors.accent} size={20} />
          <Text style={{ color: colors.accent, fontSize: 14 * fontScale, fontWeight: "600" }}>
            Journal
          </Text>
        </Pressable>
        <Pressable
          onPress={onSharePdf}
          disabled={exportingPdf}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, opacity: exportingPdf ? 0.5 : 1 }}
        >
          {exportingPdf ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Share2 color={colors.accent} size={18} />
          )}
          <Text style={{ color: colors.accent, fontSize: 13 * fontScale, fontWeight: "600" }}>
            {exportingPdf ? "Exporting…" : "Share PDF"}
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
        <Text
          style={{ flex: 1, fontSize: 20 * fontScale, fontWeight: "700", color: colors.text }}
        >
          {section.name}
        </Text>
        <View
          style={{
            backgroundColor: statusColor,
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 11 * fontScale, fontWeight: "600" }}>
            {section.status}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, gap: 12 }}>
        {section.startDate ? (
          <Text style={{ fontSize: 13 * fontScale, color: colors.muted }}>
            {fmtDate(section.startDate)}
            {section.endDate && section.endDate !== section.startDate
              ? ` – ${fmtDate(section.endDate)}`
              : ""}
          </Text>
        ) : null}
        <Pressable
          onPress={() => router.push(`/section/new?editId=${section.id}`)}
          hitSlop={8}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.accent,
          }}
        >
          <Pencil color={colors.accent} size={13} />
          <Text style={{ color: colors.accent, fontSize: 12 * fontScale, fontWeight: "700" }}>
            Edit
          </Text>
        </Pressable>
      </View>

      <Card
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          marginTop: 12,
          paddingVertical: 12,
          paddingBottom: 2,
        }}
      >
        <Stat value={fmtMiles(section.miles)} label="distance" />
        <Stat value={section.elevGain ? fmtElev(section.elevGain) : "—"} label="elev gain" />
        <Stat value={section.difficulty ?? "—"} label="difficulty" />
        <Stat
          value={
            section.startMile != null && section.endMile != null
              ? distanceUnit === "km"
                ? `${Math.round(miToKm(section.startMile))}–${Math.round(miToKm(section.endMile))}`
                : `${section.startMile}–${section.endMile}`
              : "—"
          }
          label={distanceUnit === "km" ? "AT km" : "AT miles"}
        />
      </Card>

      {section.status === "planned" ? (
        <Pressable
          onPress={markComplete}
          style={{
            backgroundColor: colors.completed,
            borderRadius: 8,
            paddingVertical: 12,
            alignItems: "center",
            marginTop: 12,
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <CheckCircle2 color="#FFFFFF" size={18} />
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 * fontScale }}>
            Mark Complete
          </Text>
        </Pressable>
      ) : null}

      {section.status === "planned" && !section.inJournal ? (
        <Pressable
          onPress={() => setInJournal(true)}
          style={{
            backgroundColor: STATUS_COLORS.planned,
            borderRadius: 8,
            paddingVertical: 12,
            alignItems: "center",
            marginTop: 8,
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Tent color="#FFFFFF" size={18} />
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 * fontScale }}>
            Ready to Hike
          </Text>
        </Pressable>
      ) : null}

      {section.status === "planned" && section.inJournal ? (
        <Pressable
          onPress={() => setInJournal(false)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginTop: 8,
            paddingVertical: 6,
          }}
        >
          <Undo2 color={colors.muted} size={14} />
          <Text style={{ color: colors.muted, fontSize: 12 * fontScale, fontWeight: "600" }}>
            Back to Planning
          </Text>
        </Pressable>
      ) : null}

      {hasDownload ? (
        <Pressable
          onPress={confirmDeleteDownloadedData}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginTop: 8,
            paddingVertical: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Trash2 color={colors.destructiveRed} size={15} />
          <Text style={{ color: colors.destructiveRed, fontSize: 13 * fontScale, fontWeight: "600" }}>
            Delete Downloaded Data
          </Text>
        </Pressable>
      ) : null}

      <SectionMapCard section={section} />

      {elevationLoading ? (
        <Card style={{ marginTop: 12, alignItems: "center", paddingVertical: 20 }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginTop: 8 }}>
            Loading elevation profile…
          </Text>
        </Card>
      ) : elevation && elevation.points.length >= 2 ? (
        <SectionElevationProfile
          points={elevation.points}
          pois={pois}
          startMile={section.startMile}
          sectionName={section.name}
          miles={section.miles}
          gpsDistMi={gpsDistMi}
          trailMinElevFt={elevation.trailMinElevFt}
          trailMaxElevFt={elevation.trailMaxElevFt}
          plannedCampMiles={section.plannedCampMiles}
        />
      ) : null}

      <SectionAiAssistant section={section} onUpdated={load} />

      {section.itinerary ? (
        <Card style={{ marginTop: 12 }}>
          <Pressable onPress={() => setShowItinerary((v) => !v)}>
            <Text style={{ fontSize: 14 * fontScale, fontWeight: "600", color: colors.text }}>
              Itinerary {showItinerary ? "▾" : "▸"}
            </Text>
          </Pressable>
          {showItinerary ? (
            <Text style={{ fontSize: 13 * fontScale, color: colors.text, marginTop: 8 }}>
              {section.itinerary}
            </Text>
          ) : null}
        </Card>
      ) : null}

      {/* Night logs */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 20,
          marginBottom: 8,
          gap: 6,
        }}
      >
        <Moon color={colors.accent} size={16} />
        <Text style={{ flex: 1, fontSize: 14 * fontScale, fontWeight: "700", color: colors.text }}>
          Night Logs
        </Text>
        <Pressable
          onPress={() => (isPremium ? setNightDraft({}) : router.push("/upgrade"))}
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
        >
          <Plus color={colors.accent} size={16} />
          <Text style={{ color: colors.accent, fontSize: 13 * fontScale, fontWeight: "600" }}>
            Add
          </Text>
        </Pressable>
      </View>
      {nights.length === 0 && !nightDraft ? (
        <Card>
          <Text style={{ color: colors.muted, fontSize: 13 * fontScale }}>
            No nights logged yet.
          </Text>
        </Card>
      ) : null}
      {nights.map((n) => (
        <Pressable key={n.id} onPress={() => setNightDraft(n)}>
          <Card style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 14 * fontScale, fontWeight: "600", color: colors.text }}>
              {n.campedAt ?? "Camp"}
              {n.date ? ` · ${fmtDate(n.date)}` : ""}
            </Text>
            {n.notes ? (
              <Text
                style={{ fontSize: 12 * fontScale, color: colors.muted, marginTop: 2 }}
                numberOfLines={2}
              >
                {n.notes}
              </Text>
            ) : null}
          </Card>
        </Pressable>
      ))}
      {nightDraft ? (
        <Card style={{ marginBottom: 8 }}>
          <Text
            style={{
              fontSize: 13 * fontScale,
              fontWeight: "700",
              color: colors.text,
              marginBottom: 8,
            }}
          >
            {nightDraft.id ? "Edit night" : "New night"}
          </Text>
          <DatePickerField
            label="Date"
            value={nightDraft.date?.slice(0, 10) ?? null}
            onChange={(v) => setNightDraft({ ...nightDraft, date: v })}
          />
          <FormField
            label="Camped at"
            value={nightDraft.campedAt ?? ""}
            onChangeText={(v) => setNightDraft({ ...nightDraft, campedAt: v })}
            placeholder="Plumorchard Gap Shelter"
          />
          <FormField
            label="Camped with"
            value={nightDraft.campedWith ?? ""}
            onChangeText={(v) => setNightDraft({ ...nightDraft, campedWith: v })}
            placeholder="Solo / trail family…"
          />
          <FormField
            label="Notes"
            value={nightDraft.notes ?? ""}
            onChangeText={(v) => setNightDraft({ ...nightDraft, notes: v })}
            placeholder="How was the night?"
            multiline
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={saveNight}
              style={{
                flex: 1,
                backgroundColor: colors.accent,
                borderRadius: 8,
                paddingVertical: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 * fontScale }}>
                Save
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setNightDraft(null)}
              style={{
                flex: 1,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 8,
                paddingVertical: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.text, fontSize: 13 * fontScale }}>Cancel</Text>
            </Pressable>
          </View>
        </Card>
      ) : null}

      {/* Day logs */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 20,
          marginBottom: 8,
          gap: 6,
        }}
      >
        <Sun color={colors.accent} size={16} />
        <Text style={{ flex: 1, fontSize: 14 * fontScale, fontWeight: "700", color: colors.text }}>
          Day Logs
        </Text>
        <Pressable
          onPress={() => setDayDraft({})}
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
        >
          <Plus color={colors.accent} size={16} />
          <Text style={{ color: colors.accent, fontSize: 13 * fontScale, fontWeight: "600" }}>
            Add
          </Text>
        </Pressable>
      </View>
      {days.length === 0 && !dayDraft ? (
        <Card>
          <Text style={{ color: colors.muted, fontSize: 13 * fontScale }}>
            No days logged yet.
          </Text>
        </Card>
      ) : null}
      {days.map((d) => (
        <Pressable key={d.id} onPress={() => setDayDraft(d)}>
          <Card style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 14 * fontScale, fontWeight: "600", color: colors.text }}>
              {d.milesHiked != null ? fmtMiles(d.milesHiked) : "Day"}
              {d.date ? ` · ${fmtDate(d.date)}` : ""}
              {d.mood ? ` · ${"⭐".repeat(d.mood)}` : ""}
            </Text>
            {d.terrainNotes ? (
              <Text
                style={{ fontSize: 12 * fontScale, color: colors.muted, marginTop: 2 }}
                numberOfLines={2}
              >
                {d.terrainNotes}
              </Text>
            ) : null}
          </Card>
        </Pressable>
      ))}
      {dayDraft ? (
        <Card style={{ marginBottom: 8 }}>
          <Text
            style={{
              fontSize: 13 * fontScale,
              fontWeight: "700",
              color: colors.text,
              marginBottom: 8,
            }}
          >
            {dayDraft.id ? "Edit day" : "New day"}
          </Text>
          <DatePickerField
            label="Date"
            value={dayDraft.date?.slice(0, 10) ?? null}
            onChange={(v) => setDayDraft({ ...dayDraft, date: v })}
          />
          <FormField
            label="Miles hiked"
            value={dayDraft.milesHiked != null ? String(dayDraft.milesHiked) : ""}
            onChangeText={(v) =>
              setDayDraft({ ...dayDraft, milesHiked: v ? Number(v) || 0 : null })
            }
            placeholder="12.4"
            keyboardType="decimal-pad"
          />
          <FormField
            label="Terrain notes"
            value={dayDraft.terrainNotes ?? ""}
            onChangeText={(v) => setDayDraft({ ...dayDraft, terrainNotes: v })}
            placeholder="Rocky ridgeline, two stream crossings…"
            multiline
          />
          <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginBottom: 4 }}>
            Mood
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map((m) => (
              <Pressable
                key={m}
                onPress={() => setDayDraft({ ...dayDraft, mood: m })}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: dayDraft.mood === m ? colors.accent : colors.bg,
                  borderColor: colors.border,
                  borderWidth: 1,
                }}
              >
                <Text style={{ fontSize: 14 * fontScale }}>
                  {["😖", "😕", "😐", "🙂", "🤩"][m - 1]}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={saveDay}
              style={{
                flex: 1,
                backgroundColor: colors.accent,
                borderRadius: 8,
                paddingVertical: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 * fontScale }}>
                Save
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setDayDraft(null)}
              style={{
                flex: 1,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 8,
                paddingVertical: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.text, fontSize: 13 * fontScale }}>Cancel</Text>
            </Pressable>
          </View>
        </Card>
      ) : null}

      {/* Photos */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 20,
          marginBottom: 8,
          gap: 10,
        }}
      >
        <Text style={{ flex: 1, fontSize: 14 * fontScale, fontWeight: "700", color: colors.text }}>
          Photos
        </Text>
        <Pressable
          onPress={async () => {
            try {
              const row = await capturePhoto(section.id, "camera");
              if (row) setPhotoNotice("Queued for upload.");
            } catch (err) {
              setPhotoNotice(err instanceof Error ? err.message : "Camera unavailable");
            }
            await load();
          }}
        >
          <CameraIcon color={colors.accent} size={18} />
        </Pressable>
        <Pressable
          onPress={async () => {
            try {
              const row = await capturePhoto(section.id, "library");
              if (row) setPhotoNotice("Queued for upload.");
            } catch (err) {
              setPhotoNotice(err instanceof Error ? err.message : "Library unavailable");
            }
            await load();
          }}
        >
          <ImagePlus color={colors.accent} size={18} />
        </Pressable>
      </View>
      {photoNotice ? (
        <Text style={{ fontSize: 12 * fontScale, color: colors.offlineAmber, marginBottom: 6 }}>
          {photoNotice}
        </Text>
      ) : null}
      {photos.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          {photos.map((p) => (
            <Image
              key={p.id}
              source={{ uri: p.uri }}
              style={{
                width: 72,
                height: 72,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: p.uploaded ? colors.border : colors.offlineAmber,
              }}
            />
          ))}
        </View>
      ) : null}

      {/* POIs */}
      {pois.length > 0 ? (
        <>
          <Text
            style={{
              fontSize: 14 * fontScale,
              fontWeight: "700",
              color: colors.text,
              marginTop: 20,
              marginBottom: 8,
            }}
          >
            Points of Interest ({pois.length})
          </Text>
          <Card style={{ marginBottom: 24 }}>
            {pois.map((p, i) => (
              <View
                key={`${p.type}-${p.name}-${i}`}
                style={{
                  flexDirection: "row",
                  paddingVertical: 6,
                  borderBottomWidth: i === pois.length - 1 ? 0 : 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Text style={{ flex: 1, fontSize: 13 * fontScale, color: colors.text }}>
                  {p.name}
                </Text>
                <Text style={{ fontSize: 12 * fontScale, color: colors.muted }}>
                  {p.type} · mi {p.mile}
                </Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <SectionCelebration
        visible={celebrate}
        sectionName={section.name}
        miles={section.miles}
        elevGain={section.elevGain}
        onClose={() => setCelebrate(false)}
      />
    </Screen>
  );
}
