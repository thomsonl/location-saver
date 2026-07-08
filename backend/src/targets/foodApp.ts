import type { MapTarget } from "./index.js";

/**
 * Our food app — the only target with a true zero-touch save: we call our own
 * API server-to-server, then notify the user it's done.
 */
export const foodAppTarget: MapTarget = {
  id: "foodapp",
  async deliver(place, user) {
    const base = process.env.FOODAPP_API_BASE;
    if (!base) throw new Error("FOODAPP_API_BASE not set");

    const res = await fetch(`${base}/v1/users/${user.userId}/saved-places`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.FOODAPP_API_KEY}`,
      },
      body: JSON.stringify({
        name: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        externalPlaceId: place.placeId,
        source: "location-saver",
      }),
    });
    if (!res.ok) throw new Error(`food app save failed: ${res.status}`);

    // TODO(M1): push notification "Saved <name> to <FoodApp>".
  },
};
