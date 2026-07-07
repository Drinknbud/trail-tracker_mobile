import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { SectionDetailRow } from "@/db";

// Default briefing time until the Settings screen (M5) makes it configurable.
const BRIEFING_HOUR = 7;
const MAX_TRIP_DAYS = 14;

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Schedule a local "your briefing is ready" notification for each morning of
 * the trip (docs F5). Called after a successful Trip Download. Fully local —
 * fires in airplane mode. Replaces any previously scheduled trip (v1 assumes
 * one active trip at a time).
 */
export async function scheduleBriefingNotifications(
  section: SectionDetailRow
): Promise<number> {
  if (Platform.OS === "web") return 0;
  if (!section.startDate || !section.endDate) return 0;

  try {
    const perms = await Notifications.requestPermissionsAsync();
    if (!perms.granted) return 0;

    await Notifications.cancelAllScheduledNotificationsAsync();

    const start = new Date(`${section.startDate.slice(0, 10)}T00:00:00`);
    const end = new Date(`${section.endDate.slice(0, 10)}T00:00:00`);
    const now = new Date();
    let scheduled = 0;

    for (let day = 0; day < MAX_TRIP_DAYS; day++) {
      const date = new Date(start);
      date.setDate(start.getDate() + day);
      if (date > end) break;
      date.setHours(BRIEFING_HOUR, 0, 0, 0);
      if (date <= now) continue;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Morning Briefing — Day ${day + 1} 🌄`,
          body: section.name,
          data: { sectionId: section.id, dayIndex: day },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
        },
      });
      scheduled++;
    }
    return scheduled;
  } catch {
    // Expo Go on Android can't schedule — works in the dev build
    return 0;
  }
}
