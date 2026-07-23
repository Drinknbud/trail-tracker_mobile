import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import { useUnits } from "@/lib/units-context";
import { useTheme } from "@/theme/ThemeContext";
import type { TownProperties } from "@/lib/map-data";

/**
 * Bottom sheet for a resupply town, mirroring the web map's town popup
 * (components/TrailMap.tsx TownMarkers). Info-only — unlike PoiDetailSheet
 * there is no voting or comment thread, because towns come from the ATC Data
 * Book rather than an OSM element, so there is no shared id to key community
 * content to.
 */
export function TownDetailSheet({
  town,
  visible,
  onClose,
}: {
  town: TownProperties | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { colors, fontScale, scheme } = useTheme();
  const { fmtMileMarker } = useUnits();
  if (!town) return null;

  let services: string[] = [];
  try {
    const parsed = JSON.parse(town.services || "[]");
    if (Array.isArray(parsed)) services = parsed.filter((s) => typeof s === "string");
  } catch {
    services = [];
  }

  const accessLabel = town.onTrail
    ? "On the A.T."
    : town.offTrailMiles != null
      ? `${town.offTrailMiles} mi ${town.direction === "E" ? "east" : town.direction === "W" ? "west" : "off trail"}`
      : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={onClose} />
      <View
        style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          paddingHorizontal: 18,
          paddingTop: 12,
          paddingBottom: 28,
          maxHeight: "70%",
        }}
      >
        <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 }} />

        <ScrollView>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ height: 26, width: 26, borderRadius: 7, backgroundColor: "#7C3AED", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#FFFFFF", fontSize: 13 }}>⌂</Text>
            </View>
            <Text style={{ flex: 1, fontSize: 17 * fontScale, fontWeight: "700", color: colors.text }}>{town.name}</Text>
          </View>

          <Text style={{ marginTop: 6, fontSize: 13 * fontScale, color: colors.muted }}>
            {fmtMileMarker(town.atMile)}
          </Text>
          {town.access && (
            <Text style={{ marginTop: 2, fontSize: 13 * fontScale, color: colors.muted }}>via {town.access}</Text>
          )}
          {accessLabel && (
            <Text style={{ marginTop: 6, fontSize: 14 * fontScale, fontWeight: "700", color: "#7C3AED" }}>{accessLabel}</Text>
          )}

          {services.length > 0 && (
            <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {services.map((s) => (
                <View
                  key={s}
                  style={{
                    paddingHorizontal: 9,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: scheme === "dark" ? "rgba(124,58,237,0.22)" : "rgba(124,58,237,0.12)",
                  }}
                >
                  <Text style={{ fontSize: 11 * fontScale, fontWeight: "600", color: scheme === "dark" ? "#C4B5FD" : "#6D28D9" }}>{s}</Text>
                </View>
              ))}
            </View>
          )}

          {town.notes && (
            <Text style={{ marginTop: 12, fontSize: 13 * fontScale, lineHeight: 19 * fontScale, color: colors.text }}>
              {town.notes}
            </Text>
          )}

          <Text style={{ marginTop: 14, fontSize: 11 * fontScale, color: colors.muted }}>
            Mileage from the ATC A.T. Data Book.
          </Text>
        </ScrollView>

        <Pressable
          onPress={onClose}
          style={{ marginTop: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}
        >
          <Text style={{ fontSize: 14 * fontScale, fontWeight: "600", color: colors.text }}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
