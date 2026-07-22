import { Check, Pencil, Star, Trash2, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/lib/auth";
import {
  deletePoiComment,
  editPoiComment,
  fetchPoiData,
  postPoiComment,
  ratePrivy,
  voteWaterSource,
  type PoiData,
} from "@/lib/webApi";
import type { PoiProperties } from "@/lib/map-data";
import { useUnits } from "@/lib/units-context";
import { useTheme } from "@/theme/ThemeContext";

// Mobile port of web's PoiPopupContent (components/PoiPopupContent.tsx) — same
// info (name/type/elevation/mile/coords), same water-flow voting, privy
// star rating, and comment thread (add/edit/delete own), keyed by the same
// osmId so mobile and web share the exact same community data. Shelters have
// no osmId (see map-data.ts SHELTER_COLLECTION) so they render info-only.

export type PoiSelection = PoiProperties & { lat: number; lon: number };

const TYPE_LABEL: Record<PoiProperties["type"], string> = {
  shelter: "Shelter",
  campsite: "Campsite",
  water: "Water Source",
  parking: "Parking",
  privy: "Privy",
};
// Matches this port's own map icon colors (see MapLayerBar.tsx / TrailMapNative.tsx),
// not web's separate lib/poi-helpers.ts palette — the two already disagree on
// parking's color on web itself; kept consistent with mobile's own icons here.
const TYPE_COLOR: Record<PoiProperties["type"], string> = {
  shelter: "#78350F",
  campsite: "#D97706",
  water: "#0EA5E9",
  parking: "#1D4ED8",
  privy: "#78716C",
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3_600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3_600)}h ago`;
  if (s < 86_400 * 7) return `${Math.floor(s / 86_400)}d ago`;
  if (s < 86_400 * 30) return `${Math.floor(s / 86_400 / 7)}w ago`;
  if (s < 86_400 * 365) return `${Math.floor(s / 86_400 / 30)}mo ago`;
  return `${Math.floor(s / 86_400 / 365)}y ago`;
}


function Stars({ value, onChange, size = 15 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange?.(n)} disabled={!onChange} hitSlop={4}>
          <Star size={size} color={n <= Math.round(value) ? "#F59E0B" : "#D1D5DB"} fill={n <= Math.round(value) ? "#F59E0B" : "none"} />
        </Pressable>
      ))}
    </View>
  );
}

export function PoiDetailSheet({ poi, onClose }: { poi: PoiSelection | null; onClose: () => void }) {
  const { colors, fontScale } = useTheme();
  const { fmtElev, fmtMileMarker } = useUnits();
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<PoiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!poi?.osmId) return;
    if (fetchedRef.current === poi.osmId) return;
    fetchedRef.current = poi.osmId;
    setLoading(true);
    setData(null);
    fetchPoiData(poi.osmId, token)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [poi?.osmId, token]);

  useEffect(() => {
    if (!poi) {
      fetchedRef.current = null;
      setShowAll(false);
      setEditId(null);
      setCommentText("");
    }
  }, [poi]);

  if (!poi) return null;

  const label = TYPE_LABEL[poi.type];
  const color = TYPE_COLOR[poi.type];
  const display = poi.name ?? label;
  const meta = { poiType: poi.type, poiName: poi.name, lat: poi.lat, lon: poi.lon };
  const shown = showAll ? (data?.comments ?? []) : (data?.comments ?? []).slice(0, 3);
  const myVote = data?.myReport?.waterVote ?? null;
  const myRating = data?.myReport?.privyRating ?? 0;

  async function refresh(action: () => Promise<PoiData>) {
    if (!token || submitting) return;
    setSubmitting(true);
    try {
      setData(await action());
    } catch {
      /* best-effort — errors don't need a dedicated toast here, retry is one tap away */
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEdit(commentId: string) {
    const text = editText.trim();
    if (!text || !token || submitting) return;
    setSubmitting(true);
    try {
      setData(await editPoiComment(token, commentId, text));
      setEditId(null);
      setEditText("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} onPress={onClose}>
        <Pressable
          style={{
            marginTop: "auto",
            maxHeight: "82%",
            backgroundColor: colors.surface,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingBottom: insets.bottom + 12,
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", padding: 16, paddingBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17 * fontScale, fontWeight: "700", color: colors.text }}>{display}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                <View style={{ backgroundColor: color + "22", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10.5 * fontScale, color, fontWeight: "600" }}>{label}</Text>
                </View>
                {poi.ele != null && (
                  <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>elev. {fmtElev(poi.ele)}</Text>
                )}
              </View>
              <Text style={{ fontSize: 10.5 * fontScale, color: colors.muted, marginTop: 3 }}>
                {poi.atMile != null ? `${fmtMileMarker(poi.atMile)} · ` : ""}
                {poi.lat.toFixed(5)}°{poi.lat >= 0 ? "N" : "S"}, {Math.abs(poi.lon).toFixed(5)}°{poi.lon >= 0 ? "E" : "W"}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <X color={colors.muted} size={20} />
            </Pressable>
          </View>

          {!poi.osmId ? (
            <Text style={{ fontSize: 11.5 * fontScale, color: colors.muted, paddingHorizontal: 16, paddingBottom: 16 }}>
              Ratings and comments aren&apos;t available for shelters yet.
            </Text>
          ) : (
            <ScrollView style={{ paddingHorizontal: 16 }}>
              {loading ? (
                <Text style={{ color: colors.muted, fontSize: 12 * fontScale, paddingVertical: 12 }}>Loading…</Text>
              ) : (
                <>
                  {/* Water status */}
                  {poi.type === "water" && (
                    <View style={{ marginBottom: 14 }}>
                      <SectionLabel colors={colors} fontScale={fontScale}>Water Status</SectionLabel>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {(["flowing", "dry"] as const).map((v) => {
                          const active = myVote === v;
                          const c = v === "flowing" ? "#0EA5E9" : "#EF4444";
                          const count = v === "flowing" ? (data?.waterVotes?.flowing ?? 0) : (data?.waterVotes?.dry ?? 0);
                          return (
                            <Pressable
                              key={v}
                              disabled={!token || submitting}
                              onPress={() => refresh(() => voteWaterSource(token!, poi.osmId!, v, meta))}
                              style={{
                                flex: 1,
                                alignItems: "center",
                                paddingVertical: 9,
                                borderRadius: 8,
                                borderWidth: 1.5,
                                borderColor: active ? c : colors.border,
                                backgroundColor: active ? c + "18" : "transparent",
                              }}
                            >
                              <Text style={{ fontSize: 12.5 * fontScale, fontWeight: active ? "700" : "500", color: active ? c : colors.text }}>
                                {v === "flowing" ? "👍 " : "👎 "}
                                {count > 0 ? `${count} ` : ""}
                                {v === "flowing" ? "Flowing" : "Dry"}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      {data?.waterVotes?.lastVoteAt ? (
                        <Text style={{ fontSize: 10.5 * fontScale, color: data.waterVotes.stale ? colors.destructiveRed : colors.muted, marginTop: 5 }}>
                          {data.waterVotes.stale ? "⚠️ Outdated · " : ""}Last reported {timeAgo(data.waterVotes.lastVoteAt)}
                        </Text>
                      ) : (
                        <Text style={{ fontSize: 10.5 * fontScale, color: colors.muted, marginTop: 5 }}>No reports yet — be the first!</Text>
                      )}
                    </View>
                  )}

                  {/* Privy rating */}
                  {poi.type === "privy" && (
                    <View style={{ marginBottom: 14 }}>
                      <SectionLabel colors={colors} fontScale={fontScale}>Cleanliness</SectionLabel>
                      {data?.privyStats ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                          <Stars value={data.privyStats.average} />
                          <Text style={{ fontSize: 11.5 * fontScale, color: colors.muted }}>
                            {data.privyStats.average.toFixed(1)} ({data.privyStats.count})
                          </Text>
                        </View>
                      ) : (
                        <Text style={{ fontSize: 11.5 * fontScale, color: colors.muted, marginBottom: 6 }}>No ratings yet</Text>
                      )}
                      {token && (
                        <View>
                          <Text style={{ fontSize: 10.5 * fontScale, color: colors.muted, marginBottom: 3 }}>
                            {myRating > 0 ? "Your rating:" : "Rate it:"}
                          </Text>
                          <Stars
                            value={myRating}
                            size={22}
                            onChange={(v) => refresh(() => ratePrivy(token, poi.osmId!, v, meta))}
                          />
                        </View>
                      )}
                    </View>
                  )}

                  {/* Comments */}
                  <SectionLabel colors={colors} fontScale={fontScale}>
                    Comments{data && data.totalComments > 0 ? ` (${data.totalComments})` : ""}
                  </SectionLabel>
                  {shown.length > 0 ? (
                    shown.map((c) => {
                      const isOwn = user?.id === c.userId;
                      const isEditing = editId === c.id;
                      return (
                        <View key={c.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                          {isEditing ? (
                            <View>
                              <TextInput
                                value={editText}
                                onChangeText={(t) => setEditText(t.slice(0, 280))}
                                multiline
                                autoFocus
                                style={{
                                  borderWidth: 1,
                                  borderColor: colors.completed,
                                  borderRadius: 6,
                                  padding: 8,
                                  fontSize: 12.5 * fontScale,
                                  color: colors.text,
                                  minHeight: 50,
                                }}
                              />
                              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 5 }}>
                                <Pressable onPress={() => { setEditId(null); setEditText(""); }} style={{ flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                                  <X size={11} color={colors.muted} />
                                  <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>Cancel</Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => saveEdit(c.id)}
                                  disabled={!editText.trim() || submitting}
                                  style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.completed, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, opacity: !editText.trim() || submitting ? 0.5 : 1 }}
                                >
                                  <Check size={11} color="#FFFFFF" />
                                  <Text style={{ fontSize: 11 * fontScale, color: "#FFFFFF", fontWeight: "600" }}>Save</Text>
                                </Pressable>
                              </View>
                            </View>
                          ) : (
                            <>
                              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
                                <Text style={{ flex: 1, fontSize: 12.5 * fontScale, color: colors.text, lineHeight: 17 }}>&quot;{c.text}&quot;</Text>
                                {isOwn && (
                                  <View style={{ flexDirection: "row", gap: 8 }}>
                                    <Pressable onPress={() => { setEditId(c.id); setEditText(c.text); }} hitSlop={6}>
                                      <Pencil size={12} color={colors.muted} />
                                    </Pressable>
                                    <Pressable onPress={() => refresh(() => deletePoiComment(token!, c.id))} hitSlop={6} disabled={submitting}>
                                      <Trash2 size={12} color={colors.muted} />
                                    </Pressable>
                                  </View>
                                )}
                              </View>
                              <Text style={{ fontSize: 10.5 * fontScale, color: colors.muted, marginTop: 2 }}>
                                — {c.userName ?? "Hiker"} · {timeAgo(c.createdAt)}
                              </Text>
                            </>
                          )}
                        </View>
                      );
                    })
                  ) : (
                    <Text style={{ fontSize: 11.5 * fontScale, color: colors.muted, marginBottom: 8 }}>No comments yet</Text>
                  )}
                  {data && data.totalComments > 3 && !showAll && (
                    <Pressable onPress={() => setShowAll(true)}>
                      <Text style={{ fontSize: 11 * fontScale, color: colors.completed, marginBottom: 8 }}>
                        + {data.totalComments - 3} more
                      </Text>
                    </Pressable>
                  )}

                  {/* Add comment */}
                  {token ? (
                    <View style={{ marginTop: 4, marginBottom: 12 }}>
                      <TextInput
                        value={commentText}
                        onChangeText={(t) => setCommentText(t.slice(0, 280))}
                        placeholder="Share conditions, tips, notes…"
                        placeholderTextColor={colors.muted}
                        multiline
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 6,
                          padding: 8,
                          fontSize: 12.5 * fontScale,
                          color: colors.text,
                          minHeight: 54,
                        }}
                      />
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                        <Text style={{ fontSize: 10.5 * fontScale, color: commentText.length > 250 ? colors.destructiveRed : colors.muted }}>
                          {commentText.length}/280
                        </Text>
                        <Pressable
                          disabled={!commentText.trim() || submitting}
                          onPress={async () => {
                            const text = commentText.trim();
                            if (!text || !token) return;
                            await refresh(() => postPoiComment(token, poi.osmId!, text, meta));
                            setCommentText("");
                          }}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 6,
                            borderRadius: 6,
                            backgroundColor: !commentText.trim() || submitting ? colors.border : colors.completed,
                          }}
                        >
                          <Text style={{ fontSize: 11.5 * fontScale, fontWeight: "600", color: !commentText.trim() || submitting ? colors.muted : "#FFFFFF" }}>
                            {submitting ? "…" : "Post"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 10.5 * fontScale, color: colors.muted, textAlign: "center", marginTop: 4, marginBottom: 12 }}>
                      Sign in to rate & comment
                    </Text>
                  )}
                </>
              )}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SectionLabel({ children, colors, fontScale }: { children: React.ReactNode; colors: { muted: string }; fontScale: number }) {
  return (
    <Text style={{ fontSize: 10 * fontScale, color: colors.muted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
      {children}
    </Text>
  );
}
