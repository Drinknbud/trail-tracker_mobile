import { Modal, Pressable, Text } from "react-native";

import { useTheme } from "@/theme/ThemeContext";

/**
 * Tap-to-info callout for a phone-coverage dead-zone patch — mirrors web's
 * FccCoverageLayer Leaflet popup ("📵 No Coverage · No {carrier} LTE/5G
 * signal · FCC BDC data"). Lighter than PoiDetailSheet/PhotoDetailSheet's
 * slide-up sheets since there's no further interaction, just two lines of
 * static info — a small dismissible callout near the bottom of the screen.
 */
export function CoverageInfoSheet({
  visible,
  carrierLabel,
  onClose,
}: {
  visible: boolean;
  carrierLabel: string;
  onClose: () => void;
}) {
  const { colors, fontScale } = useTheme();
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <Pressable
          style={{
            margin: 16,
            marginBottom: 40,
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: "#DC262644",
          }}
        >
          <Text style={{ fontSize: 14 * fontScale, fontWeight: "700", color: "#DC2626" }}>📵 No Coverage</Text>
          <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginTop: 4 }}>
            No {carrierLabel} LTE/5G signal · FCC BDC data
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
