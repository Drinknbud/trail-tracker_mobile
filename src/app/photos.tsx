import { router } from "expo-router";
import { ArrowLeft, Camera, ImagePlus, RefreshCw } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";

import { Card, Screen } from "@/components/Screen";
import { tripStore, type PhotoQueueRow } from "@/db";
import { useAuth } from "@/lib/auth";
import { capturePhoto, syncPhotos } from "@/lib/photos";
import { useTheme } from "@/theme/ThemeContext";

export default function PhotosScreen() {
  const { colors, fontScale } = useTheme();
  const { token } = useAuth();
  const [photos, setPhotos] = useState<PhotoQueueRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    await tripStore.init();
    setPhotos(await tripStore.photoList());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onCapture = async (source: "camera" | "library") => {
    setNotice(null);
    try {
      const row = await capturePhoto(null, source);
      if (row) setNotice("Photo queued — uploads when you have signal.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not add photo");
    }
    await load();
  };

  const onSync = async () => {
    setBusy(true);
    try {
      const res = await syncPhotos(token);
      setNotice(res.uploaded > 0 ? `Uploaded ${res.uploaded} photo${res.uploaded === 1 ? "" : "s"}.` : "Nothing to upload.");
    } finally {
      setBusy(false);
      await load();
    }
  };

  const pending = photos.filter((p) => !p.uploaded).length;

  return (
    <Screen>
      <Pressable
        onPress={() => router.back()}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}
      >
        <ArrowLeft color={colors.accent} size={20} />
        <Text style={{ color: colors.accent, fontSize: 14 * fontScale, fontWeight: "600" }}>
          Back
        </Text>
      </Pressable>

      <Text style={{ fontSize: 24 * fontScale, fontWeight: "700", color: colors.text }}>
        Photos
      </Text>
      <Text style={{ fontSize: 13 * fontScale, color: colors.muted, marginTop: 2, marginBottom: 16 }}>
        Captured offline, geotagged, uploaded when signal returns.
      </Text>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <Pressable
          onPress={() => onCapture("camera")}
          style={{
            flex: 1, backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 12,
            alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8,
          }}
        >
          <Camera color="#FFFFFF" size={16} />
          <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 * fontScale }}>
            Camera
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onCapture("library")}
          style={{
            flex: 1, borderColor: colors.accent, borderWidth: 1, borderRadius: 8,
            paddingVertical: 12, alignItems: "center", flexDirection: "row",
            justifyContent: "center", gap: 8,
          }}
        >
          <ImagePlus color={colors.accent} size={16} />
          <Text style={{ color: colors.accent, fontWeight: "600", fontSize: 13 * fontScale }}>
            Library
          </Text>
        </Pressable>
        {pending > 0 ? (
          <Pressable
            onPress={onSync}
            disabled={busy}
            style={{
              borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12,
              alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1,
            }}
          >
            <RefreshCw color={colors.text} size={16} />
          </Pressable>
        ) : null}
      </View>

      {notice ? (
        <Text style={{ fontSize: 13 * fontScale, color: colors.offlineAmber, marginBottom: 12 }}>
          {notice}
        </Text>
      ) : null}

      {photos.length === 0 ? (
        <Card>
          <Text style={{ color: colors.muted, fontSize: 13 * fontScale }}>
            No photos yet — capture your first summit.
          </Text>
        </Card>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {photos.map((p) => (
            <View key={p.id} style={{ width: "31%" }}>
              <Image
                source={{ uri: p.uri }}
                style={{
                  width: "100%", aspectRatio: 1, borderRadius: 8,
                  borderWidth: 1, borderColor: colors.border,
                }}
              />
              <Text
                style={{
                  fontSize: 10 * fontScale,
                  color: p.error ? colors.destructiveRed : p.uploaded ? colors.completed : colors.offlineAmber,
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                {p.error ? p.error : p.uploaded ? "✓ uploaded" : "queued"}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
