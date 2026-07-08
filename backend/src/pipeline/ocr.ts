import type { Evidence } from "../types.js";

/**
 * Stage 4 — on-screen text. Food videos overlay the restaurant name as
 * burned-in text more often than the creator says it aloud, so OCR frequently
 * beats the transcript at a fraction of the cost.
 *
 * Plan: sample ~1 frame every 2s (ffmpeg), OCR each frame (Cloud Vision /
 * Tesseract), dedupe consecutive identical strings.
 *
 * ⚠ Requires access to the video file — see docs/platform-constraints.md §3
 * for the media-access decision that gates this stage (M2).
 */
export async function ocrVideo(_canonicalUrl: string): Promise<Evidence[]> {
  // TODO(M2): implement once the media-access strategy is chosen.
  return [];
}
