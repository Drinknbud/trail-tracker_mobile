import { useCallback, useEffect, useState } from "react";

import { useAuth } from "./auth";
import {
  entitlementIsPremium,
  getCachedEntitlement,
  refreshEntitlement,
} from "./entitlement";

/**
 * Premium gate hook: answers instantly from the cached entitlement (offline-
 * safe), refreshes from the server in the background when online.
 */
export function usePremium(): { isPremium: boolean; isLoading: boolean; refresh: () => Promise<void> } {
  const { token } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const cached = await getCachedEntitlement();
    setIsPremium(entitlementIsPremium(cached));
    setIsLoading(false);
    const fresh = await refreshEntitlement(token);
    setIsPremium(entitlementIsPremium(fresh));
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { isPremium, isLoading, refresh };
}
