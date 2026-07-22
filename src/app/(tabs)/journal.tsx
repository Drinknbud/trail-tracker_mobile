import { router, useFocusEffect } from "expo-router";
import { CheckCircle2, CloudDownload, Plus, WifiOff } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { PickerModal } from "@/components/PickerModal";
import { Card, Screen } from "@/components/Screen";
import { tripStore, type SectionRow, type TripDownloadRow } from "@/db";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { downloadTrip } from "@/lib/trip-download";
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

export default function JournalScreen() {
  const { colors, fontScale } = useTheme();
  const { fmtMiles, fmtDate } = useUnits();
  const { token } = useAuth();
  const { isPremium } = usePremium();

  const [sections, setSections] = useState<SectionRow[]>([]);
  const [downloads, setDownloads] = useState<Map<string, TripDownloadRow>>(new Map());
  const [offline, setOffline] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Map<string, string>>(new Map());
  const [showAddMenu, setShowAddMenu] = useState(false);

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
        await tripStore.upsertSections(res.sections);
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

  // Still-drafting vs. ready-to-hike — mirrors web's app/log/page.tsx filter
  // (mobile has no sharedBy field, so that clause is dropped).
  const planningSections = sections.filter((s) => s.status === "planned" && !s.inJournal);
  const journalSections = sections.filter(
    (s) => s.status === "completed" || (s.status === "planned" && s.inJournal)
  );

  const renderSectionCard = (s: SectionRow) => {
    const download = downloads.get(s.id);
    const busy = busyId === s.id;
    const rowError = rowErrors.get(s.id);
    return (
      <Card key={s.id} style={{ marginBottom: 10, paddingVertical: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable
            onPress={() => router.push(`/section/${s.id}`)}
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
          {download?.verified ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginRight: 8 }}>
              <CheckCircle2 color={colors.completed} size={16} />
              <Text style={{ fontSize: 11 * fontScale, color: colors.completed }}>Offline</Text>
            </View>
          ) : null}
          <Pressable
            onPress={() => onDownload(s.id)}
            disabled={busy}
            style={{
              backgroundColor: colors.accent,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              opacity: busy ? 0.6 : 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <CloudDownload color="#FFFFFF" size={16} />
            )}
            <Text style={{ color: "#FFFFFF", fontSize: 12 * fontScale, fontWeight: "600" }}>
              {download?.verified ? "Update" : "Download"}
            </Text>
          </Pressable>
        </View>
        {rowError ? (
          <Text style={{ color: colors.destructiveRed, fontSize: 12 * fontScale, marginTop: 8 }}>
            {rowError}
          </Text>
        ) : null}
      </Card>
    );
  };

  const GroupLabel = ({ children }: { children: string }) => (
    <Text
      style={{
        fontSize: 11 * fontScale,
        fontWeight: "700",
        color: colors.muted,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 8,
        marginTop: 4,
      }}
    >
      {children}
    </Text>
  );

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
        <>
          {planningSections.length > 0 ? (
            <View style={{ marginBottom: 16 }}>
              <GroupLabel>Planning</GroupLabel>
              {planningSections.map(renderSectionCard)}
            </View>
          ) : null}
          {journalSections.length > 0 ? (
            <View>
              <GroupLabel>Trail Journal</GroupLabel>
              {journalSections.map(renderSectionCard)}
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}
