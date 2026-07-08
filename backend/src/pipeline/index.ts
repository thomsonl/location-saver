import type { ExtractionJob, UserPrefs } from "../types.js";
import { resolveUrl } from "./resolve.js";
import { fetchMetadata } from "./metadata.js";
import { ocrVideo } from "./ocr.js";
import { transcribeVideo } from "./transcript.js";
import { extractCandidates, hasConfidentCandidate } from "./extract.js";
import { resolvePlaces } from "./places.js";
import { dispatchToTarget } from "../targets/index.js";

/**
 * The signal ladder: run cheap stages first, stop as soon as extraction is
 * confident, and only then pay for OCR/ASR. See docs/architecture.md.
 *
 * M0 runs this in-process; production moves it behind a queue (BullMQ) so the
 * ingest API can ack in milliseconds and stages can retry independently.
 */
export async function runPipeline(job: ExtractionJob, user: UserPrefs): Promise<ExtractionJob> {
  job.status = "extracting";

  const { canonicalUrl, platform } = await resolveUrl(job.sourceUrl);
  job.canonicalUrl = canonicalUrl;
  job.platform = platform;

  // Rung 1: caption + geotag (cheap, sanctioned APIs)
  job.evidence.push(...(await fetchMetadata(canonicalUrl, platform)));

  // A geotag is authoritative — resolve directly without the LLM.
  const geotag = job.evidence.find((e) => e.kind === "geotag");
  if (!geotag && job.evidence.length > 0) {
    job.extraction = await extractCandidates(job.evidence);
  }

  // Rung 2: OCR of on-screen text (gated on media access — see docs)
  if (!geotag && !confident(job)) {
    job.evidence.push(...(await ocrVideo(canonicalUrl)));
    if (job.evidence.length > 0) job.extraction = await extractCandidates(job.evidence);
  }

  // Rung 3: audio transcript (most expensive, last resort)
  if (!geotag && !confident(job)) {
    job.evidence.push(...(await transcribeVideo(canonicalUrl)));
    if (job.evidence.length > 0) job.extraction = await extractCandidates(job.evidence);
  }

  // Resolve candidates → real places
  const candidates = geotag
    ? [{ name: geotag.content, locationHints: [], confidence: "high" as const, evidence: ["geotag" as const] }]
    : (job.extraction?.candidates ?? []);

  if (candidates.length === 0) {
    job.status = "failed";
    return job;
  }

  job.places = await resolvePlaces(candidates, user.target);

  if (job.places.length === 0) {
    job.status = "failed";
  } else if (job.places.length === 1 && confident(job)) {
    job.status = "resolved";
    await dispatchToTarget(job, user);
  } else {
    // Multiple plausible places or low confidence — never guess-save.
    job.status = "needs_input";
    // TODO(M1): push disambiguation notification instead of silent resolve.
  }

  return job;
}

function confident(job: ExtractionJob): boolean {
  return job.extraction ? hasConfidentCandidate(job.extraction) : false;
}
