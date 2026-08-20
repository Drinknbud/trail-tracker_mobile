import { router, useFocusEffect } from "expo-router";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudDownload,
  Plus,
  RefreshCw,
  Trash2,
  WifiOff,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";

import { PickerModal } from "@/components/PickerModal";
import { Card, Screen } from "@/components/Screen";
import { TrailAlertBanner } from "@/components/TrailAlertBanner";
import { tripStore, type SectionRow, type TripDownloadRow } from "@/db";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { startElevationPrefetch } from "@/lib/elevation-prefetch";
import { TRAIL_CATALOG } from "@/lib/trailCatalog";
import { downloadTrip, removeSection } from "@/lib/trip-download";
import { useUnits } from "@/lib/units-context";
import { usePremium } from "@/lib/usePremium";
import { useTheme } from "@/theme/ThemeContext";

const STATUS_COLORS: Record<string, string> = {
  planned: "#3B82F6",
  completed: "#22C55E",
};

type SectionsResponse = {
  trail: { id: string } | null;
  sections: (SectionRow & { startDate: string | null; endDate: string | null })[];
};

type GroupKey = "planning" | "planned" | "completed";

// Single-trail (AT) MVP — same fallback used by section/[id].tsx's own live
// elevation fetch.
const AT_TOTAL_MILES = TRAIL_CATALOG.find((t) => t.key === "at")?.totalMiles ?? 2198;

export default function JournalScreen() {
  const { colors, scheme, fontScale } = useTheme();
  const { fmtMiles, fmtDate } = useUnits();
  const { token } = useAuth();
  const { isPremium } = usePremium();

  const [sections, setSections] = useState<SectionRow[]>([]);
  const [downloads, setDownloads] = useState<Map<string, TripDownloadRow>>(new Map());
  const [offline, setOffline] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Map<string, string>>(new Map());
  const [showAddMenu, setShowAddMenu] = useState(false);
  // Completed starts collapsed (usually the longest list, and history you
  // don't need to act on); Planning/Planned start open since they're the
  // actionable groups.
  const [openGroups, setOpenGroups] = useState<Record<GroupKey, boolean>>({
    planning: true,
    planned: true,
    completed: false,
  });
  const swipeableRefs = useRef(new Map<string, Swipeable | null>());

  const loadLocal = useCallback(async () => {
    setSections(await tripStore.listSections());
    setDownloads(new Map((await tripStore.listTripDownloads()).map((d) => [d.sectionId, d])));
  }, []);

  useEffect(() => {
    (async () => {
      await tripStore.init();
      await loadLocal();
      if (!token) return;
      try {
        const res = await apiFetch<SectionsResponse>("/api/mobile/sections", { token });
        // Drop any section that still has an unflushed .../delete outbox
        // entry — otherwise a swipe-delete made while offline (which removes
        // the row locally and queues the server delete) gets resurrected the
        // instant this resync lands before that queued delete has flushed.
        // A very high maxAttempts pulls in dead rows too, since a delete
        // that gave up retrying should still stay hidden rather than pop
        // back into the list.
        const pending = await tripStore.outboxPending(Number.MAX_SAFE_INTEGER);
        const pendingDeleteIds = new Set(
          pending
            .map((e) => e.endpoint.match(/^\/api\/mobile\/sections\/([^/]+)\/delete$/)?.[1])
            .filter((id): id is string => !!id)
        );
        const filtered = pendingDeleteIds.size
          ? res.sections.filter((s) => !pendingDeleteIds.has(s.id))
          : res.sections;
        await tripStore.upsertSections(filtered);
        setOffline(false);
        await loadLocal();
      } catch {
        setOffline(true); // local data stays on screen — never a blank list
      }
    })();
  }, [token, loadLocal]);

  // Pick up sections created via the New Section screen (already written
  // locally before it navigates back) without waiting for the next full
  // /api/mobile/sections resync.
  useFocusEffect(
    useCallback(() => {
      void loadLocal();
    }, [loadLocal])
  );

  const onDownload = async (sectionId: string) => {
    if (busyId) return;
    setBusyId(sectionId);
    setRowErrors((prev) => {
      const next = new Map(prev);
      next.delete(sectionId);
      return next;
    });
    try {
      await downloadTrip(sectionId, token);
    } catch (err) {
      setRowErrors((prev) =>
        new Map(prev).set(sectionId, err instanceof Error ? err.message : "Download failed")
      );
    } finally {
      setBusyId(null);
      await loadLocal();
    }
  };

  // Swipe-to-delete removes the section itself (server + local), not just its
  // offline data — clearing offline data on its own now lives on the section
  // detail screen instead.
  const confirmDeleteSection = (s: SectionRow) => {
    swipeableRefs.current.get(s.id)?.close();
    Alert.alert(
      "Delete section?",
      `Permanently delete "${s.name}"? This removes it and any downloaded data from this device and can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await removeSection(s.id, token);
            await loadLocal();
          },
        },
      ]
    );
  };

  const toggleGroup = (key: GroupKey) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  // Still-drafting vs. ready-to-hike vs. done — mirrors web's app/log/page.tsx
  // filter (mobile has no sharedBy field, so that clause is dropped), split
  // three ways instead of web's two so Planned and Completed each get their
  // own collapsible section. Each list is sorted most-recent-first.
  const planningSections = sections
    .filter((s) => s.status === "planned" && !s.inJournal)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const plannedSections = sections
    .filter((s) => s.status === "planned" && s.inJournal)
    .sort((a, b) => (b.startDate ?? b.updatedAt).localeCompare(a.startDate ?? a.updatedAt));
  const completedSections = sections
    .filter((s) => s.status === "completed")
    .sort((a, b) =>
      (b.endDate ?? b.startDate ?? b.updatedAt).localeCompare(
        a.endDate ?? a.startDate ?? a.updatedAt
      )
    );

  const renderSectionCard = (s: SectionRow, completedStyle: boolean) => {
    const download = downloads.get(s.id);
    const busy = busyId === s.id;
    const rowError = rowErrors.get(s.id);
    const hasDownload = !!download;

    const card = (
      <Card
        style={{
          marginBottom: 10,
          paddingVertical: 12,
          ...(completedStyle
            ? {
                borderColor: colors.completed,
                borderWidth: 1,
                backgroundColor:
                  scheme === "dark" ? "rgba(34,197,94,0.12)" : "rgba(34,197,94,0.08)",
              }
            : {}),
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable
            onPress={() => router.push(`/section/${s.id}`)}
            onPressIn={() => {
              // Fire the same live elevation fetch section/[id].tsx would
              // otherwise wait on after navigating, so the chart is often
              // already loaded (or loading) by the time that screen mounts.
              // Only worth it for sections with no local download — those
              // already have an offline profile, no network round-trip to
              // save.
              if (!hasDownload && s.startMile != null && s.endMile != null) {
                startElevationPrefetch(s.id, {
                  catalogKey: "at",
                  startMile: s.startMile,
                  endMile: s.endMile,
                  totalMiles: AT_TOTAL_MILES,
                });
              }
            }}
            style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: STATUS_COLORS[s.status] ?? colors.muted,
                marginRight: 10,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontSize: 15 * fontScale, fontWeight: "600", color: colors.text }}
                numberOfLines={1}
              >
                {s.name}
              </Text>
              <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginTop: 2 }}>
                {fmtMiles(s.miles)}
                {s.startDate ? ` · ${fmtDate(s.startDate)}` : ""}
                {s.difficulty ? ` · ${s.difficulty}` : ""}
              </Text>
            </View>
          </Pressable>
          {hasDownload ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginRight: 6 }}>
              <CheckCircle2 color={colors.completed} size={14} />
              <Text style={{ fontSize: 10 * fontScale, color: colors.completed }}>Offline</Text>
            </View>
          ) : null}
          <Pressable
            onPress={() => onDownload(s.id)}
            disabled={busy}
            hitSlop={6}
            accessibilityLabel={hasDownload ? "Update offline data" : "Download offline data"}
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
              opacity: busy ? 0.6 : 1,
              marginLeft: 6,
            }}
          >
            {busy ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : hasDownload ? (
              <RefreshCw color={colors.accent} size={15} />
            ) : (
              <CloudDownload color={colors.accent} size={15} />
            )}
          </Pressable>
        </View>
        {rowError ? (
          <Text style={{ color: colors.destructiveRed, fontSize: 12 * fontScale, marginTop: 8 }}>
            {rowError}
          </Text>
        ) : null}
      </Card>
    );

    return (
      <Swipeable
        key={s.id}
        ref={(ref) => {
          swipeableRefs.current.set(s.id, ref);
        }}
        overshootRight={false}
        renderRightActions={() => (
          <Pressable
            onPress={() => confirmDeleteSection(s)}
            style={{
              backgroundColor: colors.destructiveRed,
              justifyContent: "center",
              alignItems: "center",
              width: 84,
              borderRadius: 12,
              marginBottom: 10,
              marginLeft: 8,
            }}
          >
            <Trash2 color="#FFFFFF" size={18} />
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 11 * fontScale,
                fontWeight: "600",
                marginTop: 4,
                textAlign: "center",
              }}
            >
              Delete Section
            </Text>
          </Pressable>
        )}
      >
        {card}
      </Swipeable>
    );
  };

  const GroupHeader = ({
    groupKey,
    label,
    list,
  }: {
    groupKey: GroupKey;
    label: string;
    list: SectionRow[];
  }) => (
    <Pressable
      onPress={() => toggleGroup(groupKey)}
      style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, marginTop: 4 }}
    >
      <Text
        style={{
          fontSize: 11 * fontScale,
          fontWeight: "700",
          color: colors.muted,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
      <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginLeft: 6 }}>
        {list.length} · {fmtMiles(Math.round(list.reduce((sum, s) => sum + s.miles, 0) * 10) / 10)}
      </Text>
      <View style={{ flex: 1 }} />
      {openGroups[groupKey] ? (
        <ChevronUp color={colors.muted} size={16} />
      ) : (
        <ChevronDown color={colors.muted} size={16} />
      )}
    </Pressable>
  );

  const groups: { key: GroupKey; label: string; list: SectionRow[] }[] = [
    { key: "planning", label: "Planning", list: planningSections },
    { key: "planned", label: "Planned", list: plannedSections },
    { key: "completed", label: "Completed", list: completedSections },
  ];

  return (
    <Screen>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Text style={{ flex: 1, fontSize: 24 * fontScale, fontWeight: "700", color: colors.text }}>
          Trail Journal
        </Text>
        <Pressable
          onPress={() => (isPremium ? setShowAddMenu(true) : router.push("/section/new"))}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 7,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.accent,
          }}
        >
          <Plus color={colors.accent} size={15} />
          <Text style={{ color: colors.accent, fontSize: 13 * fontScale, fontWeight: "600" }}>
            Add
          </Text>
        </Pressable>
      </View>

      <PickerModal
        visible={showAddMenu}
        title="Add Section"
        options={[
          { value: "scout", label: "Plan with AI (Scout)" },
          { value: "manual", label: "Enter Manually" },
        ]}
        value={null}
        onSelect={(v) => router.push(v === "scout" ? "/scout" : "/section/new")}
        onClose={() => setShowAddMenu(false)}
      />

      <TrailAlertBanner />

      {offline ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: colors.surface,
            borderColor: colors.offlineAmber,
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginBottom: 12,
          }}
        >
          <WifiOff color={colors.offlineAmber} size={16} />
          <Text style={{ color: colors.offlineAmber, fontSize: 13 * fontScale }}>
            Offline — showing saved data
          </Text>
        </View>
      ) : null}

      {sections.length === 0 ? (
        <Card>
          <Text style={{ fontSize: 14 * fontScale, fontWeight: "600", color: colors.text }}>
            No sections yet
          </Text>
          <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginTop: 4 }}>
            {offline
              ? "Connect once to sync your sections, then they live here offline."
              : "Plan sections on the web app and they'll appear here."}
          </Text>
        </Card>
      ) : (
        groups.map(({ key, label, list }) =>
          list.length > 0 ? (
            <View key={key} style={{ marginBottom: 16 }}>
              <GroupHeader groupKey={key} label={label} list={list} />
              {openGroups[key] ? list.map((s) => renderSectionCard(s, key === "completed")) : null}
            </View>
          ) : null
        )
      )}
    </Screen>
  );
}
