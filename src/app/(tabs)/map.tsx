import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { TrailMap } from "@/components/TrailMap";
import { DEFAULT_LAYERS, MapLayerBar, type LayerVisibility } from "@/components/MapLayerBar";
import { MapProgressCard } from "@/components/MapProgressCard";
import { carrierCoverageKey } from "@/lib/carriers";
import { tripStore, type SectionRow } from "@/db";
import { useAuth } from "@/lib/auth";
import { fetchMapPhotos, fetchTrails, fetchWebUser, updateWebUser, type MapPhoto, type WebTrail } from "@/lib/webApi";
import { coordinateAtMile, type MapPhotoResolved, type MapStyleKey } from "@/lib/map-data";

export default function MapScreen() {
  const { token } = useAuth();
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS);
  const [mapStyle, setMapStyle] = useState<MapStyleKey>("outdoors");
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [carrier, setCarrier] = useState<string | null>(null);
  const [activeTrail, setActiveTrail] = useState<WebTrail | null>(null);
  const [photos, setPhotos] = useState<MapPhoto[]>([]);

  // Re-read local sections every time the Map tab gains focus, so a section
  // downloaded/created/completed elsewhere shows up without a remount.
  useFocusEffect(
    useCallback(() => {
      tripStore.init().then(() => tripStore.listSections()).then(setSections).catch(() => {});
    }, [])
  );

  useEffect(() => {
    if (!token) return;
    fetchWebUser(token)
      .then((u) => {
        if (u.mapStyle === "outdoors" || u.mapStyle === "satellite" || u.mapStyle === "topo") {
          setMapStyle(u.mapStyle);
        }
        setCarrier(u.carrierProvider ?? null);
      })
      .catch(() => {});
    // Active trail powers the bottom-left progress overlay (mirrors web's card).
    fetchTrails(token)
      .then((trails) => setActiveTrail(trails.find((t) => t.isActive) ?? trails[0] ?? null))
      .catch(() => {});
    fetchMapPhotos(token).then(setPhotos).catch(() => {});
  }, [token]);

  // Resolve each active-trail photo to a map position — GPS coords when present,
  // otherwise the section mile-midpoint (mirrors web's TrailMap photoMarkers).
  const photoMarkers = useMemo<MapPhotoResolved[]>(() => {
    const activeKey = activeTrail?.catalogKey ?? null;
    if (!activeKey) return [];
    const out: MapPhotoResolved[] = [];
    for (const p of photos) {
      if (p.trailKey !== activeKey) continue;
      let lat = p.lat;
      let lng = p.lng;
      if ((lat == null || lng == null) && p.sectionStartMile != null && p.sectionEndMile != null) {
        const coord = coordinateAtMile((p.sectionStartMile + p.sectionEndMile) / 2);
        if (coord) [lng, lat] = coord;
      }
      if (lat == null || lng == null) continue;
      out.push({ id: p.id, baseUrl: p.baseUrl, thumbnailUrl: p.thumbnailUrl, takenAt: p.takenAt, lat, lng });
    }
    return out;
  }, [photos, activeTrail]);

  const handleMapStyleChange = useCallback(
    (style: MapStyleKey) => {
      setMapStyle(style);
      if (token) updateWebUser(token, { mapStyle: style }).catch(() => {});
    },
    [token]
  );

  const toggle = useCallback((key: keyof LayerVisibility) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <MapLayerBar layers={layers} onToggle={toggle} mapStyle={mapStyle} onMapStyleChange={handleMapStyleChange} carrier={carrier} />
      <View style={{ flex: 1 }}>
        <TrailMap layers={layers} mapStyle={mapStyle} sections={sections} carrier={carrier} photos={photoMarkers} />
        {activeTrail && (
          <MapProgressCard
            name={activeTrail.displayName}
            totalMiles={activeTrail.totalMiles}
            completedMiles={activeTrail.completedMiles}
          />
        )}
        {/* Matches web's FccCoverageLayer "Coverage data unavailable" pill —
            shown for carriers with no precomputed dead-zone file (US Cellular,
            "Other") rather than silently rendering nothing. */}
        {layers.fccCoverage && carrier && !carrierCoverageKey(carrier) && (
          <Text
            style={{
              position: "absolute",
              bottom: 32,
              left: 8,
              backgroundColor: "rgba(220,38,38,0.85)",
              color: "#FFFFFF",
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 4,
              fontSize: 11,
            }}
          >
            Coverage data unavailable
          </Text>
        )}
      </View>
    </View>
  );
}
