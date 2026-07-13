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
    let inFlight = false;
    const flushAll = async () => {
      // Both listeners can re-fire while already connected/foregrounded
      // (react-native-web's NetInfo shim especially) — without this guard
      // a flaky trail connection turns into a request storm against the
      // exact battery/data budget this sync exists to protect.
      if (inFlight) return;
      inFlight = true;
      try {
        await flushOutbox(token);
        await syncPhotos(token);
        const entitlement = await refreshEntitlement(token);
        if (entitlement) await configurePurchases(entitlement.userId);
      } finally {
        inFlight = false;
      }
    };
    void tripStore.init().then(flushAll);

    let wasActive = AppState.currentState === "active";
    const appStateSub = AppState.addEventListener("change", (state) => {
      const becameActive = state === "active" && !wasActive;
      wasActive = state === "active";
      if (mounted && becameActive) void flushAll();
    });

    let wasConnected = true;
    const netInfoUnsub = NetInfo.addEventListener((state) => {
      const becameConnected = !!state.isConnected && !wasConnected;
      wasConnected = !!state.isConnected;
      if (mounted && becameConnected) void flushAll();
    });

    return () => {
      mounted = false;
      appStateSub.remove();
      netInfoUnsub();
    };
  }, [token]);

  return null;
}
