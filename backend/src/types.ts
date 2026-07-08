/** Domain model shared across the ingest API, pipeline stages, and targets. */

export type Platform = "tiktok" | "instagram" | "youtube" | "unknown";

export type MapTargetId = "foodapp" | "google" | "apple";

export type SaveStatus =
  | "queued"
  | "extracting"
  | "resolved"
  | "needs_input" // ambiguous — user must pick from candidates
  | "failed";

/** One piece of raw signal gathered from the post. */
export interface Evidence {
  kind: "caption" | "geotag" | "ocr" | "transcript" | "cover_image_text";
  content: string;
}

/** What the LLM extraction step returns (schema enforced server-side). */
export interface RestaurantCandidate {
  name: string;
  locationHints: string[];
  confidence: "high" | "medium" | "low";
  evidence: Evidence["kind"][];
}

export interface ExtractionResult {
  candidates: RestaurantCandidate[];
  videoIsAboutFood: boolean;
}

/** A candidate resolved against a real places index. */
export interface ResolvedPlace {
  provider: "google" | "apple";
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** Deep link that opens this place in the user's target map app. */
  deepLink: string;
}

export interface ExtractionJob {
  id: string;
  userId: string;
  sourceUrl: string;
  canonicalUrl?: string;
  platform: Platform;
  status: SaveStatus;
  evidence: Evidence[];
  extraction?: ExtractionResult;
  places: ResolvedPlace[];
  createdAt: Date;
}

export interface UserPrefs {
  userId: string;
  target: MapTargetId;
  pushToken?: string;
}
