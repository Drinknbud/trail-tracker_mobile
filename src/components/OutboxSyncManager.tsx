import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";
import { AppState } from "react-native";

import { tripStore } from "@/db";
import { useAuth } from "@/lib/auth";
import { refreshEntitlement } from "@/lib/entitlement";
import { flushOutbox } from "@/lib/outbox";
import { syncPhotos } from "@/lib/photos";
import { configurePurchases } from "@/lib/purchases";

/**
 * Invisible component mounted at the root: flushes the outbox on app
 * foreground and on connectivity regain (docs §4.3).
 */
export function OutboxSyncManager() {
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;

    let mounted = true;
    const flushAll = async () => {
      await flushOutbox(token);
      await syncPhotos(token);
      const entitlement = await refreshEntitlement(token);
      if (entitlement) await configurePurchases(entitlement.userId);
    };
    void tripStore.init().then(flushAll);

    const appStateSub = AppState.addEventListener("change", (state) => {
      if (mounted && state === "active") void flushAll();
    });
    const netInfoUnsub = NetInfo.addEventListener((state) => {
      if (mounted && state.isConnected) void flushAll();
    });

    return () => {
      mounted = false;
      appStateSub.remove();
      netInfoUnsub();
    };
  }, [token]);

  return null;
}
