import { Maximize2, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/Screen";
import { SectionMap } from "@/components/SectionMap";
import type { SectionRow } from "@/db";
import { useAuth } from "@/lib/auth";
import type { MapStyleKey } from "@/lib/map-data";
import { sectionTileBounds } from "@/lib/offline-tiles";
import { fetchWebUser } from "@/lib/webApi";
import { useTheme } from "@/theme/ThemeContext";

/**
 * Section-scoped map for the section detail screen: a small non-interactive,
 * POI-free preview fitted to just this section's corridor, tap to expand
 * into a full-screen map showing that same corridor plus its own nearby
 * shelters/campsites/water/parking/privies — a dedicated, deliberately
 * minimal map (SectionMap component), not the main Map tab's whole-trail
 * view cropped to a bounding box. Read-only: tapping a POI opens its detail
 * sheet, there's no tap-to-plan editing here (unlike web's section map modal).
 */
export function SectionMapCard({ section }: { section: SectionRow }) {
  const { colors, fontScale } = useTheme();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [modalOpen, setModalOpen] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyleKey>("outdoors");

  // Same preference source as the Map tab, so the section map matches the
  // user's chosen tile style instead of always defaulting.
  useEffect(() => {
    if (!token) return;
    fetchWebUser(token)
      .then((u) => {
        if (u.mapStyle === "outdoors" || u.mapStyle === "satellite" || u.mapStyle === "topo") {
          setMapStyle(u.mapStyle);
        }
      })
      .catch(() => {});
  }, [token]);

  const bounds = useMemo(
    () =>
      section.startMile != null && section.endMile != null
        ? sectionTileBounds(section.startMile, section.endMile)
        : null,
    [section.startMile, section.endMile]
  );

  if (!bounds) return null;

  return (
    <Card style={{ marginTop: 12, padding: 0, overflow: "hidden" }}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 13 * fontScale, fontWeight: "600", color: colors.text }}>
          Section Map
        </Text>
      </View>
      <Pressable onPress={() => setModalOpen(true)} style={{ height: 180 }}>
        {/* pointerEvents="none" — the embedded map swallows touches otherwise,
            same reason SectionElevationProfile's SVG preview is wrapped this way. */}
        <View style={{ flex: 1 }} pointerEvents="none">
          <SectionMap section={section} mapStyle={mapStyle} bounds={bounds} interactive={false} showPois={false} />
        </View>
        <View
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            backgroundColor: colors.accent,
            borderRadius: 6,
            padding: 5,
          }}
        >
          <Maximize2 color="#FFFFFF" size={14} />
        </View>
      </Pressable>

      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 8 }}>
            <Text
              style={{ flex: 1, fontSize: 15 * fontScale, fontWeight: "700", color: colors.text }}
              numberOfLines={1}
            >
              {section.name}
            </Text>
            <Pressable onPress={() => setModalOpen(false)} hitSlop={8} style={{ padding: 4 }}>
              <X color={colors.muted} size={20} />
            </Pressable>
          </View>
          <View style={{ flex: 1 }}>
            <SectionMap section={section} mapStyle={mapStyle} bounds={bounds} />
          </View>
        </View>
      </Modal>
    </Card>
  );
}
