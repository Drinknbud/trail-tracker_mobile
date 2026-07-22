import Constants from "expo-constants";

// In development the Mac running Metro also runs the Next.js backend via
// `npm run dev` (package.json has no --port flag, so it's Next's default
// 3000), so derive the LAN host from Expo's hostUri. Set EXPO_PUBLIC_API_URL
// to point anywhere else (e.g. the production Vercel URL for release builds,
// or :3200 if the web app is running under Claude Code's own preview
// tooling, which starts it with `next dev --port 3200`).
function defaultBaseUrl(): string {
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return host ? `http://${host}:3000` : "http://localhost:3000";
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? defaultBaseUrl();

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      (data as { error?: string } | null)?.error ?? `Request failed (${res.status})`,
      res.status
    );
  }
  return data as T;
}
