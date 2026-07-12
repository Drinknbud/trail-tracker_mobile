import { Redirect } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Wordmark } from "@/components/Wordmark";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/theme/ThemeContext";

function Input(props: React.ComponentProps<typeof TextInput>) {
  const { colors, fontScale } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      {...props}
      style={{
        width: "100%",
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: focused ? 2 : 1,
        borderColor: focused ? colors.accent : colors.border,
        backgroundColor: colors.surface,
        color: colors.text,
        fontSize: 15 * fontScale,
        marginBottom: 12,
      }}
    />
  );
}

export default function AuthScreen() {
  const { colors, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const { token, signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (token) return <Redirect href="/" />;

  const submit = async () => {
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password, needsTotp ? totpCode.trim() : undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed";
      if (message === "TOTP_REQUIRED") {
        setNeedsTotp(true);
        setError("Enter the 6-digit code from your authenticator app.");
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: 24,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: "center" }}>
          <Wordmark height={32} />
        </View>
        <Text
          style={{
            fontSize: 14 * fontScale,
            color: colors.muted,
            textAlign: "center",
            marginTop: 4,
            marginBottom: 32,
          }}
        >
          Sign in to your account
        </Text>

        <Input
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <Input
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={submit}
        />
        {needsTotp ? (
          <Input
            value={totpCode}
            onChangeText={setTotpCode}
            placeholder="Authenticator code"
            keyboardType="number-pad"
            maxLength={6}
            onSubmitEditing={submit}
          />
        ) : null}

        {error ? (
          <Text style={{ color: colors.destructiveRed, fontSize: 13 * fontScale, marginBottom: 12 }}>
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={submit}
          disabled={busy}
          style={{
            backgroundColor: colors.accent,
            borderRadius: 8,
            paddingVertical: 14,
            alignItems: "center",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{ color: "#FFFFFF", fontSize: 16 * fontScale, fontWeight: "600" }}>
              Sign In
            </Text>
          )}
        </Pressable>

        <View style={{ marginTop: 24 }}>
          <Text style={{ fontSize: 12 * fontScale, color: colors.muted, textAlign: "center" }}>
            Google sign-in and account creation are coming soon — for now, use the email and
            password from your Trail Tracker web account.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
