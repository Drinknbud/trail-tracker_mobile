import { MapPin, Search, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeContext";

// Mobile port of web's components/TrailheadPicker.tsx — a search-as-you-type
// trailhead selector for manual section entry. Web uses an inline combobox
// with keyboard nav; mobile uses a full bottom-sheet with a search box
// (touch input doesn't have arrow-key nav, and a plain scroll list of 150+
// AT trailheads is unusable without search).

export type TrailheadOption = {
  id: number;
  name: string;
  type: "parking" | "gap" | "trailhead";
  mile: number;
};

const TYPE_ICON: Record<TrailheadOption["type"], string> = {
  parking: "🅿️",
  gap: "⛰️",
  trailhead: "🥾",
};

function filterTrailheads(trailheads: TrailheadOption[], query: string): TrailheadOption[] {
  const q = query.trim();
  if (!q) return trailheads.slice(0, 50);
  const lower = q.toLowerCase();
  const asNum = parseFloat(q);
  const isMileSearch = !isNaN(asNum) && /^\d/.test(q);
  return trailheads
    .filter((t) => {
      if (t.name.toLowerCase().includes(lower)) return true;
      if (isMileSearch && String(t.mile).startsWith(q)) return true;
      return false;
    })
    .slice(0, 50);
}

export function TrailheadPicker({
  trailheads,
  value,
  onChange,
  placeholder = "Search trailheads…",
  label,
}: {
  trailheads: TrailheadOption[];
  value: number | "";
  onChange: (id: number | "") => void;
  placeholder?: string;
  label: string;
}) {
  const { colors, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = trailheads.find((t) => t.id === value) ?? null;
  const results = useMemo(() => filterTrailheads(trailheads, query), [trailheads, query]);

  return (
    <View>
      <Text style={{ fontSize: 12 * fontScale, fontWeight: "600", color: colors.text, marginBottom: 4 }}>
        {label}
      </Text>
      <Pressable
        onPress={() => { setQuery(""); setOpen(true); }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 11,
        }}
      >
        <MapPin color={colors.muted} size={15} />
        <Text
          style={{ flex: 1, fontSize: 14 * fontScale, color: selected ? colors.text : colors.muted }}
          numberOfLines={1}
        >
          {selected ? selected.name : placeholder}
        </Text>
        {selected ? (
          <Pressable onPress={() => onChange("")} hitSlop={8}>
            <X color={colors.muted} size={15} />
          </Pressable>
        ) : null}
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} onPress={() => setOpen(false)}>
          <Pressable
            style={{
              marginTop: "auto",
              maxHeight: "80%",
              backgroundColor: colors.surface,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingBottom: insets.bottom + 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ flex: 1, fontSize: 16 * fontScale, fontWeight: "700", color: colors.text }}>
                {label}
              </Text>
              <Pressable onPress={() => setOpen(false)}>
                <X color={colors.muted} size={20} />
              </Pressable>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginHorizontal: 16,
                marginTop: 12,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 9,
              }}
            >
              <Search color={colors.muted} size={15} />
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name or mile…"
                placeholderTextColor={colors.muted}
                style={{ flex: 1, fontSize: 14 * fontScale, color: colors.text }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {results.length === 0 ? (
                <Text
                  style={{
                    fontSize: 13 * fontScale,
                    color: colors.muted,
                    textAlign: "center",
                    paddingVertical: 24,
                  }}
                >
                  {query ? "No matching trailheads" : "No trailheads available"}
                </Text>
              ) : (
                results.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => { onChange(t.id); setOpen(false); }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      backgroundColor: t.id === value ? `${colors.accent}14` : "transparent",
                    }}
                  >
                    <Text style={{ fontSize: 13 * fontScale }}>{TYPE_ICON[t.type] ?? "📍"}</Text>
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 14 * fontScale,
                        color: colors.text,
                        fontWeight: t.id === value ? "600" : "400",
                      }}
                      numberOfLines={1}
                    >
                      {t.name}
                    </Text>
                    <Text style={{ fontSize: 12 * fontScale, color: colors.muted }}>mi {t.mile}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
