# Location Saver — Social Video → Map Apps

Save restaurants and other places found in TikTok videos, Instagram Reels, and
YouTube Shorts directly to the user's preferred map app (Google Maps, Apple
Maps, or our food app) — without leaving the social media platform.

## The user experience

1. User is scrolling TikTok/Instagram and sees a video about a restaurant.
2. User taps **Share → Location Saver** (our app appears in the native share sheet).
3. That's it. The share extension fires the post URL to our backend and
   returns immediately — the user never leaves TikTok.
4. Seconds later a push notification arrives: *"Saved Joe's Pizza (Brooklyn) —
   tap to open in Google Maps"*. If extraction was ambiguous (multiple
   restaurants, low confidence), the notification opens a one-tap
   disambiguation card instead.

The only manual action is the share-sheet tap, which is the minimum any
mobile OS allows for passing content between apps.

## How extraction works (more than just the transcript)

The initial assumption — transcript + caption — is right, but there are two
more signals that are often *stronger* and much cheaper to get:

| Signal | Cost | Notes |
|---|---|---|
| **Post location tag / geotag** | Free (post metadata) | Creators frequently tag the restaurant itself. When present, this alone resolves the place — no ML needed. Check it first. |
| **Caption + hashtags** | Cheap (one metadata fetch) | Often contains the name, neighborhood, or "📍" line. |
| **On-screen text (OCR)** | Medium (sample ~1 frame/2s) | Food videos overlay the restaurant name as burned-in text more often than they say it aloud. |
| **Audio transcript (ASR)** | Highest (download + Whisper) | Needed when the name is only spoken. Run last, only if the cheaper signals didn't produce a confident result. |

The pipeline is a **cost ladder**: stop as soon as a stage yields a
high-confidence place match. All gathered evidence goes to an LLM extraction
step (Claude with a strict JSON schema) that outputs candidate restaurant
names + location hints, which are then resolved to real places via the Google
Places / Apple Maps Server geocoding APIs.

## Architecture

```
 ┌────────────┐  share URL   ┌──────────────┐   job    ┌───────────────────────────┐
 │ iOS share  │─────────────▶│  Ingest API  │─────────▶│ Extraction pipeline (queue)│
 │ ext / And- │  (async ack) │ POST /ingest │          │ resolve → metadata → OCR → │
 │ roid intent│              └──────────────┘          │ transcript → LLM extract → │
 └────────────┘                                        │ place resolution           │
                                                       └──────────┬────────────────┘
                                                                  │ resolved place(s)
                                     ┌────────────────────────────┼──────────────┐
                                     ▼                            ▼              ▼
                              ┌────────────┐              ┌─────────────┐ ┌────────────┐
                              │ Food app   │              │ Google Maps │ │ Apple Maps │
                              │ (direct    │              │ (deep link/ │ │ (deep link)│
                              │  save API) │              │  own list)  │ │            │
                              └────────────┘              └─────────────┘ └────────────┘
                                     └────────────── push notification ──────────────┘
```

## The honest constraint: writing to Google/Apple saved lists

Neither Google Maps nor Apple Maps exposes a public API to write to a user's
saved places/lists. This shapes the product:

- **Our food app**: we own the API → true zero-touch save. This is the flagship path.
- **Google Maps / Apple Maps**: we resolve the place and deliver a **deep link**
  (notification tap opens the place, pre-resolved, one tap from "Save" in the
  map app). We also keep every save in the user's Location Saver list, exportable
  as KML/GeoJSON and viewable on an in-app map.

See [`docs/platform-constraints.md`](docs/platform-constraints.md) for details
and the fallback strategies per platform.

## Repository layout

```
location-saver/
├── docs/
│   ├── architecture.md           # pipeline stages, data model, failure handling
│   └── platform-constraints.md   # share-sheet mechanics, map API limits, content-access ToS
├── backend/                      # TypeScript (Fastify) ingest API + extraction pipeline
│   └── src/
│       ├── index.ts              # HTTP server: POST /v1/ingest, GET /v1/saves/:id
│       ├── types.ts              # domain model
│       ├── pipeline/             # resolve → metadata → ocr → transcript → extract → places
│       └── targets/              # MapTarget adapters: foodApp, googleMaps, appleMaps
└── mobile/
    ├── ios/ShareExtension/       # Swift share-extension skeleton
    └── android/                  # Kotlin share-intent activity skeleton
```

## Getting started (backend)

```bash
cd backend
cp .env.example .env   # fill in API keys
npm install
npm run dev
```

## Roadmap

- **M0 — pipeline proof**: paste a TikTok URL into `POST /v1/ingest`, get a resolved place back. Caption + geotag signals only.
- **M1 — mobile share flow**: iOS share extension + Android share target → push notification with deep link.
- **M2 — full signal ladder**: OCR + ASR stages, disambiguation card for multi-restaurant videos.
- **M3 — food app integration**: direct save, saved-list sync, KML export for Google My Maps.
