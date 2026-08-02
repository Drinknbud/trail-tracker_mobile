import { router } from "expo-router";
import {
  BookOpen,
  Camera,
  ChevronUp,
  HelpCircle,
  LayoutDashboard,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  MessagesSquare,
  Repeat,
  Search,
  Settings,
  Sun,
  Tent,
  Trophy,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { LayoutAnimation, Platform, Pressable, Text, UIManager, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useOnTrail } from "@/lib/onTrail";
import { useTheme } from "@/theme/ThemeContext";

// Flyout dock (nav v2): in planning mode the bar is category-first —
// Dashboard · Trail▴ · Planning▴ · Community▴ · Settings — and tapping a
// category slides a second icon row up from the bar. On Trail mode keeps the
// flat field bar (big one-tap targets, no flyouts). Dismissal: re-tap the
// category, tap another one, navigate anywhere, or flip On Trail mode.

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type CategoryKey = "trail" | "community";

interface FlyoutItem {
  icon: LucideIcon;
  label: string;
  route?: string;
  note?: string; // greyed phase note (disabled)
  /** Special item: toggles On Trail mode instead of navigating. */
  onTrailToggle?: boolean;
}

const FLYOUTS: Record<CategoryKey, FlyoutItem[]> = {
  trail: [
    { icon: BookOpen, label: "Journal", route: "/journal" },
    { icon: MapPin, label: "Map", route: "/map" },
    { icon: Camera, label: "Photos", route: "/photos" },
    { icon: Trophy, label: "Badges", route: "/accomplishments" },
    { icon: Mail, label: "Mail", route: "/trail-mail" },
    { icon: Tent, label: "On Trail", onTrailToggle: true },
  ],
  community: [
    { icon: Users, label: "Tribes", route: "/tribes" },
    { icon: MessageCircle, label: "Messages", route: "/dms" },
    { icon: UserPlus, label: "Buddy", route: "/buddy" },
    { icon: HelpCircle, label: "Q&A", route: "/qa" },
    { icon: MessagesSquare, label: "Forum", note: "Phase 3" },
    { icon: Repeat, label: "Swap", note: "Phase 3" },
    { icon: Search, label: "Hikers", note: "Phase 3" },
  ],
};

// Which tab routes light up which category when active
const CATEGORY_OF_ROUTE: Record<string, CategoryKey> = {
  journal: "trail",
  map: "trail",
};

interface TabBarState {
  index: number;
  routes: { name: string; key: string }[];
}

function animate() {
  LayoutAnimation.configureNext(LayoutAnimation.create(180, "easeInEaseOut", "opacity"));
}

export function FlyoutTabBar({ state }: { state: TabBarState }) {
  const { colors, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const { onTrail, requestOnTrail } = useOnTrail();
  const [expanded, setExpanded] = useState<CategoryKey | null>(null);

  const currentRoute = state.routes[state.index]?.name ?? "index";

  // Mode flip rebuilds the bar — never carry an open flyout across
  useEffect(() => {
    setExpanded(null);
  }, [onTrail]);

  const go = (route: string) => {
    animate();
    setExpanded(null);
    router.push(route as Parameters<typeof router.push>[0]);
  };

  const toggleCategory = (key: CategoryKey) => {
    animate();
    setExpanded((cur) => (cur === key ? null : key));
  };

  const BarItem = ({
    icon: Icon,
    label,
    active,
    caret,
    onPress,
  }: {
    icon: LucideIcon;
    label: string;
    active: boolean;
    caret?: boolean;
    onPress: () => void;
  }) => (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: "center", paddingVertical: 7 }}>
      {caret ? (
        <ChevronUp
          color={active ? colors.accent : colors.muted}
          size={10}
          style={{ marginBottom: -2, transform: [{ rotate: expanded && caret && active ? "180deg" : "0deg" }] }}
        />
      ) : (
        <View style={{ height: 8 }} />
      )}
      <Icon color={active ? colors.accent : colors.muted} size={23} />
      <Text
        style={{
          fontSize: 10 * fontScale,
          fontWeight: active ? "700" : "500",
          color: active ? colors.accent : colors.muted,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );

  const flyoutItems = expanded ? FLYOUTS[expanded] : null;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingBottom: insets.bottom,
      }}
    >
      {/* Flyout row */}
      {flyoutItems ? (
        <View
          style={{
            flexDirection: "row",
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.bg,
            paddingVertical: 6,
          }}
        >
          {flyoutItems.map((item) => {
            const disabled = !item.route && !item.onTrailToggle;
            const isToggle = item.onTrailToggle === true;
            const tint = isToggle
              ? colors.offlineAmber
              : disabled
                ? colors.muted
                : colors.accent;
            return (
              <Pressable
                key={item.label}
                disabled={disabled}
                onPress={() => {
                  if (isToggle) {
                    animate();
                    setExpanded(null);
                    requestOnTrail(); // opens the activation sheet
                  } else if (item.route) {
                    go(item.route);
                  }
                }}
                style={{ flex: 1, alignItems: "center", opacity: disabled ? 0.4 : 1, paddingVertical: 9 }}
              >
                <item.icon color={tint} size={25} />
                <Text
                  style={{
                    fontSize: 9.5 * fontScale,
                    fontWeight: "600",
                    color: disabled ? colors.muted : colors.text,
                    marginTop: 3,
                  }}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                {item.note ? (
                  <Text style={{ fontSize: 8 * fontScale, color: colors.muted }}>{item.note}</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Main row */}
      {onTrail ? (
        <View style={{ flexDirection: "row" }}>
          <BarItem icon={LayoutDashboard} label="Dashboard" active={currentRoute === "index"} onPress={() => go("/")} />
          <BarItem icon={BookOpen} label="Journal" active={currentRoute === "journal"} onPress={() => go("/journal")} />
          <BarItem icon={MapPin} label="Map" active={currentRoute === "map"} onPress={() => go("/map")} />
          <BarItem icon={Sun} label="Briefing" active={currentRoute === "briefing"} onPress={() => go("/briefing")} />
          <BarItem icon={Menu} label="More" active={currentRoute === "more"} onPress={() => go("/more")} />
        </View>
      ) : (
        <View style={{ flexDirection: "row" }}>
          <BarItem icon={LayoutDashboard} label="Dashboard" active={currentRoute === "index" && !expanded} onPress={() => go("/")} />
          <BarItem
            icon={Tent}
            label="Trail"
            caret
            active={expanded === "trail" || (!expanded && CATEGORY_OF_ROUTE[currentRoute] === "trail")}
            onPress={() => toggleCategory("trail")}
          />
          <BarItem
            icon={Users}
            label="Community"
            caret
            active={expanded === "community"}
            onPress={() => toggleCategory("community")}
          />
          <BarItem icon={Settings} label="Settings" active={false} onPress={() => go("/settings")} />
        </View>
      )}
    </View>
  );
}
