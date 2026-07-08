import type { Evidence, Platform } from "../types.js";

/**
 * Stage 2 — cheap metadata: caption, hashtags, and (when the API scope allows)
 * the creator's location tag. The location tag is the jackpot signal: when a
 * post is geotagged with the restaurant itself, we can skip every later stage.
 *
 * Sanctioned sources (see docs/platform-constraints.md §3):
 *  - TikTok:    oEmbed for public posts (title/author); Display API with user OAuth for more.
 *  - Instagram: oEmbed (app token) / Graph API.
 */
export async function fetchMetadata(
  canonicalUrl: string,
  platform: Platform,
): Promise<Evidence[]> {
  switch (platform) {
    case "tiktok":
      return fetchTikTokMetadata(canonicalUrl);
    case "instagram":
      return fetchInstagramMetadata(canonicalUrl);
    default:
      return [];
  }
}

async function fetchTikTokMetadata(url: string): Promise<Evidence[]> {
  const res = await fetch(
    `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { title?: string; author_name?: string };
  const evidence: Evidence[] = [];
  if (data.title) evidence.push({ kind: "caption", content: data.title });
  // TODO(M1): Display API with user OAuth → location tag as {kind: "geotag"}.
  return evidence;
}

async function fetchInstagramMetadata(_url: string): Promise<Evidence[]> {
  // TODO(M1): Instagram oEmbed requires a Facebook app token; Graph API for
  // location tags requires user OAuth. Wire up once the app is registered.
  return [];
}
