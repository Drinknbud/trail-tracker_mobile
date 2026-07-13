import * as FileSystem from "expo-file-system/legacy";

/**
 * Downloads a remote image URL and re-encodes it as a base64 data URL, for
 * the avatar/hero-image endpoints (which always take a dataUrl — mirrors
 * web's AvatarPickerModal, which funnels every source, including pasted
 * URLs and existing gallery photos, through the same canvas→dataUrl path).
 */
export async function remoteUrlToDataUrl(url: string): Promise<string> {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  const dest = `${FileSystem.cacheDirectory}remote-image-${Date.now()}.${ext ?? "jpg"}`;
  const { uri } = await FileSystem.downloadAsync(url, dest);
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
  await FileSystem.deleteAsync(uri, { idempotent: true });
  return `data:${mime};base64,${base64}`;
}
