import { CheckCircle2, CloudDownload, WifiOff } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Card, Screen } from "@/components/Screen";
import { tripStore, type SectionRow, type TripDownloadRow } from "@/db";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { downloadTrip } from "@/lib/trip-download";
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
  const { token } = useAuth();

  const [sections, setSections] = useState<SectionRow[]>([]);
  const [downloads, setDownloads] = useState<Map<string, TripDownloadRow>>(new Map());
  const [offline, setOffline] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Map<string, string>>(new Map());

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

  return (
    <Screen title="Trail Journal">
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
        sections.map((s) => {
          const download = downloads.get(s.id);
          const busy = busyId === s.id;
          const rowError = rowErrors.get(s.id);
          return (
            <Card key={s.id} style={{ marginBottom: 10, paddingVertical: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
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
                    {s.miles.toFixed(1)} mi
                    {s.startDate ? ` · ${s.startDate.slice(0, 10)}` : ""}
                    {s.difficulty ? ` · ${s.difficulty}` : ""}
                  </Text>
                </View>
                {download?.verified ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginRight: 8 }}>
                    <CheckCircle2 color={colors.completed} size={16} />
                    <Text style={{ fontSize: 11 * fontScale, color: colors.completed }}>
                      Offline
                    </Text>
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
                <Text
                  style={{ color: colors.destructiveRed, fontSize: 12 * fontScale, marginTop: 8 }}
                >
                  {rowError}
                </Text>
              ) : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}
