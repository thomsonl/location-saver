# Architecture

## Components

| Component | Tech | Responsibility |
|---|---|---|
| Share entry points | iOS Share Extension (Swift), Android `ACTION_SEND` activity (Kotlin) | Receive the shared post URL, POST it to the ingest API, dismiss immediately |
| Ingest API | Fastify (TypeScript) | Accept `{url, userId}`, enqueue an extraction job, return `202 {jobId}` |
| Extraction pipeline | Worker consuming a queue (BullMQ/Redis in prod; in-process for M0) | Run the signal ladder, produce resolved place(s) |
| Place resolution | Google Places Text Search / Apple Maps Server API | Turn "Joe's Pizza, Brooklyn" into a canonical place with ID + coordinates |
| Target dispatch | `MapTarget` adapters | Save to food app / build deep links, then push-notify the user |
| Storage | Postgres | users, target preference, saves (job status + resolved places), extraction evidence |

## Pipeline: the signal ladder

Each stage appends `Evidence` to the job. After each stage the orchestrator
asks: *do we already have a high-confidence place?* If yes, skip the remaining
(more expensive) stages.

```
resolve(url)          normalize short links (vm.tiktok.com → canonical), detect platform + post ID
  └─ metadata(post)   caption, hashtags, creator geotag/location tag, cover image
       ├─ geotag hit? → place resolution directly (skip everything else)
       └─ extract(evidence)  LLM pass over caption; if confident → places
            └─ ocr(video)    sample frames ~1 per 2s, OCR burned-in text, re-extract
                 └─ transcript(video)  download audio, ASR (Whisper), re-extract
                      └─ places(candidates)  geocode + rank; ambiguous → ask user
```

### Stage contracts

Every stage is a pure-ish function `(job: ExtractionJob) => Promise<Evidence[]>`
so stages can be reordered, skipped, cached, and unit-tested independently.
See `backend/src/types.ts`.

### LLM extraction

One Claude call (`claude-opus-4-8`, structured output with a strict JSON
schema — see `backend/src/pipeline/extract.ts`) receives *all* evidence
gathered so far and returns:

```jsonc
{
  "candidates": [
    {
      "name": "Joe's Pizza",
      "locationHints": ["Carmine St", "Greenwich Village", "NYC"],
      "confidence": "high",          // high | medium | low
      "evidence": ["caption", "ocr"] // which signals mentioned it
    }
  ],
  "videoIsAboutFood": true
}
```

Notes:
- The schema forces `additionalProperties: false` so the output is machine-safe.
- A video may legitimately contain **multiple** restaurants ("top 5 ramen in
  Austin") — the schema is a list, and the UX handles multi-save.
- Confidence + hints feed place resolution; the LLM never invents coordinates.

### Place resolution

`Text Search` with `name + locationHints` (biased by the user's region and any
geotag). Ranking rules:

1. Exact geotag from the post wins outright.
2. Name match + hint match (neighborhood/city appears in the address) → auto-save.
3. Multiple plausible results or low string similarity → push a
   disambiguation card instead of auto-saving. Never guess-save the wrong place.

## Data model (Postgres, simplified)

```sql
users(id, push_token, preferred_target)          -- 'google' | 'apple' | 'foodapp'
saves(id, user_id, source_url, platform, status, -- queued|extracting|resolved|needs_input|failed
      created_at)
save_places(save_id, place_id, name, lat, lng, address, provider, chosen)
evidence(save_id, kind, content, created_at)      -- caption|geotag|ocr|transcript
```

Keeping every save in our own DB is what makes the Google/Apple deep-link path
still valuable: the user always has a browsable, exportable list in our app
regardless of the target map's API limitations.

## Failure handling

- Ingest always returns `202` fast; every failure after that is surfaced via
  push notification + the save's status, never a blocking error in the share sheet.
- Stage timeouts: metadata 10s, OCR 60s, ASR 120s. A stage failure degrades to
  the next stage rather than failing the job.
- If nothing resolves: notification "Couldn't find a place in this video — open
  to add manually", deep-linking into a manual search pre-filled with the caption.

## Content access (important)

Fetching captions is available via official surfaces (TikTok Display API /
oEmbed, Instagram oEmbed / Graph API) for public posts. **Downloading video or
audio for OCR/ASR is restricted by platform ToS** — the M2 plan is to (a) use
official APIs where scopes allow, (b) evaluate licensed third-party media APIs,
and (c) prototype on-device extraction inside the share extension (the user's
device already has the video rendered; iOS extensions get limited CPU/memory,
so this needs measurement). This is the highest product/legal risk in the
project and should be validated before M2 is committed.
