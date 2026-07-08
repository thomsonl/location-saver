import type { MapTargetId } from "../types.js";
import type { MapTarget } from "./index.js";

/**
 * Google Maps / Apple Maps target — neither exposes a write API for a user's
 * saved lists, so "sending" a place means a push notification whose tap opens
 * the place pre-resolved in that app (one more tap saves it there).
 * Every place is also kept in our own DB list regardless.
 */
export function deepLinkTarget(id: Extract<MapTargetId, "google" | "apple">): MapTarget {
  return {
    id,
    async deliver(place, user) {
      if (!user.pushToken) return; // still recorded in our list; nothing to push to

      // TODO(M1): APNs/FCM push:
      //   title: `Saved ${place.name}`
      //   body:  place.address
      //   data:  { deepLink: place.deepLink }
      console.log(`[push:${id}] ${user.userId} → ${place.name} → ${place.deepLink}`);
    },
  };
}
