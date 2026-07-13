import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Camera, ImagePlus, Link2 } from "lucide-react-native";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  Text,
  View,
  type DimensionValue,
} from "react-native";

import { MyPhotosModal, UrlPromptModal } from "@/components/AvatarPicker";
import { formatHeroPosition, heroContentPosition } from "@/lib/heroPosition";
import { remoteUrlToDataUrl } from "@/lib/imageUpload";
import { uploadHeroImage } from "@/lib/webApi";
import { useTheme } from "@/theme/ThemeContext";

const PREVIEW_HEIGHT = 140;

export function HeroImagePicker({
  url,
  position,
  token,
  onChange,
}: {
  url: string;
  position: string;
  token: string | null;
  onChange: (url: string, position: string) => void;
}) {
  const { colors, fontScale } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPhotos, setShowPhotos] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const boxRef = useRef<View>(null);
  const boxLayout = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const finish = async (dataUrl: string) => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await uploadHeroImage(token, dataUrl);
      onChange(res.url, "50% 50%");
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
      aspect: [3, 1],
      quality: 0.85,
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
      aspect: [3, 1],
      quality: 0.85,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      await finish(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const applyDrag = (touchX: number, touchY: number) => {
    const { x: bx, y: by, width, height } = boxLayout.current;
    if (!width || !height) return;
    const relX = Math.max(0, Math.min(1, (touchX - bx) / width));
    const relY = Math.max(0, Math.min(1, (touchY - by) / height));
    onChange(url, formatHeroPosition(relX * 100, relY * 100));
  };

  const panResponder = useRef(
    PanResponder.create({
      // Claim the gesture on both start AND move — without the *Move*
      // variants, the parent ScrollView wins as soon as the touch starts
      // moving (a plain tap-start claim isn't enough once it becomes a
      // drag), and onPanResponderTerminationRequest keeps it from ceding
      // back mid-drag.
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => applyDrag(e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderMove: (e) => applyDrag(e.nativeEvent.pageX, e.nativeEvent.pageY),
    })
  ).current;

  return (
    <View>
      <Text style={{ fontSize: 12 * fontScale, color: colors.muted, marginBottom: 6 }}>
        Hero Image
      </Text>

      {url ? (
        <View style={{ marginBottom: 10 }}>
          <Text style={{ fontSize: 11 * fontScale, color: colors.muted, marginBottom: 4 }}>
            Drag to reposition the focal point
          </Text>
          <View
            ref={boxRef}
            onLayout={() => {
              boxRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
                boxLayout.current = { x: pageX, y: pageY, width, height };
              });
            }}
            {...panResponder.panHandlers}
            style={{ height: PREVIEW_HEIGHT, borderRadius: 8, overflow: "hidden", position: "relative" }}
          >
            <Image
              source={{ uri: url }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              contentPosition={heroContentPosition(position)}
            />
            <FocalHandle position={position} />
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
        <PickerButton icon={Camera} label="Camera" onPress={fromCamera} disabled={busy} />
        <PickerButton icon={ImagePlus} label="Library" onPress={fromLibrary} disabled={busy} />
        <PickerButton icon={Link2} label="URL" onPress={() => setShowUrl(true)} disabled={busy} />
      </View>
      <Pressable onPress={() => setShowPhotos(true)} disabled={busy}>
        <Text style={{ fontSize: 12 * fontScale, color: colors.accent, fontWeight: "600" }}>
          Or choose from My Photos
        </Text>
      </Pressable>

      {busy ? <ActivityIndicator color={colors.accent} style={{ marginTop: 8 }} /> : null}
      {error ? (
        <Text style={{ fontSize: 12 * fontScale, color: colors.destructiveRed, marginTop: 6 }}>
          {error}
        </Text>
      ) : null}

      <MyPhotosModal
        visible={showPhotos}
        token={token}
        onClose={() => setShowPhotos(false)}
        onSelect={async (photoUrl) => {
          setShowPhotos(false);
          setBusy(true);
          try {
            await finish(await remoteUrlToDataUrl(photoUrl));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't load photo");
            setBusy(false);
          }
        }}
      />
      <UrlPromptModal
        visible={showUrl}
        title="Paste hero image URL"
        onClose={() => setShowUrl(false)}
        onSubmit={async (u) => {
          setShowUrl(false);
          setBusy(true);
          try {
            await finish(await remoteUrlToDataUrl(u));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't load that URL");
            setBusy(false);
          }
        }}
      />
    </View>
  );
}

function FocalHandle({ position }: { position: string }) {
  const [xStr, yStr] = position.split(" ");
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: xStr as DimensionValue,
        top: yStr as DimensionValue,
        transform: [{ translateX: -14 }, { translateY: -14 }],
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: "#FFFFFF",
        backgroundColor: "rgba(255,255,255,0.25)",
      }}
    />
  );
}

function PickerButton({
  icon: Icon,
  label,
  onPress,
  disabled,
}: {
  icon: typeof Camera;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors, fontScale } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingVertical: 8,
      }}
    >
      <Icon color={colors.text} size={14} />
      <Text style={{ fontSize: 12 * fontScale, color: colors.text }}>{label}</Text>
    </Pressable>
  );
}
