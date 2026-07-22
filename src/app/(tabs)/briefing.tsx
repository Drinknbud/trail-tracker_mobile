import { CloudRain, Sun, Sunrise, Sunset, Thermometer } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as SunCalc from "suncalc";

import { ElevationChart } from "@/components/ElevationChart";
import { PremiumGate } from "@/components/PremiumGate";
import { Card, Screen } from "@/components/Screen";
import { usePremium } from "@/lib/usePremium";
import { useUnits } from "@/lib/units-context";
import {
  tripStore,
  type BriefingRow,
  type ElevationProfile,
  type PoiRow,
  type SectionDetailRow,
} from "@/db";
import { useTheme } from "@/theme/ThemeContext";

type Weather = { tempMin?: number; tempMax?: number; precip?: number; uvIndexMax?: number };

function WeatherTile({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}) {
  const { colors, fontScale } = useTheme();
  return (
    <Card style={{ flex: 1, alignItems: "center", paddingVertical: 10, paddingHorizontal: 4 }}>
      {icon}
      <Text
        style={{
          fontSize: 15 * fontScale,
          fontWeight: "700",
          color: color ?? colors.text,
          marginTop: 4,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 9 * fontScale,
          color: colors.muted,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </Card>
  );
}

// Raw 12h "6:32 AM" rendering of a Date — piped through useUnits().fmtTime
// below so sunrise/sunset also honor the 12h/24h setting.
function rawTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function BriefingScreen() {
  const { colors, fontScale } = useTheme();
  const { fmtTemp, fmtMileMarker, fmtTime } = useUnits();
  const { isPremium, isLoading: premiumLoading } = usePremium();

  const [section, setSection] = useState<SectionDetailRow | null>(null);
  const [briefings, setBriefings] = useState<BriefingRow[]>([]);
  const [dayIndex, setDayIndex] = useState(0);
  const [profile, setProfile] = useState<
    (ElevationProfile & { midLat: number | null; midLon: number | null }) | null
  >(null);
  const [pois, setPois] = useState<PoiRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    await tripStore.init();
    const downloads = await tripStore.listTripDownloads();
    const today = new Date().toISOString().slice(0, 10);

    let best: { section: SectionDetailRow; briefings: BriefingRow[] } | null = null;
    for (const d of downloads) {
      const s = await tripStore.getSectionDetail(d.sectionId);
      if (!s) continue;
      const b = await tripStore.listBriefings(d.sectionId);
      if (b.length === 0) continue;
      const activeToday =
        s.startDate && s.endDate && s.startDate.slice(0, 10) <= today && today <= s.endDate.slice(0, 10);
      if (activeToday) {
        best = { section: s, briefings: b };
        break;
      }
      if (!best) best = { section: s, briefings: b };
    }

    if (best) {
      setSection(best.section);
      setBriefings(best.briefings);
      setProfile(await tripStore.getElevationProfile(best.section.id));
      setPois(await tripStore.listPois(best.section.id));
      // Open today's briefing when the trip is underway
      if (best.section.startDate) {
        const start = new Date(`${best.section.startDate.slice(0, 10)}T00:00:00`);
        const idx = Math.floor((Date.now() - start.getTime()) / 86400000);
        const match = best.briefings.find((b) => b.dayIndex === idx);
        setDayIndex(match ? idx : best.briefings[0].dayIndex);
      } else {
        setDayIndex(best.briefings[0].dayIndex);
      }
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!loaded || premiumLoading) return <Screen title="Morning Briefing">{null}</Screen>;

  // F5: morning briefing is premium — gate reads from the offline-cached
  // entitlement so paying hikers keep it in airplane mode
  if (!isPremium) {
    return (
      <Screen title="Morning Briefing">
        <PremiumGate feature="Morning Briefing" />
      </Screen>
    );
  }

  if (!section || briefings.length === 0) {
    return (
      <Screen title="Morning Briefing">
        <Card>
          <Text style={{ fontSize: 14 * fontScale, fontWeight: "600", color: colors.text }}>
            No briefings downloaded
          </Text>
          <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginTop: 4 }}>
            Download a trip from the Trail Journal — its morning briefings come along and render
            fully offline, right here.
          </Text>
        </Card>
      </Screen>
    );
  }

  const briefing = briefings.find((b) => b.dayIndex === dayIndex) ?? briefings[0];
  const weather: Weather = briefing.weatherJson ? JSON.parse(briefing.weatherJson) : {};
  const precipColor =
    (weather.precip ?? 0) >= 70
      ? colors.destructiveRed
      : (weather.precip ?? 0) >= 40
        ? colors.offlineAmber
        : undefined;
  const uvColor =
    (weather.uvIndexMax ?? 0) >= 8
      ? colors.featurePurple
      : (weather.uvIndexMax ?? 0) >= 6
        ? colors.offlineAmber
        : undefined;

  // Sunrise/sunset — pure local math (suncalc), works in airplane mode (F11)
  const rawSunTimes =
    profile?.midLat != null && profile?.midLon != null
      ? SunCalc.getTimes(new Date(briefing.date), profile.midLat, profile.midLon)
      : null;
  const sunTimes =
    rawSunTimes?.sunrise && rawSunTimes?.sunset
      ? { sunrise: rawSunTimes.sunrise, sunset: rawSunTimes.sunset }
      : null;

  const dayPois = pois.slice(0, 8);

  return (
    <Screen title="Morning Briefing">
      <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginBottom: 12 }}>
        {section.name}
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {briefings.map((b) => {
          const active = b.dayIndex === dayIndex;
          return (
            <Pressable
              key={b.id}
              onPress={() => setDayIndex(b.dayIndex)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: active ? colors.accent : colors.surface,
                borderColor: active ? colors.accent : colors.border,
                borderWidth: 1,
              }}
            >
              <Text
                style={{
                  fontSize: 12 * fontScale,
                  fontWeight: active ? "700" : "400",
                  color: active ? "#FFFFFF" : colors.text,
                }}
              >
                Day {b.dayIndex + 1}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <WeatherTile
          icon={<Thermometer color={colors.planned} size={18} />}
          label="Low"
          value={weather.tempMin != null ? fmtTemp(weather.tempMin) : "—"}
        />
        <WeatherTile
          icon={<Thermometer color={colors.destructiveRed} size={18} />}
          label="High"
          value={weather.tempMax != null ? fmtTemp(weather.tempMax) : "—"}
        />
        <WeatherTile
          icon={<CloudRain color={precipColor ?? colors.muted} size={18} />}
          label="Precip"
          value={weather.precip != null ? `${weather.precip}%` : "—"}
          color={precipColor}
        />
        <WeatherTile
          icon={<Sun color={uvColor ?? colors.celebrationYellow} size={18} />}
          label="UV Max"
          value={weather.uvIndexMax != null ? `${weather.uvIndexMax}` : "—"}
          color={uvColor}
        />
      </View>

      {sunTimes ? (
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          <Card
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingVertical: 10,
            }}
          >
            <Sunrise color={colors.celebrationYellow} size={18} />
            <Text style={{ fontSize: 13 * fontScale, color: colors.text, fontWeight: "600" }}>
              {fmtTime(rawTime(sunTimes.sunrise))}
            </Text>
          </Card>
          <Card
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingVertical: 10,
            }}
          >
            <Sunset color={colors.bugOrange} size={18} />
            <Text style={{ fontSize: 13 * fontScale, color: colors.text, fontWeight: "600" }}>
              {fmtTime(rawTime(sunTimes.sunset))}
            </Text>
          </Card>
        </View>
      ) : null}

      <Card style={{ marginBottom: 8 }}>
        <Text style={{ fontSize: 14 * fontScale, color: colors.text, lineHeight: 21 * fontScale }}>
          {briefing.narrative}
        </Text>
      </Card>

      {profile ? (
        <Card style={{ marginBottom: 8 }}>
          <Text
            style={{
              fontSize: 12 * fontScale,
              fontWeight: "600",
              color: colors.muted,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            Section elevation
          </Text>
          <ElevationChart
            points={profile.points}
            trailMinElevFt={profile.trailMinElevFt}
            trailMaxElevFt={profile.trailMaxElevFt}
          />
        </Card>
      ) : null}

      {dayPois.length > 0 ? (
        <Card style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 12 * fontScale,
              fontWeight: "600",
              color: colors.muted,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 6,
            }}
          >
            On this section ({pois.length} POIs)
          </Text>
          {dayPois.map((p, i) => (
            <View
              key={`${p.type}-${p.name}-${i}`}
              style={{
                flexDirection: "row",
                paddingVertical: 5,
                borderBottomWidth: i === dayPois.length - 1 ? 0 : 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ flex: 1, fontSize: 13 * fontScale, color: colors.text }}>
                {p.name}
              </Text>
              <Text style={{ fontSize: 12 * fontScale, color: colors.muted }}>
                {fmtMileMarker(p.mile)}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
