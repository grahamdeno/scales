# Scales 1.0: release plan

Kept here so the steps survive any one session. Graham presses every irreversible button (Submit for Review, Release);
agents stop before them. Steps Claude can't do go to Grok as prompts, with the irreversible steps first.

## Where things stand (8 November 2026)

- Version 1.0 in App Store Connect: build 58 (2.33.1) attached, Prepare for Submission, not submitted.
- Listing text set (iOS 26 for Apple Intelligence; works without a connection; the case for).
- 8 screenshots (6.9-inch) remade from 2.33.1 and uploaded by Grok (8 November): `appstore/screenshots/`.
- Browser app at scales.tangomike.app/app/ runs the `release` branch.
- EU storefronts are off (no trader status). No subscriptions (Plus deleted 8 November). From 2.36.0 the one in-app
  purchase, Scales Full, is created in App Store Connect and submitted with the version (see "Scales Full in App
  Store Connect" below).

## Before Submit for Review

1. Graham checks Larger Text on his phone with the TestFlight build.
2. Graham checks the version page: no red banners, build 58 (or a newer one he chooses), screenshots in order.
3. Graham presses Submit for Review. Claude freezes main and `release` until Apple decides.

## Public beta (deferred)

Decided 4 November: no public beta for now. Graham tunes the timing on his own data over the next few weeks; the beta is
revisited after reviewing his telemetry. The plan below is kept for then.

Goal: more people using Scales so the timing rules (20 s / 30 s / 5-minute idle, day size 30) can be tuned on real use.
Telemetry never leaves a phone by itself; testers choose to send it.

1. Grok: TestFlight external group "Public beta", add the current build, submit for Beta App Review, turn on the public
   link, report the link.
2. Claude: a TestFlight-only "Send my usage to Graham" in Settings that shares a file with the visit log and events only
   (no thought text, no notes), by email or the share sheet; Privacy and Support say so; a new build.
3. Claude: the landing page gets "Join the beta" (the TestFlight public link) beside "Try it in your browser".
4. Analysis: `scripts/evaluate.js` reads each tester's usage file; findings feed the timing rules.

## Launch day (after Apple approves)

Branch `launch-day` holds the website and browser changes; it is safe to merge early (placeholders keep the links hidden
or inert), but it should ship with the App Store address filled in.

1. Grok: from App Store Connect, report the app's Apple ID (the number in the App Store link) and the provider token
   for campaign links (App Analytics, Campaigns).
2. Claude: replace `{APP_ID}` and `{PROVIDER_TOKEN}` in `site/index.html` (campaign `ct=website`) and `index.html`
   (`APP_STORE_URL`, campaign `ct=browser-app`); merge `launch-day`; move `release`; check the live site.
3. Graham presses Release this version (release is set to manual).
4. Graham posts on LinkedIn with the website link. App Store Connect, App Analytics, Sources shows downloads that came
   from the website and from the browser app.

What `launch-day` changes:
- Landing: "Download on the App Store" becomes the main button; "Try it in your browser" is the second.
- Browser app only: a card at the top of Settings, "Scales for iPhone: Argue with it, Tensions and an automatic iCloud
  backup are in the iPhone app", linking to the App Store.

## After launch (first 30 days)

- (Done in 2.36.0, decided 15 November) Scales Full ships with 1.0: $6.99 once (non-consumable
  `com.grahamdeno.scales.full`), Argue with it, Tensions, and Themes and your week, 14 days of all of it from the
  first download, Family Sharing off, browser stays a demo. No one downloaded before it, so no grandfathering.
- Tension log analysis (Graham's private doc "Scales Tensions Log"), then prompt tuning.
- Cleanup log in HANDOFF.md (runner retry, GitHub Pages off, old branches).
- Optional: cookieless page counts for the browser app (needs a line in Privacy).

## Scales Full in App Store Connect (new, 15 November 2026; Grok steps, Graham presses Submit for Review)

Order: the build first, then the purchase, then the listing, then stop.

1. Agreements, Tax and Banking: the Paid Apps agreement must be active (Graham, with his bank and tax details).
2. Monetization, In-App Purchases, create a Non-Consumable: Reference name "Scales Full", Product ID
   `com.grahamdeno.scales.full` (cannot be changed later), price $6.99, Family Sharing off, all storefronts the app uses.
3. Localization (English U.S.): display name "Scales Full"; description "Argue with it, Tensions, and Themes and your
   week. One payment, yours for good. Nothing renews." Review screenshot: Settings, Scales Full.
4. Review notes on the version: "The app is free to use. Scales Full is a one-time purchase (Settings, Scales Full).
   Every download has all features free for 14 days from the first download; the purchase and Restore purchase work
   at any time, also during the 14 days. Argue with it, Tensions and Themes need Apple Intelligence (iPhone 15 Pro or
   later, iOS 26); on other devices they do not appear."
5. Attach the new build (2.36.0) to version 1.0 and attach the in-app purchase to the version.
6. Update the listing from `appstore/listing.json` (the `App Store listing` workflow with write: true).
7. STOP. Graham reviews and presses Submit for Review himself.
