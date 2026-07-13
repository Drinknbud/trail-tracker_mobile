import { Check, X } from "lucide-react-native";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeContext";

export type PickerOption = { value: string; label: string } | { header: string };

export function PickerModal({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: PickerOption[];
  value: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const { colors, fontScale } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
        onPress={onClose}
      >
        <Pressable
          style={{
            marginTop: "auto",
            maxHeight: "75%",
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
              {title}
            </Text>
            <Pressable onPress={onClose}>
              <X color={colors.muted} size={20} />
            </Pressable>
          </View>
          <ScrollView>
            {options.map((opt, i) =>
              "header" in opt ? (
                <Text
                  key={`h-${i}`}
                  style={{
                    fontSize: 11 * fontScale,
                    fontWeight: "600",
                    color: colors.muted,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    paddingHorizontal: 16,
                    paddingTop: 14,
                    paddingBottom: 4,
                  }}
                >
                  {opt.header}
                </Text>
              ) : (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    onSelect(opt.value);
                    onClose();
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                  }}
                >
                  <Text style={{ flex: 1, fontSize: 14 * fontScale, color: colors.text }}>
                    {opt.label}
                  </Text>
                  {value === opt.value ? <Check color={colors.accent} size={18} /> : null}
                </Pressable>
              )
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
