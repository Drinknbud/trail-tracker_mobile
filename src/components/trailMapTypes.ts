import type { SectionRow } from "@/db/types";
import type { LayerVisibility } from "@/components/MapLayerBar";
import type { MapPhotoResolved, MapStyleKey } from "@/lib/map-data";

export type TrailMapProps = {
  layers: LayerVisibility;
  mapStyle: MapStyleKey;
  sections: SectionRow[];
  carrier: string | null;
  /** Geo-tagged trail photos (already position-resolved) for the Photos layer. */
  photos: MapPhotoResolved[];
};
