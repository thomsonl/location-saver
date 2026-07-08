# Platform Constraints & Strategies

This document collects the hard platform facts that shape the product. Verify
each against current docs before building on it — these APIs shift.

## 1. Getting *into* the share flow (the "seamless" requirement)

The user's requirement: never leave the social app, no manual steps.

### iOS — Share Extension
- We ship a **Share Extension** target. It appears in the share sheet of every
  app that shares URLs (TikTok, Instagram, Safari…).
- The extension runs *without opening our main app*. It can do network calls,
  so it POSTs to `/v1/ingest` and calls `completeRequest()` immediately —
  the user is back in TikTok in under a second.
- UI options: `SLComposeServiceViewController` (small card) or a fully custom
  invisible view that auto-dismisses. For true zero-UI, present nothing and
  complete instantly; feedback arrives as a push notification.
- Limits: ~120MB memory, short execution window. Fine for posting a URL;
  *not* fine for on-device ASR of a full video (relevant to M2 exploration).

### Android — Share Target
- Declare an `<intent-filter>` for `ACTION_SEND` with `text/plain`.
- Use a `Activity` with `Theme.Translucent.NoDisplay` that grabs
  `EXTRA_TEXT` (the URL), hands it to a `WorkManager` job, shows a toast
  ("Saving…"), and finishes — the user never visibly leaves the social app.
- Android also supports **Direct Share / sharing shortcuts** so "Save to
  Google Maps" (user's preselected target) can appear as a one-tap row.

### What's NOT possible
- There is no supported way to hook TikTok/Instagram's own UI or intercept
  the share button without the share sheet. The single share-sheet tap is the
  floor on both platforms.

## 2. Getting *out* to the map apps

### Our food app ✅ full control
Direct server-to-server save. The only target with true zero-touch save.

### Google Maps ⚠️ no write API for saved lists
- **No public API** adds a place to a user's Google Maps saved lists
  (the old ability via Google My Business/Places write was never for consumer lists).
- What we can do:
  - **Deep link** to the resolved place: `https://www.google.com/maps/search/?api=1&query=<name>&query_place_id=<PLACE_ID>` — opens the Google Maps app on the place page; saving is then one tap ("Save") inside Google Maps.
  - Maintain the list **in our app** and export **KML/CSV** importable into Google My Maps.
- Place resolution uses the **Places API (Text Search)** — that part is fully supported.

### Apple Maps ⚠️ same limitation
- MapKit / Apple Maps Server API have **no write access to a user's Guides**.
- Deep link: `https://maps.apple.com/place?place-id=<ID>` (or `maps://?q=` fallback) — opens the place; user taps save/add-to-guide.
- Place resolution via **Apple Maps Server API** (geocoding/search) or MapKit search on-device.

### Product implication
"Send to the user's desired map app" is implemented as:
1. Resolve the place server-side (this is the hard part and we do it fully).
2. Save to our own list always (source of truth, exportable).
3. If target = food app → direct save, done silently.
4. If target = Google/Apple Maps → push notification whose tap opens the
   place *pre-resolved* in that app. One tap to open, one tap to save there.
   This is the closest legal approximation of auto-save, and it should be
   framed in the UI as "sent to Google Maps".

## 3. Getting the content (captions, video, audio)

| Need | Sanctioned route | Risk/limit |
|---|---|---|
| Caption + author + cover (TikTok) | oEmbed (`www.tiktok.com/oembed?url=…`), Display API (user OAuth) | oEmbed gives title/author only for public posts; rate limits |
| Caption (Instagram) | oEmbed (requires FB app token), Graph API (user OAuth for own media) | Public-content access is heavily gated post-2020 |
| Post geotag/location tag | Display/Graph APIs where scoped | not in oEmbed |
| Video/audio download for OCR+ASR | ❌ not offered by official APIs | scraping violates ToS; licensed data providers or on-device processing are the viable options |

**Decision to make before M2**: pick the media-access strategy (licensed
provider vs. on-device vs. caption/OCR-of-cover-image-only). M0/M1
deliberately need only caption + geotag, which are obtainable through
sanctioned APIs.

## 4. Push notifications
- APNs (iOS) / FCM (Android). The share extension registers the save; the
  backend notifies on resolution. Notification payload carries the deep link
  and the saveId for the disambiguation flow.
