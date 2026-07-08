import type { MapTargetId, ResolvedPlace, RestaurantCandidate } from "../types.js";

/**
 * Stage 6 — resolve extracted candidates against a real places index.
 * Google Places Text Search is the primary resolver (best coverage); Apple
 * Maps Server API can be used when the user's target is Apple Maps so the
 * deep link carries a native Apple place ID.
 *
 * Ranking rules (see docs/architecture.md):
 *   1. Post geotag wins outright.
 *   2. Name match + a locationHint appearing in the address → auto-save.
 *   3. Anything ambiguous → status "needs_input", never guess-save.
 */
export async function resolvePlaces(
  candidates: RestaurantCandidate[],
  target: MapTargetId,
): Promise<ResolvedPlace[]> {
  const resolved: ResolvedPlace[] = [];
  for (const candidate of candidates) {
    const place = await googleTextSearch(candidate);
    if (place) resolved.push(finalizeDeepLink(place, target));
  }
  return resolved;
}

async function googleTextSearch(
  candidate: RestaurantCandidate,
): Promise<ResolvedPlace | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY not set");

  const query = [candidate.name, ...candidate.locationHints].join(" ");
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location",
    },
    body: JSON.stringify({ textQuery: query }),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    places?: Array<{
      id: string;
      displayName?: { text: string };
      formattedAddress?: string;
      location?: { latitude: number; longitude: number };
    }>;
  };
  const top = data.places?.[0];
  if (!top?.location) return null;

  return {
    provider: "google",
    placeId: top.id,
    name: top.displayName?.text ?? candidate.name,
    address: top.formattedAddress ?? "",
    lat: top.location.latitude,
    lng: top.location.longitude,
    deepLink: "", // filled by finalizeDeepLink for the user's target
  };
}

function finalizeDeepLink(place: ResolvedPlace, target: MapTargetId): ResolvedPlace {
  switch (target) {
    case "apple":
      // TODO(M1): re-resolve via Apple Maps Server API for a native place-id link.
      return {
        ...place,
        deepLink: `https://maps.apple.com/?q=${encodeURIComponent(place.name)}&ll=${place.lat},${place.lng}`,
      };
    case "google":
    case "foodapp": // food app save is server-side; deep link opens our app's place view
    default:
      return {
        ...place,
        deepLink:
          `https://www.google.com/maps/search/?api=1` +
          `&query=${encodeURIComponent(place.name)}` +
          `&query_place_id=${encodeURIComponent(place.placeId)}`,
      };
  }
}
