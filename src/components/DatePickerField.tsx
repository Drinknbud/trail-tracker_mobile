import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { useUnits } from "@/lib/units-context";
import { useTheme } from "@/theme/ThemeContext";

// Pure-JS calendar picker, replacing the free-text "YYYY-MM-DD" fields
// previously used for section/night/day-log dates. Value is stored/passed
// as a "YYYY-MM-DD" string (unchanged wire format), displayed via
// useUnits().fmtDate so it respects the user's dateFormat setting.
//
// Deliberately not @react-native-community/datetimepicker: that native
// module's classes/TurboModule name strings compile into the APK fine but
// fail TurboModuleRegistry.getEnforcing() at runtime — a real upstream gap
// between RN 0.86.0 (published June 2026) and the picker library's native
// registration code, last updated in March 2026 before 0.86 existed. No
// project-side rebuild fixes that until the library catches up, so this
// avoids the native dependency entirely — matching the codebase's original
// no-native-date-picker convention (see section/new.tsx's original history).

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

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

/** Cells for a month grid: null = padding (adjacent month), else day-of-month Date. */
function getMonthGrid(year: number, month: number): (Date | null)[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d, 12));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
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
  /** "YYYY-MM-DD" bounds — mirrors web's <input type="date" min/max>. Days
   * outside the range render disabled (greyed, untappable) rather than
   * just being validated after the fact. */
  minimumDate?: string | null;
  maximumDate?: string | null;
}) {
  const { colors, fontScale } = useTheme();
  const { fmtDate } = useUnits();
  const [show, setShow] = useState(false);
  // The month currently shown in the grid — seeded from value (or today)
  // each time the sheet opens, independent of the actual selected date so
  // navigating months doesn't itself change the selection.
  const [viewDate, setViewDate] = useState<Date>(() => parseLocalDate(value));

  const openPicker = () => {
    setViewDate(parseLocalDate(value));
    setShow(true);
  };

  const selectedStr = value?.slice(0, 10) ?? null;
  const minStr = minimumDate?.slice(0, 10) ?? null;
  const maxStr = maximumDate?.slice(0, 10) ?? null;

  const isDisabled = (d: Date) => {
    const s = toDateString(d);
    if (minStr && s < minStr) return true;
    if (maxStr && s > maxStr) return true;
    return false;
  };

  const grid = getMonthGrid(viewDate.getFullYear(), viewDate.getMonth());
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const todayStr = toDateString(new Date());

  const shiftMonth = (delta: number) =>
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1, 12));

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginBottom: 4 }}>
        {label}
      </Text>
      <Pressable
        onPress={openPicker}
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

      <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
          <Pressable style={{ flex: 1 }} onPress={() => setShow(false)} />
          <View
            style={{
              backgroundColor: colors.bg,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingBottom: 16,
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
                <X color={colors.muted} size={18} />
              </Pressable>
            </View>

            {/* Month navigation */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                paddingTop: 14,
                paddingBottom: 6,
              }}
            >
              <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} style={{ padding: 4 }}>
                <ChevronLeft color={colors.text} size={20} />
              </Pressable>
              <Text style={{ fontSize: 15 * fontScale, fontWeight: "700", color: colors.text }}>
                {monthLabel}
              </Text>
              <Pressable onPress={() => shiftMonth(1)} hitSlop={10} style={{ padding: 4 }}>
                <ChevronRight color={colors.text} size={20} />
              </Pressable>
            </View>

            {/* Weekday header */}
            <View style={{ flexDirection: "row", paddingHorizontal: 16, marginTop: 6 }}>
              {WEEKDAY_LABELS.map((w, i) => (
                <View key={i} style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ fontSize: 11 * fontScale, color: colors.muted, fontWeight: "600" }}>
                    {w}
                  </Text>
                </View>
              ))}
            </View>

            {/* Day grid */}
            <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
              {Array.from({ length: grid.length / 7 }).map((_, row) => (
                <View key={row} style={{ flexDirection: "row" }}>
                  {grid.slice(row * 7, row * 7 + 7).map((d, col) => {
                    if (!d) return <View key={col} style={{ flex: 1, aspectRatio: 1 }} />;
                    const dStr = toDateString(d);
                    const disabled = isDisabled(d);
                    const selected = dStr === selectedStr;
                    const isToday = dStr === todayStr;
                    return (
                      <Pressable
                        key={col}
                        disabled={disabled}
                        onPress={() => {
                          onChange(dStr);
                          setShow(false);
                        }}
                        style={{
                          flex: 1,
                          aspectRatio: 1,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: selected ? colors.accent : "transparent",
                            borderWidth: isToday && !selected ? 1 : 0,
                            borderColor: colors.accent,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13 * fontScale,
                              fontWeight: selected ? "700" : "500",
                              color: disabled
                                ? colors.border
                                : selected
                                  ? "#FFFFFF"
                                  : colors.text,
                            }}
                          >
                            {d.getDate()}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
