import type { ExtractionJob, MapTargetId, ResolvedPlace, UserPrefs } from "../types.js";
import { foodAppTarget } from "./foodApp.js";
import { deepLinkTarget } from "./deepLink.js";

/**
 * A MapTarget receives a resolved place and delivers it to the user's chosen
 * destination. Only our own food app supports a true server-side save;
 * Google/Apple Maps are reached via a push notification carrying a deep link
 * (their saved lists have no public write API — docs/platform-constraints.md §2).
 */
export interface MapTarget {
  id: MapTargetId;
  deliver(place: ResolvedPlace, user: UserPrefs): Promise<void>;
}

const targets: Record<MapTargetId, MapTarget> = {
  foodapp: foodAppTarget,
  google: deepLinkTarget("google"),
  apple: deepLinkTarget("apple"),
};

export async function dispatchToTarget(job: ExtractionJob, user: UserPrefs): Promise<void> {
  const target = targets[user.target];
  for (const place of job.places) {
    await target.deliver(place, user);
  }
}
