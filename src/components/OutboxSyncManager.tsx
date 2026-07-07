import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";
import { AppState } from "react-native";

import { tripStore } from "@/db";
import { useAuth } from "@/lib/auth";
import { flushOutbox } from "@/lib/outbox";

/**
 * Invisible component mounted at the root: flushes the outbox on app
 * foreground and on connectivity regain (docs §4.3).
 */
export function OutboxSyncManager() {
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;

    let mounted = true;
    void tripStore.init().then(() => flushOutbox(token));

    const appStateSub = AppState.addEventListener("change", (state) => {
      if (mounted && state === "active") void flushOutbox(token);
    });
    const netInfoUnsub = NetInfo.addEventListener((state) => {
      if (mounted && state.isConnected) void flushOutbox(token);
    });

    return () => {
      mounted = false;
      appStateSub.remove();
      netInfoUnsub();
    };
  }, [token]);

  return null;
}
