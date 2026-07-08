# Mobile share entry points

Both platforms follow the same contract: grab the shared URL from the native
share sheet, POST it to `POST /v1/ingest`, and dismiss immediately. All
feedback (success, disambiguation, failure) arrives later as a push
notification — the user never leaves TikTok/Instagram.

- `ios/ShareExtension/ShareViewController.swift` — iOS Share Extension skeleton.
  Note the extension's short execution window: use `beginBackgroundTask`-style
  handling only if needed; a single small POST completes well within limits.
- `android/ShareReceiverActivity.kt` — translucent `ACTION_SEND` activity that
  enqueues a WorkManager job and finishes instantly.

Main-app responsibilities (not in this skeleton):
- onboarding: pick preferred map target (`PUT /v1/users/:id/prefs`)
- push-notification registration (APNs/FCM) and deep-link handling
- saved-places list view + disambiguation card for `needs_input` saves
