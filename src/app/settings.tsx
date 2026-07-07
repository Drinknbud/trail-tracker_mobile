import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";

import { FormField } from "@/components/FormField";
import { Card, Screen } from "@/components/Screen";
import { apiFetch } from "@/lib/api";
import { useAuth, type MeResponse } from "@/lib/auth";
import { enqueueWrite } from "@/lib/outbox";
import {
  getBriefingHour,
  getShareLocation,
  setBriefingHour,
  setShareLocation,
} from "@/lib/prefs";
import { useTheme } from "@/theme/ThemeContext";

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors, fontScale } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => onChange(opt.value)}
            style={{
              flex: 1,
              paddingVertical: 8,
              alignItems: "center",
              backgroundColor: active ? colors.accent : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 13 * fontScale,
                fontWeight: active ? "600" : "400",
                color: active ? "#FFFFFF" : colors.text,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const { colors, fontScale } = useTheme();
  const { token } = useAuth();

  const [name, setName] = useState("");
  const [trailName, setTrailName] = useState("");
  const [distanceUnit, setDistanceUnit] = useState("mi");
  const [tempUnit, setTempUnit] = useState("F");
  const [briefingHour, setBriefingHourState] = useState(7);
  const [shareLoc, setShareLoc] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setBriefingHourState(await getBriefingHour());
      setShareLoc(await getShareLocation());
      if (!token) return;
      try {
        const me = await apiFetch<MeResponse>("/api/mobile/me", { token });
        setName(me.user.name ?? "");
        setTrailName(me.user.trailName ?? "");
        setDistanceUnit(me.user.distanceUnit);
        setTempUnit(me.user.tempUnit);
      } catch {
        // Offline — device prefs still editable; profile loads next time
      }
    })();
  }, [token]);

  const save = async () => {
    await setBriefingHour(briefingHour);
    await setShareLocation(shareLoc);
    await enqueueWrite(
      "/api/mobile/settings",
      { name, trailName, distanceUnit, tempUnit },
      `settings-${Date.now()}`,
      token
    );
    setNotice("Saved — profile changes sync when online.");
  };

  return (
    <Screen>
      <Pressable
        onPress={() => router.back()}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}
      >
        <ArrowLeft color={colors.accent} size={20} />
        <Text style={{ color: colors.accent, fontSize: 14 * fontScale, fontWeight: "600" }}>
          Back
        </Text>
      </Pressable>

      <Text
        style={{ fontSize: 24 * fontScale, fontWeight: "700", color: colors.text, marginBottom: 16 }}
      >
        Settings
      </Text>

      <Card style={{ marginBottom: 12 }}>
        <Text
          style={{
            fontSize: 12 * fontScale, fontWeight: "600", color: colors.muted,
            textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10,
          }}
        >
          Profile
        </Text>
        <FormField label="Name" value={name} onChangeText={setName} placeholder="Your name" />
        <FormField
          label="Trail name"
          value={trailName}
          onChangeText={setTrailName}
          placeholder="Sunshine, Ridgerunner…"
        />
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <Text
          style={{
            fontSize: 12 * fontScale, fontWeight: "600", color: colors.muted,
            textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10,
          }}
        >
          Units
        </Text>
        <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginBottom: 4 }}>
          Distance
        </Text>
        <Segmented
          options={[
            { value: "mi", label: "Miles" },
            { value: "km", label: "Kilometers" },
          ]}
          value={distanceUnit}
          onChange={setDistanceUnit}
        />
        <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginTop: 12, marginBottom: 4 }}>
          Temperature
        </Text>
        <Segmented
          options={[
            { value: "F", label: "°F" },
            { value: "C", label: "°C" },
          ]}
          value={tempUnit}
          onChange={setTempUnit}
        />
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <Text
          style={{
            fontSize: 12 * fontScale, fontWeight: "600", color: colors.muted,
            textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10,
          }}
        >
          On Trail
        </Text>
        <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginBottom: 4 }}>
          Morning briefing time
        </Text>
        <Segmented
          options={[
            { value: 5, label: "5 AM" },
            { value: 6, label: "6 AM" },
            { value: 7, label: "7 AM" },
            { value: 8, label: "8 AM" },
          ]}
          value={briefingHour}
          onChange={setBriefingHourState}
        />
        <View
          style={{ flexDirection: "row", alignItems: "center", marginTop: 14 }}
        >
          <Text style={{ flex: 1, fontSize: 14 * fontScale, color: colors.text }}>
            Share my location on my share page
          </Text>
          <Switch
            value={shareLoc}
            onValueChange={setShareLoc}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor="#FFFFFF"
          />
        </View>
      </Card>

      <Pressable
        onPress={save}
        style={{
          backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 14,
          alignItems: "center", marginBottom: 8,
        }}
      >
        <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 * fontScale }}>
          Save
        </Text>
      </Pressable>
      {notice ? (
        <Text style={{ fontSize: 13 * fontScale, color: colors.completed, textAlign: "center" }}>
          {notice}
        </Text>
      ) : null}
    </Screen>
  );
}
