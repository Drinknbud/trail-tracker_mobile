import { Image } from "expo-image";
import { WifiOff } from "lucide-react-native";
import { ScrollView, Text, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeContext";
import { COMPLETED_COLOR } from "@/lib/section-colors";
import { MAP_STYLES, type MapStyleKey } from "@/lib/map-data";

export type LayerVisibility = {
  completed: boolean;
  planned: boolean;
  shelters: boolean;
  campsites: boolean;
  campsitesNamedOnly: boolean;
  parking: boolean;
  water: boolean;
  privies: boolean;
  photos: boolean;
  fccCoverage: boolean;
};

export const DEFAULT_LAYERS: LayerVisibility = {
  completed: true,
  planned: true,
  shelters: true,
  campsites: true,
  campsitesNamedOnly: true,
  parking: true,
  water: true,
  privies: true,
  photos: true,
  fccCoverage: true,
};

const PLANNED_PILL_COLOR = "#3B82F6";

const poiIcons = {
  shelter: require("../../assets/images/poi/poi-shelter.png"),
  campsite: require("../../assets/images/poi/poi-campsite.png"),
  parking: require("../../assets/images/poi/poi-parking.png"),
  water: require("../../assets/images/poi/poi-water.png"),
  privy: require("../../assets/images/poi/poi-privy.png"),
};

function Pill({
  active,
  onPress,
  activeColor,
  icon,
  label,
}: {
  active: boolean;
  onPress: () => void;
  activeColor: string;
  icon: React.ReactNode;
  label: string;
}) {
  const { colors, fontScale } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? activeColor + "66" : colors.border,
        backgroundColor: active ? activeColor + "1A" : "transparent",
        opacity: active ? 1 : 0.45,
      }}
    >
      {icon}
      <Text
        style={{
          fontSize: 11 * fontScale,
          fontWeight: "600",
          color: colors.text,
          textDecorationLine: active ? "none" : "line-through",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Dot({ color }: { color: string }) {
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />;
}

function PoiIcon({ name }: { name: keyof typeof poiIcons }) {
  return <Image source={poiIcons[name]} style={{ width: 14, height: 14 }} contentFit="contain" />;
}

export function MapLayerBar({
  layers,
  onToggle,
  mapStyle,
  onMapStyleChange,
  carrier,
}: {
  layers: LayerVisibility;
  onToggle: (key: keyof LayerVisibility) => void;
  mapStyle: MapStyleKey;
  onMapStyleChange: (style: MapStyleKey) => void;
  /** User's carrier (Settings > Trail Mode). Null disables the dead-zones pill, matching web. */
  carrier: string | null;
}) {
  const { colors, fontScale } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border, paddingTop: insets.top + 8, paddingBottom: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 18 * fontScale, fontWeight: "700", color: colors.text }}>Trail Map</Text>
        <View style={{ flexDirection: "row", borderRadius: 8, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
          {MAP_STYLES.map(({ value, label }) => {
            const active = mapStyle === value;
            return (
              <Pressable
                key={value}
                onPress={() => onMapStyleChange(value)}
                style={{
                  paddingHorizontal: 9,
                  paddingVertical: 5,
                  backgroundColor: active ? colors.accent : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 10.5 * fontScale,
                    fontWeight: "600",
                    color: active ? "#FFFFFF" : colors.muted,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 6, marginTop: 8 }}
      >
        <Pill active={layers.completed} onPress={() => onToggle("completed")} activeColor={COMPLETED_COLOR} icon={<Dot color={COMPLETED_COLOR} />} label="Completed" />
        <Pill active={layers.planned} onPress={() => onToggle("planned")} activeColor={PLANNED_PILL_COLOR} icon={<Dot color={PLANNED_PILL_COLOR} />} label="Planned" />
        <Pill active={layers.shelters} onPress={() => onToggle("shelters")} activeColor="#78350F" icon={<PoiIcon name="shelter" />} label="Shelters" />
        <Pill active={layers.campsites} onPress={() => onToggle("campsites")} activeColor="#D97706" icon={<PoiIcon name="campsite" />} label="Campsites" />
        <Pill active={layers.parking} onPress={() => onToggle("parking")} activeColor="#1D4ED8" icon={<PoiIcon name="parking" />} label="Parking" />
        <Pill active={layers.water} onPress={() => onToggle("water")} activeColor="#0EA5E9" icon={<PoiIcon name="water" />} label="Water" />
        <Pill active={layers.privies} onPress={() => onToggle("privies")} activeColor="#78716C" icon={<PoiIcon name="privy" />} label="Privies" />
        <Pill active={layers.photos} onPress={() => onToggle("photos")} activeColor="#60A5FA" icon={<Text style={{ fontSize: 11 }}>📷</Text>} label="Photos" />
        <Pressable
          onPress={() => carrier && onToggle("fccCoverage")}
          disabled={!carrier}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: !carrier ? colors.border : layers.fccCoverage ? "#EF444466" : colors.border,
            backgroundColor: !carrier ? "transparent" : layers.fccCoverage ? "#EF44441A" : "transparent",
            opacity: !carrier ? 0.3 : layers.fccCoverage ? 1 : 0.45,
          }}
        >
          <WifiOff size={13} color="#EF4444" />
          <Text style={{ fontSize: 11 * fontScale, fontWeight: "600", color: colors.text, textDecorationLine: carrier && !layers.fccCoverage ? "line-through" : "none" }}>
            {carrier ? "Mobile Dead Zones" : "No Carrier Set"}
          </Text>
        </Pressable>
      </ScrollView>

      {layers.campsites && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, marginTop: 8 }}>
          <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>Named campsites only</Text>
          <Pressable
            onPress={() => onToggle("campsitesNamedOnly")}
            style={{
              width: 34,
              height: 18,
              borderRadius: 9,
              backgroundColor: layers.campsitesNamedOnly ? "#F59E0B" : colors.border,
              justifyContent: "center",
              paddingHorizontal: 2,
            }}
          >
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: "#FFFFFF",
                alignSelf: layers.campsitesNamedOnly ? "flex-end" : "flex-start",
              }}
            />
          </Pressable>
        </View>
      )}
    </View>
  );
}
