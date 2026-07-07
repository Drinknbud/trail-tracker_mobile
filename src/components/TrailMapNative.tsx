import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  OfflineManager,
  UserLocation,
} from "@maplibre/maplibre-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AT_BOUNDS,
  GA_SECTION_BOUNDS,
  MAP_STYLE_URL,
  SHELTER_COLLECTION,
  AT_TRAIL,
} from "@/lib/map-data";
import { useTheme } from "@/theme/ThemeContext";

type DownloadStatus =
  | { state: "idle" }
  | { state: "downloading"; percentage: number }
  | { state: "done" }
  | { state: "error"; message: string };

export function TrailMapNative() {
  const { colors, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const [download, setDownload] = useState<DownloadStatus>({ state: "idle" });

  const startDownload = async () => {
    if (download.state === "downloading") return;
    setDownload({ state: "downloading", percentage: 0 });
    try {
      await OfflineManager.createPack(
        {
          mapStyle: MAP_STYLE_URL,
          bounds: GA_SECTION_BOUNDS,
          minZoom: 8,
          maxZoom: 14,
          metadata: { name: "GA: Springer Mtn to Neels Gap" },
        },
        (_pack, status) => {
          if (status.state === "complete" || status.percentage >= 100) {
            setDownload({ state: "done" });
          } else {
            setDownload({ state: "downloading", percentage: status.percentage });
          }
        },
        (_pack, error) => {
          setDownload({ state: "error", message: error.message });
        }
      );
    } catch (err) {
      setDownload({
        state: "error",
        message: err instanceof Error ? err.message : "Download failed",
      });
    }
  };

  const downloadLabel =
    download.state === "idle"
      ? "Download GA section for offline"
      : download.state === "downloading"
        ? `Downloading… ${Math.round(download.percentage)}%`
        : download.state === "done"
          ? "GA section saved for offline ✓"
          : `Failed: ${download.message}`;

  return (
    <View style={{ flex: 1 }}>
      <MapLibreMap style={{ flex: 1 }} mapStyle={MAP_STYLE_URL}>
        <Camera initialViewState={{ bounds: AT_BOUNDS, padding: { top: 40, bottom: 40, left: 40, right: 40 } }} />
        <GeoJSONSource id="at-trail" data={AT_TRAIL}>
          <Layer
            id="at-trail-line"
            type="line"
            paint={{ "line-color": colors.accent, "line-width": 3 }}
          />
        </GeoJSONSource>
        <UserLocation />
        <GeoJSONSource id="at-shelters" data={SHELTER_COLLECTION}>
          <Layer
            id="at-shelter-dots"
            type="circle"
            minzoom={8}
            paint={{
              "circle-color": colors.trailBrown,
              "circle-radius": 5,
              "circle-stroke-color": "#FFFFFF",
              "circle-stroke-width": 1.5,
            }}
          />
        </GeoJSONSource>
      </MapLibreMap>

      <Pressable
        onPress={startDownload}
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: insets.bottom + 16,
          backgroundColor:
            download.state === "error" ? colors.destructiveRed : colors.accent,
          borderRadius: 8,
          paddingVertical: 12,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 14 * fontScale, fontWeight: "600" }}>
          {downloadLabel}
        </Text>
      </Pressable>
    </View>
  );
}
