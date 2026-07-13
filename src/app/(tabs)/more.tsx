import { router } from "expo-router";
import {
  Bot,
  Camera,
  ChevronRight,
  Database,
  HelpCircle,
  LogOut,
  Navigation,
  Mail,
  MessageSquare,
  MessagesSquare,
  Repeat,
  Search,
  Settings,
  Share2,
  Trophy,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { Card, Screen } from "@/components/Screen";
import { useAuth } from "@/lib/auth";
import { useTheme, type TextSize, type ThemeMode } from "@/theme/ThemeContext";

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

function Row({
  icon: Icon,
  label,
  note,
  last = false,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  note?: string;
  last?: boolean;
  onPress?: () => void;
}) {
  const { colors, fontScale } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 4,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <Icon color={colors.accent} size={20} />
      <Text style={{ flex: 1, fontSize: 15 * fontScale, color: colors.text, marginLeft: 12 }}>
        {label}
      </Text>
      {note ? (
        <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginRight: 6 }}>
          {note}
        </Text>
      ) : null}
      <ChevronRight color={colors.muted} size={16} />
    </Pressable>
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
  const { signOut } = useAuth();
  return (
    <Screen title="More">
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

      <GroupLabel>Trail</GroupLabel>
      <Card style={{ paddingVertical: 4 }}>
        <Row icon={Navigation} label="GPS Tracking" onPress={() => router.push("/gps")} />
        <Row icon={Camera} label="Photos" onPress={() => router.push("/photos")} />
        <Row icon={Trophy} label="Accomplishments" note="Phase 2" />
        <Row icon={Mail} label="Trail Mail" onPress={() => router.push("/trail-mail")} last />
      </Card>

      <GroupLabel>Trip Planning</GroupLabel>
      <Card style={{ paddingVertical: 4 }}>
        <Row icon={Bot} label="Planner" note="Phase 2" />
        <Row icon={UtensilsCrossed} label="Meals" note="Phase 4" last />
      </Card>

      <GroupLabel>Community</GroupLabel>
      <Card style={{ paddingVertical: 4 }}>
        <Row icon={Users} label="Tribes" note="Phase 3" />
        <Row icon={MessagesSquare} label="Forum" note="Phase 3" />
        <Row icon={Repeat} label="Gear Swap" note="Phase 3" />
        <Row icon={HelpCircle} label="Q&A" note="Phase 3" />
        <Row icon={Search} label="Find Hikers" note="Phase 3" last />
      </Card>

      <GroupLabel>App</GroupLabel>
      <Card style={{ paddingVertical: 4 }}>
        <Row icon={Database} label="Trip Status" onPress={() => router.push("/trip-status")} />
        <Row icon={Settings} label="Settings" onPress={() => router.push("/settings")} />
        <Row icon={Share2} label="Share View" note="Phase 1" />
        <Row icon={MessageSquare} label="Feedback" note="Phase 1" last />
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
