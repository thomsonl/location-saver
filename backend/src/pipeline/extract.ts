import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Evidence, ExtractionResult } from "../types.js";

/**
 * LLM extraction — one Claude call over all evidence gathered so far.
 * Structured output guarantees schema-valid JSON; the model never invents
 * coordinates, only names + textual location hints for the places stage.
 */

const CandidateSchema = z.object({
  name: z.string().describe("Restaurant/venue name exactly as evidenced"),
  locationHints: z
    .array(z.string())
    .describe("Streets, neighborhoods, cities, landmarks mentioned near this name"),
  confidence: z.enum(["high", "medium", "low"]),
  evidence: z.array(
    z.enum(["caption", "geotag", "ocr", "transcript", "cover_image_text"]),
  ),
});

const ExtractionSchema = z.object({
  candidates: z.array(CandidateSchema),
  videoIsAboutFood: z.boolean(),
});

const client = new Anthropic();

export async function extractCandidates(
  evidence: Evidence[],
): Promise<ExtractionResult> {
  const evidenceBlock = evidence
    .map((e) => `<evidence kind="${e.kind}">\n${e.content}\n</evidence>`)
    .join("\n");

  const response = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system:
      "You extract restaurant/venue mentions from social media video evidence. " +
      "Only report names actually present in the evidence — never guess or embellish. " +
      "A video may feature several venues (e.g. 'top 5 tacos'); report each separately. " +
      "confidence=high only when the name is unambiguous and clearly the video's subject.",
    messages: [
      {
        role: "user",
        content:
          "Extract restaurant candidates from this social media post evidence:\n\n" +
          evidenceBlock,
      },
    ],
    output_config: { format: zodOutputFormat(ExtractionSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("extraction returned no parseable output");
  }
  return response.parsed_output;
}

/** Cheap gate: is any candidate strong enough to skip more expensive stages? */
export function hasConfidentCandidate(result: ExtractionResult): boolean {
  return result.candidates.some((c) => c.confidence === "high");
}
