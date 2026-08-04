import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { CalendarDays, X } from "lucide-react-native";
import { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";

import { useUnits } from "@/lib/units-context";
import { useTheme } from "@/theme/ThemeContext";

// Native date picker, replacing the free-text "YYYY-MM-DD" fields
// previously used for section/night/day-log dates. Value is stored/passed
// as a "YYYY-MM-DD" string (unchanged wire format), displayed via
// useUnits().fmtDate so it respects the user's dateFormat setting.
//
// Android's picker is a one-shot system dialog (mount-to-show, unmounts on
// answer). iOS's inline spinner has no built-in dismiss affordance, so it's
// wrapped in a bottom-sheet Modal with a "Done" button instead.

function parseLocalDate(v?: string | null): Date {
  if (!v) return new Date();
  const [y, m, d] = v.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 12); // noon local — avoids a TZ-driven day shift
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DatePickerField({
  label,
  value,
  onChange,
  placeholder = "Select date",
  clearable = true,
  minimumDate,
  maximumDate,
}: {
  label: string;
  /** "YYYY-MM-DD" or null/undefined for unset */
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  placeholder?: string;
  clearable?: boolean;
  /** "YYYY-MM-DD" bounds — mirrors web's <input type="date" min/max>. The
   * native picker itself refuses to select outside the range (Android greys
   * out/blocks it, iOS's spinner just won't scroll past it), so this is
   * enforced at selection time, not just validated after the fact. */
  minimumDate?: string | null;
  maximumDate?: string | null;
}) {
  const { colors, fontScale, scheme } = useTheme();
  const { fmtDate } = useUnits();
  const [show, setShow] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") {
      setShow(false);
      if (event.type === "set" && selected) onChange(toDateString(selected));
      return;
    }
    if (selected) onChange(toDateString(selected));
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginBottom: 4 }}>
        {label}
      </Text>
      <Pressable
        onPress={() => setShow(true)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          width: "100%",
          paddingHorizontal: 12,
          paddingVertical: 9,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
        }}
      >
        <CalendarDays color={colors.muted} size={15} />
        <Text
          style={{
            flex: 1,
            marginLeft: 8,
            fontSize: 14 * fontScale,
            color: value ? colors.text : colors.muted,
          }}
        >
          {value ? fmtDate(value) : placeholder}
        </Text>
        {clearable && value ? (
          <Pressable hitSlop={8} onPress={() => onChange(null)}>
            <X color={colors.muted} size={14} />
          </Pressable>
        ) : null}
      </Pressable>

      {show && Platform.OS === "android" ? (
        <DateTimePicker
          value={parseLocalDate(value)}
          mode="date"
          display="default"
          onChange={handleChange}
          minimumDate={minimumDate ? parseLocalDate(minimumDate) : undefined}
          maximumDate={maximumDate ? parseLocalDate(maximumDate) : undefined}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
          <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
            <Pressable style={{ flex: 1 }} onPress={() => setShow(false)} />
            <View
              style={{
                backgroundColor: colors.bg,
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 14 * fontScale, fontWeight: "600", color: colors.text }}>
                  {label}
                </Text>
                <Pressable onPress={() => setShow(false)} hitSlop={8}>
                  <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 15 * fontScale }}>
                    Done
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={parseLocalDate(value)}
                mode="date"
                display="spinner"
                themeVariant={scheme}
                onChange={handleChange}
                minimumDate={minimumDate ? parseLocalDate(minimumDate) : undefined}
                maximumDate={maximumDate ? parseLocalDate(maximumDate) : undefined}
                style={{ alignSelf: "center" }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
