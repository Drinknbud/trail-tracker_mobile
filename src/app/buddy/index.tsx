import { router } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  MapPin,
  Plus,
  Star,
  Trash2,
  User,
  Users,
  WifiOff,
  XCircle,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, TextInput, View } from "react-native";

import { FormField } from "@/components/FormField";
import { Card, Screen } from "@/components/Screen";
import { tripStore, type SectionRow } from "@/db";
import { useAuth } from "@/lib/auth";
import {
  closeBuddyListing,
  connectToListing,
  createBuddyListing,
  deleteBuddyListing,
  fetchBuddyConnections,
  fetchBuddyListings,
  fetchMyBuddyListings,
  fetchViewerCompatProfile,
  respondToConnection,
  submitOrUpdateRating,
  type BuddyConnection,
  type BuddyConnectionsData,
  type BuddyListing,
  type ViewerCompatProfile,
} from "@/lib/buddy";
import { computeCompatibility } from "@/lib/buddy-compat";
import { fetchTrails } from "@/lib/webApi";
import { useTheme } from "@/theme/ThemeContext";

const WAKE_LABELS: Record<string, string> = {
  "early-bird": "🌅 Early Bird",
  "night-owl": "🦉 Night Owl",
  flexible: "⏰ Flexible",
};
const CAMP_LABELS: Record<string, string> = {
  tent: "⛺ Tent",
  hammock: "🌳 Hammock",
  shelter: "🏠 Shelter",
  mixed: "🔀 Mixed Camp",
};
const PACE_LABELS: Record<string, string> = {
  tortoise: "🐢 Tortoise",
  steady: "🥾 Steady",
  hare: "⚡ Hare",
};
const MUSIC_LABELS: Record<string, string> = {
  "silence-please": "🤫 Silence",
  "headphones-only": "🎧 Headphones",
  "speaker-ok": "🎵 Speaker OK",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Segmented({
  value,
  onChange,
}: {
  value: "browse" | "manage";
  onChange: (v: "browse" | "manage") => void;
}) {
  const { colors, fontScale } = useTheme();
  return (
    <View style={{ flexDirection: "row", borderRadius: 8, borderWidth: 1, borderColor: colors.border, overflow: "hidden", marginBottom: 14 }}>
      {(["browse", "manage"] as const).map((v) => {
        const active = v === value;
        return (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            style={{ flex: 1, paddingVertical: 9, alignItems: "center", backgroundColor: active ? colors.accent : "transparent" }}
          >
            <Text style={{ fontSize: 13 * fontScale, fontWeight: active ? "700" : "500", color: active ? "#FFFFFF" : colors.text }}>
              {v === "browse" ? "Browse" : "Manage"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function OfflineCard({ onRetry }: { onRetry: () => void }) {
  const { colors, fontScale } = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <WifiOff color={colors.offlineAmber} size={16} />
        <Text style={{ fontSize: 14 * fontScale, fontWeight: "600", color: colors.text }}>You&apos;re offline</Text>
      </View>
      <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginBottom: 12 }}>
        Trail Buddy needs a connection — try again once you&apos;re back in signal.
      </Text>
      <Pressable onPress={onRetry} style={{ borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingVertical: 10, alignItems: "center" }}>
        <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 * fontScale }}>Try again</Text>
      </Pressable>
    </Card>
  );
}

function ListingCard({
  listing,
  viewerProfile,
  onConnect,
}: {
  listing: BuddyListing;
  viewerProfile: ViewerCompatProfile | null;
  onConnect: (listingId: string) => Promise<void>;
}) {
  const { colors, fontScale } = useTheme();
  const [connecting, setConnecting] = useState(false);
  const [requested, setRequested] = useState(false);

  const compat = viewerProfile?.typicalDailyMiles
    ? computeCompatibility(viewerProfile, {
        startMile: listing.startMile,
        endMile: listing.endMile,
        startDate: listing.startDate,
        endDate: listing.endDate,
        miles: listing.miles,
        user: {
          typicalDailyMiles: listing.user.typicalDailyMiles,
          socialStyle: listing.user.socialStyle,
          wakeStyle: listing.user.wakeStyle,
          campStyle: listing.user.campStyle,
        },
      })
    : null;

  const pills: string[] = [];
  if (listing.user.wakeStyle && WAKE_LABELS[listing.user.wakeStyle]) pills.push(WAKE_LABELS[listing.user.wakeStyle]);
  if (listing.user.campStyle && CAMP_LABELS[listing.user.campStyle]) pills.push(CAMP_LABELS[listing.user.campStyle]);
  if (listing.user.hikePace && PACE_LABELS[listing.user.hikePace]) pills.push(PACE_LABELS[listing.user.hikePace]);
  if (listing.user.musicOnTrail && MUSIC_LABELS[listing.user.musicOnTrail]) pills.push(MUSIC_LABELS[listing.user.musicOnTrail]);
  const hobbies = listing.user.hobbies ? listing.user.hobbies.split(",").filter(Boolean) : [];

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await onConnect(listing.id);
      setRequested(true);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Card style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
        {listing.user.image ? (
          <Image source={{ uri: listing.user.image }} style={{ width: 38, height: 38, borderRadius: 19 }} />
        ) : (
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: `${colors.accent}15`, alignItems: "center", justifyContent: "center" }}>
            <User color={colors.accent} size={18} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
            <Text style={{ fontSize: 14 * fontScale, fontWeight: "700", color: colors.text }}>
              {listing.user.trailName ?? "Trail Hiker"}
            </Text>
            {listing.user.buddyAgeRange ? (
              <Text style={{ fontSize: 10 * fontScale, color: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
                {listing.user.buddyAgeRange}
              </Text>
            ) : null}
            {compat != null ? (
              <Text style={{ fontSize: 10 * fontScale, fontWeight: "700", color: colors.accent, backgroundColor: `${colors.accent}15`, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
                {compat}% match
              </Text>
            ) : null}
          </View>
          {listing.avgRating != null && listing.ratingCount > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
              <Star color="#FBBF24" fill="#FBBF24" size={11} />
              <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
                {listing.avgRating.toFixed(1)} ({listing.ratingCount})
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
        {listing.startMile != null && listing.endMile != null ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <MapPin color={colors.muted} size={12} />
            <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
              Miles {listing.startMile}–{listing.endMile}
            </Text>
          </View>
        ) : listing.miles != null ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <MapPin color={colors.muted} size={12} />
            <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>{listing.miles} mi</Text>
          </View>
        ) : null}
        {listing.startDate || listing.endDate ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Calendar color={colors.muted} size={12} />
            <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
              {listing.startDate && listing.endDate
                ? `${formatDate(listing.startDate)} – ${formatDate(listing.endDate)}`
                : listing.startDate
                  ? `From ${formatDate(listing.startDate)}`
                  : `Until ${formatDate(listing.endDate!)}`}
            </Text>
          </View>
        ) : null}
        {listing.maxBuddies > 1 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Users color={colors.muted} size={12} />
            <Text style={{ fontSize: 11 * fontScale, color: colors.muted }}>
              {listing.connectionCount}/{listing.maxBuddies} buddies
            </Text>
          </View>
        ) : null}
      </View>

      {listing.message ? (
        <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginBottom: 8, fontStyle: "italic" }} numberOfLines={2}>
          &ldquo;{listing.message}&rdquo;
        </Text>
      ) : null}

      {pills.length > 0 || hobbies.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {pills.slice(0, 4).map((p) => (
            <Text key={p} style={{ fontSize: 10 * fontScale, color: colors.muted, backgroundColor: colors.border, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
              {p}
            </Text>
          ))}
          {hobbies.slice(0, 3).map((h) => (
            <Text key={h} style={{ fontSize: 10 * fontScale, color: "#60A5FA", backgroundColor: "#3B82F615", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
              {h}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
        {requested ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <CheckCircle2 color={colors.accent} size={16} />
            <Text style={{ fontSize: 13 * fontScale, color: colors.accent, fontWeight: "600" }}>Request sent!</Text>
          </View>
        ) : (
          <Pressable
            onPress={() => void handleConnect()}
            disabled={connecting || listing.status !== "open"}
            style={{
              alignSelf: "flex-start",
              backgroundColor: colors.accent,
              borderRadius: 8,
              paddingVertical: 8,
              paddingHorizontal: 16,
              opacity: connecting || listing.status !== "open" ? 0.5 : 1,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 * fontScale }}>
              {listing.status !== "open" ? "Listing closed" : connecting ? "Connecting…" : "Connect →"}
            </Text>
          </Pressable>
        )}
      </View>
    </Card>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginVertical: 10 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)}>
          <Star color="#FBBF24" fill={n <= value ? "#FBBF24" : "transparent"} size={26} />
        </Pressable>
      ))}
    </View>
  );
}

export default function TrailBuddyScreen() {
  const { colors, fontScale } = useTheme();
  const { token, user } = useAuth();

  const [tab, setTab] = useState<"browse" | "manage">("browse");
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [listings, setListings] = useState<BuddyListing[]>([]);
  const [viewerProfile, setViewerProfile] = useState<ViewerCompatProfile | null>(null);

  const [myListings, setMyListings] = useState<BuddyListing[]>([]);
  const [connections, setConnections] = useState<BuddyConnectionsData>({ incoming: [], outgoing: [] });
  const [manageLoading, setManageLoading] = useState(false);

  const [showPost, setShowPost] = useState(false);
  const [mySections, setMySections] = useState<SectionRow[]>([]);
  const [trailKey, setTrailKey] = useState("");
  const [startMile, setStartMile] = useState("");
  const [endMile, setEndMile] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [message, setMessage] = useState("");
  const [maxBuddies, setMaxBuddies] = useState(1);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const [ratingFor, setRatingFor] = useState<BuddyConnection | null>(null);
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingReview, setRatingReview] = useState("");
  const [ratingBusy, setRatingBusy] = useState(false);

  const loadBrowse = useCallback(async () => {
    if (!token) return;
    try {
      const [listingsRes, profile] = await Promise.all([
        fetchBuddyListings(token),
        fetchViewerCompatProfile(token),
      ]);
      setListings(listingsRes);
      setViewerProfile(profile);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadManage = useCallback(async () => {
    if (!token) return;
    setManageLoading(true);
    try {
      const [mine, conns] = await Promise.all([fetchMyBuddyListings(token), fetchBuddyConnections(token)]);
      setMyListings(mine);
      setConnections(conns);
    } catch {
      // best-effort; browse tab already surfaces the offline wall
    } finally {
      setManageLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadBrowse();
  }, [loadBrowse]);

  useEffect(() => {
    if (tab === "manage") void loadManage();
  }, [tab, loadManage]);

  useEffect(() => {
    if (!showPost || !token) return;
    (async () => {
      try {
        await tripStore.init();
        const sections = await tripStore.listSections();
        setMySections(sections.filter((s) => s.miles > 0));
        const trails = await fetchTrails(token);
        const active = trails.find((t) => t.isActive) ?? trails[0] ?? null;
        if (active) setTrailKey(active.catalogKey);
      } catch {
        // manual entry still works without this
      }
    })();
  }, [showPost, token]);

  const pickSection = (s: SectionRow) => {
    setStartMile(s.startMile != null ? String(s.startMile) : "");
    setEndMile(s.endMile != null ? String(s.endMile) : "");
    setStartDate(s.startDate?.slice(0, 10) ?? "");
    setEndDate(s.endDate?.slice(0, 10) ?? "");
  };

  const handlePost = async () => {
    if (!token || !trailKey.trim() || posting) return;
    setPosting(true);
    setPostError(null);
    try {
      await createBuddyListing(token, {
        trailKey: trailKey.trim().toLowerCase(),
        startMile: startMile ? parseFloat(startMile) : undefined,
        endMile: endMile ? parseFloat(endMile) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        message: message.trim() || undefined,
        maxBuddies,
      });
      setShowPost(false);
      setStartMile("");
      setEndMile("");
      setStartDate("");
      setEndDate("");
      setMessage("");
      setMaxBuddies(1);
      await loadBrowse();
    } catch (e) {
      setPostError(e instanceof Error ? e.message : "Couldn't post listing");
    } finally {
      setPosting(false);
    }
  };

  const handleConnect = async (listingId: string) => {
    if (!token) return;
    await connectToListing(token, listingId);
  };

  const handleAcceptDecline = async (connectionId: string, status: "accepted" | "declined") => {
    if (!token) return;
    await respondToConnection(token, connectionId, status);
    await loadManage();
  };

  const handleCloseListing = async (listingId: string) => {
    if (!token) return;
    await closeBuddyListing(token, listingId);
    await loadManage();
  };

  const handleDeleteListing = async (listingId: string) => {
    if (!token) return;
    await deleteBuddyListing(token, listingId);
    await loadManage();
  };

  const openRating = (conn: BuddyConnection) => {
    setRatingFor(conn);
    setRatingScore(conn.existingRating?.score ?? 0);
    setRatingReview(conn.existingRating?.review ?? "");
  };

  const submitRatingForm = async () => {
    if (!token || !ratingFor || ratingScore === 0 || ratingBusy) return;
    setRatingBusy(true);
    try {
      await submitOrUpdateRating(token, ratingFor.toUserId, ratingScore, ratingReview);
      setRatingFor(null);
      await loadManage();
    } catch {
      // form stays open so the user can retry
    } finally {
      setRatingBusy(false);
    }
  };

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <ArrowLeft color={colors.accent} size={20} />
        <Text style={{ color: colors.accent, fontSize: 14 * fontScale, fontWeight: "600" }}>Back</Text>
      </Pressable>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <View>
          <Text style={{ fontSize: 24 * fontScale, fontWeight: "700", color: colors.text }}>Trail Buddy</Text>
          <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginTop: 1 }}>
            Find a hiking partner for your miles and dates
          </Text>
        </View>
        <Pressable
          onPress={() => setShowPost((v) => !v)}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.accent }}
        >
          <Plus color="#FFFFFF" size={16} />
          <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 12 * fontScale }}>Post</Text>
        </Pressable>
      </View>

      {showPost ? (
        <Card style={{ marginBottom: 14 }}>
          {mySections.length > 0 ? (
            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginBottom: 6 }}>Fill from a planned section</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {mySections.slice(0, 6).map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => pickSection(s)}
                    style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}
                  >
                    <Text style={{ fontSize: 11 * fontScale, color: colors.text }} numberOfLines={1}>
                      {s.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <FormField
            label="Trail key"
            value={trailKey}
            onChangeText={(v) => setTrailKey(v.toLowerCase())}
            placeholder="e.g. at, pct, cdt"
            autoCapitalize="none"
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <FormField label="Start mile" value={startMile} onChangeText={setStartMile} placeholder="100" keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <FormField label="End mile" value={endMile} onChangeText={setEndMile} placeholder="150" keyboardType="numeric" />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <FormField label="Start date" value={startDate} onChangeText={setStartDate} placeholder="2026-07-10" />
            </View>
            <View style={{ flex: 1 }}>
              <FormField label="End date" value={endDate} onChangeText={setEndDate} placeholder="2026-07-12" />
            </View>
          </View>
          <FormField
            label="Tell potential buddies about yourself (optional)"
            value={message}
            onChangeText={setMessage}
            placeholder="Steady pace, love sunrise starts…"
            multiline
            maxLength={500}
          />

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={{ fontSize: 12 * fontScale, color: colors.muted }}>Buddies wanted</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Pressable onPress={() => setMaxBuddies((n) => Math.max(1, n - 1))}>
                <Text style={{ fontSize: 18 * fontScale, color: colors.accent, fontWeight: "700" }}>−</Text>
              </Pressable>
              <Text style={{ fontSize: 14 * fontScale, color: colors.text, fontWeight: "600" }}>{maxBuddies}</Text>
              <Pressable onPress={() => setMaxBuddies((n) => Math.min(10, n + 1))}>
                <Text style={{ fontSize: 18 * fontScale, color: colors.accent, fontWeight: "700" }}>+</Text>
              </Pressable>
            </View>
          </View>

          {postError ? (
            <Text style={{ fontSize: 12 * fontScale, color: colors.destructiveRed, marginBottom: 8 }}>{postError}</Text>
          ) : null}

          <Pressable
            onPress={() => void handlePost()}
            disabled={!trailKey.trim() || posting}
            style={{ backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 10, alignItems: "center", opacity: !trailKey.trim() || posting ? 0.5 : 1 }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14 * fontScale }}>
              {posting ? "Posting…" : "Post Listing"}
            </Text>
          </Pressable>
        </Card>
      ) : null}

      <Segmented value={tab} onChange={setTab} />

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : offline ? (
        <OfflineCard
          onRetry={() => {
            setLoading(true);
            void loadBrowse();
          }}
        />
      ) : tab === "browse" ? (
        listings.length === 0 ? (
          <Card>
            <Text style={{ fontSize: 14 * fontScale, fontWeight: "600", color: colors.text }}>No open listings</Text>
            <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginTop: 4 }}>
              Be the first to post one for your section.
            </Text>
          </Card>
        ) : (
          listings.map((l) => (
            <ListingCard key={l.id} listing={l} viewerProfile={viewerProfile} onConnect={handleConnect} />
          ))
        )
      ) : manageLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <>
          {connections.incoming.filter((c) => c.status === "pending").length > 0 ? (
            <>
              <Text style={{ fontSize: 13 * fontScale, fontWeight: "700", color: colors.text, marginBottom: 8 }}>
                Requests to join your listings
              </Text>
              {connections.incoming
                .filter((c) => c.status === "pending")
                .map((c) => (
                  <Card key={c.id} style={{ marginBottom: 8 }}>
                    <Text style={{ fontSize: 13 * fontScale, color: colors.text, marginBottom: 8 }}>
                      <Text style={{ fontWeight: "700" }}>{c.fromUser?.trailName ?? "A hiker"}</Text> wants to join
                    </Text>
                    {c.message ? (
                      <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginBottom: 8, fontStyle: "italic" }}>
                        &ldquo;{c.message}&rdquo;
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Pressable
                        onPress={() => void handleAcceptDecline(c.id, "accepted")}
                        style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 8, alignItems: "center" }}
                      >
                        <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 12 * fontScale }}>Accept</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void handleAcceptDecline(c.id, "declined")}
                        style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 8, alignItems: "center" }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "600", fontSize: 12 * fontScale }}>Decline</Text>
                      </Pressable>
                    </View>
                  </Card>
                ))}
            </>
          ) : null}

          {connections.outgoing.length > 0 ? (
            <>
              <Text style={{ fontSize: 13 * fontScale, fontWeight: "700", color: colors.text, marginTop: 8, marginBottom: 8 }}>
                Your requests
              </Text>
              {connections.outgoing.map((c) => (
                <Card key={c.id} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 13 * fontScale, color: colors.text }}>
                      <Text style={{ fontWeight: "700" }}>{c.toUser?.trailName ?? "Hiker"}</Text>
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      {c.status === "accepted" ? (
                        <CheckCircle2 color={colors.accent} size={14} />
                      ) : c.status === "declined" ? (
                        <XCircle color={colors.destructiveRed} size={14} />
                      ) : null}
                      <Text style={{ fontSize: 11 * fontScale, color: colors.muted, textTransform: "capitalize" }}>
                        {c.status}
                      </Text>
                    </View>
                  </View>
                  {c.status === "accepted" ? (
                    <Pressable onPress={() => openRating(c)} style={{ marginTop: 8 }}>
                      <Text style={{ fontSize: 12 * fontScale, color: colors.accent, fontWeight: "600" }}>
                        {c.existingRating ? "Update rating" : "Rate this hiker"}
                      </Text>
                    </Pressable>
                  ) : null}

                  {ratingFor?.id === c.id ? (
                    <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
                      <StarPicker value={ratingScore} onChange={setRatingScore} />
                      <TextInput
                        value={ratingReview}
                        onChangeText={setRatingReview}
                        placeholder="How was hiking with them? (optional)"
                        placeholderTextColor={colors.muted}
                        multiline
                        maxLength={280}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 8,
                          padding: 10,
                          fontSize: 13 * fontScale,
                          color: colors.text,
                          backgroundColor: colors.bg,
                          marginBottom: 10,
                          minHeight: 60,
                        }}
                      />
                      <Pressable
                        onPress={() => void submitRatingForm()}
                        disabled={ratingScore === 0 || ratingBusy}
                        style={{ backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 9, alignItems: "center", opacity: ratingScore === 0 || ratingBusy ? 0.5 : 1 }}
                      >
                        <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 * fontScale }}>
                          {ratingBusy ? "Saving…" : "Save rating"}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </Card>
              ))}
            </>
          ) : null}

          <Text style={{ fontSize: 13 * fontScale, fontWeight: "700", color: colors.text, marginTop: 8, marginBottom: 8 }}>
            Your listings
          </Text>
          {myListings.length === 0 ? (
            <Card>
              <Text style={{ fontSize: 13 * fontScale, color: colors.muted }}>You haven&apos;t posted a listing yet.</Text>
            </Card>
          ) : (
            myListings.map((l) => (
              <Card key={l.id} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13 * fontScale, fontWeight: "700", color: colors.text }}>
                      {l.trailKey.toUpperCase()}
                      {l.startMile != null && l.endMile != null ? ` · mi ${l.startMile}–${l.endMile}` : ""}
                    </Text>
                    <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginTop: 1 }}>
                      {l.status === "open" ? "Open" : "Closed"} · {l.connectionCount}/{l.maxBuddies} buddies
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 14 }}>
                    {l.status === "open" ? (
                      <Pressable onPress={() => void handleCloseListing(l.id)}>
                        <Text style={{ fontSize: 12 * fontScale, color: colors.muted }}>Close</Text>
                      </Pressable>
                    ) : null}
                    <Pressable onPress={() => void handleDeleteListing(l.id)}>
                      <Trash2 color={colors.destructiveRed} size={16} />
                    </Pressable>
                  </View>
                </View>
              </Card>
            ))
          )}
        </>
      )}
    </Screen>
  );
}
