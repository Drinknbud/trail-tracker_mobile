import * as ImagePicker from "expo-image-picker";
import { Camera, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { remoteUrlToDataUrl } from "@/lib/imageUpload";
import { fetchMyPhotos, uploadAvatar, type MyPhoto } from "@/lib/webApi";
import { useTheme } from "@/theme/ThemeContext";

export function AvatarPicker({
  imageUrl,
  token,
  onUploaded,
}: {
  imageUrl: string | null;
  token: string | null;
  onUploaded: (url: string) => void;
}) {
  const { colors, fontScale } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPhotos, setShowPhotos] = useState(false);
  const [showUrl, setShowUrl] = useState(false);

  const finish = async (dataUrl: string) => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await uploadAvatar(token, dataUrl);
      onUploaded(res.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const fromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError("Camera permission denied");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      await finish(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const fromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      await finish(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const choose = () => {
    Alert.alert("Choose Avatar", undefined, [
      { text: "Take Photo", onPress: fromCamera },
      { text: "Choose from Library", onPress: fromLibrary },
      { text: "My Photos", onPress: () => setShowPhotos(true) },
      { text: "Paste URL", onPress: () => setShowUrl(true) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: colors.border }}
          />
        ) : (
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Camera color={colors.muted} size={22} />
          </View>
        )}
        <Pressable
          onPress={choose}
          disabled={busy}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Camera color={colors.text} size={14} />
          )}
          <Text style={{ fontSize: 13 * fontScale, color: colors.text }}>
            {imageUrl ? "Change" : "Choose Photo"}
          </Text>
        </Pressable>
      </View>
      {error ? (
        <Text style={{ fontSize: 12 * fontScale, color: colors.destructiveRed, marginTop: 6 }}>
          {error}
        </Text>
      ) : null}

      <MyPhotosModal
        visible={showPhotos}
        token={token}
        onClose={() => setShowPhotos(false)}
        onSelect={async (url) => {
          setShowPhotos(false);
          setBusy(true);
          try {
            await finish(await remoteUrlToDataUrl(url));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't load photo");
            setBusy(false);
          }
        }}
      />

      <UrlPromptModal
        visible={showUrl}
        title="Paste avatar image URL"
        onClose={() => setShowUrl(false)}
        onSubmit={async (url) => {
          setShowUrl(false);
          setBusy(true);
          try {
            await finish(await remoteUrlToDataUrl(url));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't load that URL");
            setBusy(false);
          }
        }}
      />
    </View>
  );
}

export function MyPhotosModal({
  visible,
  token,
  onClose,
  onSelect,
}: {
  visible: boolean;
  token: string | null;
  onClose: () => void;
  onSelect: (url: string) => void;
}) {
  const { colors, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<MyPhoto[] | null>(null);

  useEffect(() => {
    if (!visible || !token) return;
    setPhotos(null);
    fetchMyPhotos(token)
      .then(setPhotos)
      .catch(() => setPhotos([]));
  }, [visible, token]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} onPress={onClose}>
        <Pressable
          style={{
            marginTop: "auto",
            maxHeight: "70%",
            backgroundColor: colors.surface,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingBottom: insets.bottom + 12,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={{ flex: 1, fontSize: 15 * fontScale, fontWeight: "700", color: colors.text }}>
              My Photos
            </Text>
            <Pressable onPress={onClose}>
              <X color={colors.muted} size={20} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 12 }}>
            {photos === null ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
            ) : photos.length === 0 ? (
              <Text style={{ fontSize: 13 * fontScale, color: colors.muted, textAlign: "center", padding: 20 }}>
                No photos yet. Capture some from the Trail Journal first.
              </Text>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {photos.map((p) => (
                  <Pressable key={p.id} onPress={() => onSelect(p.storageUrl || p.baseUrl)}>
                    <Image
                      source={{ uri: p.thumbnailUrl }}
                      style={{ width: 80, height: 80, borderRadius: 8 }}
                    />
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function UrlPromptModal({
  visible,
  title,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (url: string) => void;
}) {
  const { colors, fontScale } = useTheme();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (visible) setValue("");
  }, [visible]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <View style={{ width: "100%", backgroundColor: colors.surface, borderRadius: 12, padding: 16 }}>
          <Text style={{ fontSize: 14 * fontScale, fontWeight: "700", color: colors.text, marginBottom: 10 }}>
            {title}
          </Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="https://..."
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoFocus
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: colors.text,
              fontSize: 14 * fontScale,
              marginBottom: 12,
            }}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={onClose} style={{ flex: 1, paddingVertical: 10, alignItems: "center" }}>
              <Text style={{ color: colors.muted, fontSize: 13 * fontScale }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => value.trim() && onSubmit(value.trim())}
              disabled={!value.trim()}
              style={{
                flex: 1,
                backgroundColor: colors.accent,
                borderRadius: 8,
                paddingVertical: 10,
                alignItems: "center",
                opacity: value.trim() ? 1 : 0.5,
              }}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 * fontScale }}>Use</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
