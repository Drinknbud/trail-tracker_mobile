import { Image } from "expo-image";
import { X } from "lucide-react-native";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { MapPhotoResolved } from "@/lib/map-data";
import { useTheme } from "@/theme/ThemeContext";

// Mobile counterpart to web's photo marker popup + lightbox (components/
// TrailMap.tsx): tapping a camera marker opens this sheet with the full-size
// photo(s) pinned at that spot, each with its capture date.
export type PhotoSelection = MapPhotoResolved[];

export function PhotoDetailSheet({ photos, onClose }: { photos: PhotoSelection | null; onClose: () => void }) {
  const { colors, fontScale } = useTheme();
  const insets = useSafeAreaInsets();

  if (!photos || photos.length === 0) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} onPress={onClose}>
        <Pressable
          style={{
            marginTop: "auto",
            maxHeight: "82%",
            backgroundColor: colors.surface,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingBottom: insets.bottom + 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", padding: 16, paddingBottom: 8 }}>
            <Text style={{ flex: 1, fontSize: 17 * fontScale, fontWeight: "700", color: colors.text }}>
              {photos.length > 1 ? `${photos.length} Photos` : "Photo"}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X color={colors.muted} size={20} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 14 }}>
            {photos.map((p) => (
              <View key={p.id}>
                <Image
                  source={{ uri: p.baseUrl }}
                  placeholder={{ uri: p.thumbnailUrl }}
                  style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 8, backgroundColor: colors.border }}
                  contentFit="cover"
                  transition={150}
                />
                {p.takenAt && (
                  <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginTop: 4 }}>
                    {new Date(p.takenAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </Text>
                )}
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
