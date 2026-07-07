import { useState } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";

import { useTheme } from "@/theme/ThemeContext";

export function FormField({
  label,
  ...inputProps
}: TextInputProps & { label: string }) {
  const { colors, fontScale } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginBottom: 4 }}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.muted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...inputProps}
        style={{
          width: "100%",
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
          borderWidth: focused ? 2 : 1,
          borderColor: focused ? colors.accent : colors.border,
          backgroundColor: colors.bg,
          color: colors.text,
          fontSize: 14 * fontScale,
        }}
      />
    </View>
  );
}
