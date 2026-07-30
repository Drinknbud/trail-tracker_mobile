import { router, useFocusEffect } from "expo-router";
import {
  Camera,
  Database,
  HelpCircle,
  LogOut,
  Mail,
  MessageCircle,
  MessageSquare,
  MessagesSquare,
  Repeat,
  Search,
  Settings,
  Share2,
  Tent,
  Trophy,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";

import { Card, Screen } from "@/components/Screen";
import { tripStore } from "@/db";
import { useAuth } from "@/lib/auth";
import { fetchDmThreads } from "@/lib/dms";
import { useOnTrail } from "@/lib/onTrail";
import { useTheme, type TextSize, type ThemeMode } from "@/theme/ThemeContext";

// Hub launcher (nav redesign): tile grid instead of a buried flat list, with
// the On Trail switch on top since it now drives the adaptive tab bar.

function GroupLabel({ children }: { children: string }) {
  const { colors, fontScale } = useTheme();
  return (
    <Text
      style={{
        fontSize: 11 * fontScale,
        fontWeight: "600",
        color: colors.muted,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginTop: 20,
        marginBottom: 8,
      }}
    >
      {children}
    </Text>
  );
}

function Tile({
  icon: Icon,
  label,
  note,
  badge,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  note?: string;
  badge?: number;
  onPress?: () => void;
}) {
  const { colors, fontScale } = useTheme();
  const disabled = !onPress;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        width: "31%",
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 6,
        alignItems: "center",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <View>
        <Icon color={disabled ? colors.muted : colors.accent} size={22} />
        {badge ? (
          <View
            style={{
              position: "absolute",
              top: -6,
              right: -12,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              paddingHorizontal: 4,
              backgroundColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "700" }}>
              {badge > 99 ? "99+" : badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        style={{
          fontSize: 12 * fontScale,
          fontWeight: "600",
          color: colors.text,
          marginTop: 8,
          textAlign: "center",
        }}
        numberOfLines={2}
      >
        {label}
      </Text>
      {note ? (
        <Text style={{ fontSize: 10 * fontScale, color: colors.muted, marginTop: 2 }}>{note}</Text>
      ) : null}
    </Pressable>
  );
}

function TileGrid({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{children}</View>
  );
}

function Segmented<T extends string>({
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
            key={opt.value}
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

export default function MoreScreen() {
  const { colors, fontScale, mode, setMode, textSize, setTextSize } = useTheme();
  const { signOut, token } = useAuth();
  const { onTrail, setOnTrail, requestOnTrail } = useOnTrail();
  const [mailUnread, setMailUnread] = useState(0);
  const [dmUnread, setDmUnread] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          await tripStore.init();
          const mail = await tripStore.listTrailMail();
          if (!cancelled) setMailUnread(mail.filter((m) => !m.isRead).length);
        } catch {
          // Badge is best-effort
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      let cancelled = false;
      (async () => {
        try {
          const threads = await fetchDmThreads(token);
          if (!cancelled) setDmUnread(threads.reduce((n, t) => n + t.unreadCount, 0));
        } catch {
          // Badge is best-effort — DMs are online-only, no cached fallback
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [token]),
  );

  return (
    <Screen title="More">
      {/* On Trail switch — drives the adaptive tab bar */}
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: onTrail ? `${colors.offlineAmber}22` : `${colors.accent}15`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Tent color={onTrail ? colors.offlineAmber : colors.accent} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15 * fontScale, fontWeight: "700", color: colors.text }}>
              On Trail mode
            </Text>
            <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginTop: 1 }}>
              {onTrail
                ? "Field setup: Briefing in the tab bar, auto-sync on signal"
                : "Home setup: full navigation with Trail & Community categories"}
            </Text>
          </View>
          <Switch
            value={onTrail}
            onValueChange={(v) => (v ? requestOnTrail() : setOnTrail(false))}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#FFFFFF"
          />
        </View>
      </Card>

      <GroupLabel>Trail</GroupLabel>
      <TileGrid>
        <Tile icon={Camera} label="Photos" onPress={() => router.push("/photos")} />
        <Tile icon={Trophy} label="Badges" onPress={() => router.push("/accomplishments")} />
        <Tile icon={Mail} label="Trail Mail" badge={mailUnread} onPress={() => router.push("/trail-mail")} />
        <Tile icon={Database} label="Trip Status" onPress={() => router.push("/trip-status")} />
      </TileGrid>

      <GroupLabel>Community</GroupLabel>
      <TileGrid>
        <Tile icon={Users} label="Tribes" onPress={() => router.push("/tribes")} />
        <Tile icon={MessageCircle} label="Messages" badge={dmUnread} onPress={() => router.push("/dms")} />
        <Tile icon={UserPlus} label="Trail Buddy" onPress={() => router.push("/buddy")} />
        <Tile icon={MessagesSquare} label="Forum" note="Phase 3" />
        <Tile icon={Repeat} label="Gear Swap" note="Phase 3" />
        <Tile icon={HelpCircle} label="Q&A" onPress={() => router.push("/qa")} />
        <Tile icon={Search} label="Find Hikers" note="Phase 3" />
      </TileGrid>

      <GroupLabel>App</GroupLabel>
      <TileGrid>
        <Tile icon={Settings} label="Settings" onPress={() => router.push("/settings")} />
        <Tile icon={Share2} label="Share View" note="Phase 1" />
        <Tile icon={MessageSquare} label="Feedback" note="Phase 1" />
      </TileGrid>

      <GroupLabel>Appearance</GroupLabel>
      <Card>
        <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginBottom: 8 }}>
          Theme
        </Text>
        <Segmented<ThemeMode>
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "System" },
          ]}
          value={mode}
          onChange={setMode}
        />
        <Text
          style={{ fontSize: 13 * fontScale, color: colors.muted, marginTop: 16, marginBottom: 8 }}
        >
          Text size
        </Text>
        <Segmented<TextSize>
          options={[
            { value: "standard", label: "Standard" },
            { value: "large", label: "Large" },
            { value: "xlarge", label: "X-Large" },
          ]}
          value={textSize}
          onChange={setTextSize}
        />
      </Card>

      <GroupLabel>Account</GroupLabel>
      <Card style={{ paddingVertical: 4, marginBottom: 8 }}>
        <Pressable
          onPress={() => void signOut()}
          style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 4 }}
        >
          <LogOut color={colors.destructiveRed} size={20} />
          <Text
            style={{
              flex: 1,
              fontSize: 15 * fontScale,
              color: colors.destructiveRed,
              marginLeft: 12,
              fontWeight: "500",
            }}
          >
            Sign Out
          </Text>
        </Pressable>
      </Card>
    </Screen>
  );
}
