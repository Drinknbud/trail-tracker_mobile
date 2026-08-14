import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";

import { tripStore, type TrailAlertRow } from "@/db";
import { useAuth } from "@/lib/auth";
import { fetchAlerts } from "@/lib/webApi";
import { useTheme } from "@/theme/ThemeContext";

// RN port of web's components/AlertBanner.tsx — local-first read (works
// offline, same as TrailMailFab), best-effort background refresh. Alerts
// aren't as time-sensitive as Trail Mail, so a refresh on mount is enough;
// no polling.

type SectionRange = { startMile: number | null; endMile: number | null };

function filterAlerts(alerts: TrailAlertRow[], sectionRanges: SectionRange[]): TrailAlertRow[] {
  // Normalize to lo/hi — southbound sections are deliberately stored with
  // startMile > endMile (see section/new.tsx's applyTrailheadSelection), so
  // comparing raw startMile/endMile against an alert's range silently drops
  // every mile-ranged alert for a SOBO section.
  const ranged = sectionRanges
    .filter(
      (s): s is { startMile: number; endMile: number } => s.startMile != null && s.endMile != null
    )
    .map((s) => ({ lo: Math.min(s.startMile, s.endMile), hi: Math.max(s.startMile, s.endMile) }));
  const hasRanged = ranged.length > 0;

  return alerts.filter((alert) => {
    const isTrailWide = alert.startMile == null || alert.endMile == null;
    if (isTrailWide) return !hasRanged;
    if (!hasRanged) return false;
    const aLo = Math.min(alert.startMile!, alert.endMile!);
    const aHi = Math.max(alert.startMile!, alert.endMile!);
    return ranged.some((s) => aLo <= s.hi && aHi >= s.lo);
  });
}

function severityKey(alert: TrailAlertRow): "danger" | "caution" | "info" {
  const cat = alert.source === "manual" ? "Caution" : alert.npsCategory ?? "Information";
  if (cat === "Park Closure" || cat === "Danger") return "danger";
  if (cat === "Caution") return "caution";
  return "info";
}

function highestSeverity(alerts: TrailAlertRow[]): "danger" | "caution" | "info" {
  if (alerts.some((a) => severityKey(a) === "danger")) return "danger";
  if (alerts.some((a) => severityKey(a) === "caution")) return "caution";
  return "info";
}

export function TrailAlertBanner({ trailKey = "at" }: { trailKey?: string }) {
  const { colors, fontScale } = useTheme();
  const { token } = useAuth();
  const [allAlerts, setAllAlerts] = useState<TrailAlertRow[]>([]);
  const [sectionRanges, setSectionRanges] = useState<SectionRange[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await tripStore.init();
      const readSectionRanges = async () => {
        const sections = await tripStore.listSections();
        if (cancelled) return sections.length;
        setSectionRanges(
          sections
            .filter((s) => s.status === "planned")
            .map((s) => ({ startMile: s.startMile, endMile: s.endMile }))
        );
        return sections.length;
      };

      await readSectionRanges();
      setAllAlerts(await tripStore.listTrailAlerts(trailKey));

      if (!token) return;
      try {
        const fresh = await fetchAlerts(token, trailKey);
        await tripStore.upsertTrailAlerts(trailKey, fresh);
        setAllAlerts(await tripStore.listTrailAlerts(trailKey));
      } catch {
        // Offline — local cache stands
      }
      // On a cold start, the host screen's own section sync (Journal/
      // Dashboard) races this component's mount and may still be empty on
      // the reads above. Poll briefly rather than assuming one retry is
      // enough — the two syncs' network round-trips aren't guaranteed to
      // finish in any particular order.
      for (let attempt = 0; attempt < 5 && !cancelled; attempt++) {
        const count = await readSectionRanges();
        if (count > 0) break;
        await new Promise((r) => setTimeout(r, 400));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trailKey, token]);

  const filtered = filterAlerts(allAlerts, sectionRanges);
  const visible = filtered.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  const sev = highestSeverity(visible);
  const SEV_COLOR = { danger: colors.destructiveRed, caution: colors.offlineAmber, info: colors.accent };
  const borderColor = SEV_COLOR[sev];

  const dismiss = (id: string) => setDismissed((s) => new Set([...s, id]));
  const toggleDetail = (id: string) =>
    setExpandedIds((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: `${borderColor}66`,
        borderWidth: 1,
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 14,
      }}
    >
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12 }}
      >
        <AlertTriangle color={SEV_COLOR[sev]} size={16} />
        <Text style={{ flex: 1, fontSize: 13 * fontScale, color: colors.text }}>
          <Text style={{ fontWeight: "700" }}>
            {visible.length} trail alert{visible.length !== 1 ? "s" : ""}
          </Text>
          <Text style={{ color: colors.muted }}> affect{visible.length === 1 ? "s" : ""} your planned sections</Text>
        </Text>
        {open ? <ChevronUp color={colors.muted} size={16} /> : <ChevronDown color={colors.muted} size={16} />}
      </Pressable>

      {open ? (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
          {visible.map((alert, i) => {
            const alertSev = severityKey(alert);
            const isExpanded = expandedIds.has(alert.id);
            const miles =
              alert.startMile != null && alert.endMile != null
                ? `Mi ${alert.startMile}–${alert.endMile}`
                : null;

            return (
              <View
                key={alert.id}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderTopWidth: i > 0 ? 1 : 0,
                  borderTopColor: colors.border,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                  <AlertTriangle color={SEV_COLOR[alertSev]} size={13} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 6 }}>
                      <Text style={{ fontSize: 13 * fontScale, fontWeight: "600", color: colors.text }}>
                        {alert.title}
                      </Text>
                      {miles ? (
                        <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>{miles}</Text>
                      ) : null}
                    </View>

                    {isExpanded ? (
                      <View style={{ marginTop: 6, gap: 4 }}>
                        {alert.affectedAreas ? (
                          <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
                            Affects: {alert.affectedAreas}
                          </Text>
                        ) : null}
                        <Text style={{ fontSize: 12 * fontScale, color: colors.text, opacity: 0.85, lineHeight: 17 }}>
                          {alert.description}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 2 }}>
                          {alert.url ? (
                            <Pressable
                              onPress={() => Linking.openURL(alert.url!)}
                              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                            >
                              <ExternalLink color={colors.accent} size={12} />
                              <Text style={{ fontSize: 11 * fontScale, color: colors.accent }}>Source</Text>
                            </Pressable>
                          ) : null}
                          {alert.expiresAt ? (
                            <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
                              Expires {new Date(alert.expiresAt).toLocaleDateString()}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ) : null}
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Pressable onPress={() => toggleDetail(alert.id)}>
                      <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
                        {isExpanded ? "Less" : "Details"}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => dismiss(alert.id)} hitSlop={6}>
                      <X color={colors.muted} size={14} />
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
