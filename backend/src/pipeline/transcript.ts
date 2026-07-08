import type { Evidence } from "../types.js";

/**
 * Stage 5 — audio transcript (the most expensive signal; runs only when the
 * cheaper stages didn't produce a confident candidate).
 *
 * Plan: extract audio track (ffmpeg), transcribe with Whisper (self-hosted
 * whisper.cpp or a hosted ASR API). Keep timestamps — "the best pasta I've
 * ever had at [0:12]" helps the extraction model tie mentions together.
 *
 * ⚠ Requires access to the media file — see docs/platform-constraints.md §3
 * for the media-access decision that gates this stage (M2).
 */
export async function transcribeVideo(_canonicalUrl: string): Promise<Evidence[]> {
  // TODO(M2): implement once the media-access strategy is chosen.
  return [];
}
