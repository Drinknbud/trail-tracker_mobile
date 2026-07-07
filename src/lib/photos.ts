import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

import { tripStore, type PhotoQueueRow } from "@/db";
import { API_URL } from "./api";

/**
 * Capture (camera) or attach (library) a photo offline: persist the file
 * into app storage, geotag from EXIF when present, and queue for upload
 * (F12). Returns the queued row, or null if the user cancelled.
 */
export async function capturePhoto(
  sectionId: string | null,
  source: "camera" | "library"
): Promise<PhotoQueueRow | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: "images",
    quality: 0.8,
    exif: true,
  };

  let result: ImagePicker.ImagePickerResult;
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("Camera permission denied");
    result = await ImagePicker.launchCameraAsync(options);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(options);
  }
  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  const id = `ph_${Crypto.randomUUID()}`;

  // The picker returns a cache URI the OS may purge — copy into app storage
  // so the queue survives until signal returns (native only; web keeps the
  // blob URI for the preview session).
  let uri = asset.uri;
  if (Platform.OS !== "web" && FileSystem.documentDirectory) {
    const dir = `${FileSystem.documentDirectory}photos/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    const dest = `${dir}${id}.jpg`;
    await FileSystem.copyAsync({ from: asset.uri, to: dest });
    uri = dest;
  }

  const exif = (asset.exif ?? {}) as Record<string, unknown>;
  const lat = typeof exif.GPSLatitude === "number" ? exif.GPSLatitude : null;
  const lonRaw = typeof exif.GPSLongitude === "number" ? exif.GPSLongitude : null;
  // EXIF longitude is unsigned west-positive on some Androids; GPSLongitudeRef decides
  const lon =
    lonRaw != null && exif.GPSLongitudeRef === "W" && lonRaw > 0 ? -lonRaw : lonRaw;

  const row: PhotoQueueRow = {
    id,
    sectionId,
    uri,
    lat,
    lon,
    takenAt: new Date().toISOString(),
    uploaded: false,
    error: null,
  };
  await tripStore.init();
  await tripStore.photoEnqueue(row);
  return row;
}

/** Upload queued photos. Server dedupes by content hash, so retries are safe. */
export async function syncPhotos(token: string | null): Promise<{ uploaded: number }> {
  if (!token) return { uploaded: 0 };
  await tripStore.init();
  const pending = await tripStore.photoPending();
  let uploaded = 0;

  for (const photo of pending) {
    try {
      const form = new FormData();
      if (Platform.OS === "web") {
        const blob = await (await fetch(photo.uri)).blob();
        form.append("files", blob, `${photo.id}.jpg`);
      } else {
        form.append("files", {
          uri: photo.uri,
          name: `${photo.id}.jpg`,
          type: "image/jpeg",
        } as unknown as Blob);
      }
      if (photo.lat != null) form.append("lat", String(photo.lat));
      if (photo.lon != null) form.append("lng", String(photo.lon));
      form.append("takenAt", photo.takenAt);

      const res = await fetch(`${API_URL}/api/photos/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        results?: { ok: boolean; duplicate?: boolean; error?: string }[];
      } | null;

      if (!res.ok) {
        await tripStore.photoMarkError(photo.id, body?.error ?? `HTTP ${res.status}`);
        continue;
      }
      const result = body?.results?.[0];
      if (result?.ok || result?.duplicate) {
        await tripStore.photoMarkUploaded(photo.id);
        uploaded++;
      } else {
        await tripStore.photoMarkError(photo.id, result?.error ?? "Upload rejected");
      }
    } catch {
      // Offline — leave in queue for the next window
      break;
    }
  }
  return { uploaded };
}
