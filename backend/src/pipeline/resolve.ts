import type { Platform } from "../types.js";

/**
 * Stage 1 — normalize the shared URL and identify the platform.
 * Share sheets often hand us short links (vm.tiktok.com/xyz) that must be
 * expanded (follow redirects, no body download) to the canonical post URL.
 */
export async function resolveUrl(
  sourceUrl: string,
): Promise<{ canonicalUrl: string; platform: Platform }> {
  const canonicalUrl = await expandShortLink(sourceUrl);
  return { canonicalUrl, platform: detectPlatform(canonicalUrl) };
}

export function detectPlatform(url: string): Platform {
  const host = safeHost(url);
  if (host.endsWith("tiktok.com")) return "tiktok";
  if (host.endsWith("instagram.com")) return "instagram";
  if (host.endsWith("youtube.com") || host === "youtu.be") return "youtube";
  return "unknown";
}

async function expandShortLink(url: string): Promise<string> {
  // Short-link domains that need redirect expansion.
  const host = safeHost(url);
  const needsExpansion = ["vm.tiktok.com", "vt.tiktok.com", "youtu.be"].includes(host);
  if (!needsExpansion) return url;

  const res = await fetch(url, { method: "HEAD", redirect: "follow" });
  return res.url || url;
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}
