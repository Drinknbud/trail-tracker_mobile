import { Platform } from "react-native";

import type { TripStore } from "./types";

export * from "./types";

// expo-sqlite doesn't run in the static web build; the web preview uses an
// in-memory store with identical semantics. Deferred requires keep each
// implementation out of the other platform's bundle evaluation path.
export const tripStore: TripStore =
  Platform.OS === "web"
    ? (require("./memory") as typeof import("./memory")).memoryStore
    : (require("./native") as typeof import("./native")).nativeStore;
