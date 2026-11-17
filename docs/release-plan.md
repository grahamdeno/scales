# Scales 1.0: release plan

Kept here so the steps survive any one session. Graham presses every irreversible button (Submit for Review, Release);
agents stop before them. Steps Claude can't do go to Grok as prompts, with the irreversible steps first.

## Where things stand (16 November 2026)

- Shipped: version 1.0 is live on the US App Store, released 16 November 2026 at 9:22 PM ET. Build 62 (app 2.36.0,
  commit 6336079). Apple ID 6827552145. Scales Full ($6.99) approved with the version. Phased release off.
- Website and browser app: 2.36.1 (commit f377c3a, PR #316); `release` is on the same commit.
- EU storefronts are off (no trader status). No subscriptions. One in-app purchase, Scales Full.
- The launch steps below are done and kept as the record. What's next is "After launch".

## Before Submit for Review (done)

1. Done: Graham checked Larger Text on his phone with the TestFlight build.
2. Done: version page checked; build 62 attached, screenshots in order.
3. Done: Graham pressed Submit for Review; Apple approved.

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

**Status (16 November 2026): done.** Apple approved 1.0 (build 62, Scales Full approved). Released 9:22 PM ET. Apple ID
6827552145, provider token 126294308. The launch-day changes shipped as 2.36.1 (branch `launch-day-1.0`, PR #316,
commit f377c3a) and `release` moved to the same commit. The first draft, branch `launch-day`, was not merged and is kept.

1. Done: Grok reported the Apple ID and the provider token.
2. Done: the App Store address and campaign links (`ct=website`, `ct=browser-app`) filled in; merged as PR #316;
   `release` moved; live site checked. tangomike.app updated (grahamdeno/tangomike PR #7, `ct=tangomike`).
3. Done: Graham released the version.
4. Graham's LinkedIn post: his step. App Store Connect, App Analytics, Sources shows downloads from the website, the
   browser app and tangomike.app.

What `launch-day` changes:
- Landing: "Download on the App Store" becomes the main button; "Try it in your browser" is the second.
- Browser app only: a card at the top of Settings, "Scales for iPhone: Argue with it, Tensions and an automatic iCloud
  backup are in the iPhone app", linking to the App Store.

## After launch (first 30 days)

- First week: ratings, reviews and crash reports pulled by Grok on 17, 19 and 23 November; real problems become
  Stage 1 items; review replies are drafted for Graham's approval and posted by Grok only with his exact text.
- 26 November: evaluation (`docs/evaluation-plan.md`) and the Tensions log analysis (scheduled task).
- After launch week: move Scales onto the playbook (grahamdeno/playbook, reports/rollout-plan.md).

- (Done in 2.36.0, decided 15 November) Scales Full ships with 1.0: $6.99 once (non-consumable
  `com.grahamdeno.scales.full`), Argue with it, Tensions, and Themes and your week, 14 days of all of it from the
  first download, Family Sharing off, browser stays a demo. No one downloaded before it, so no grandfathering.
- Tension log analysis (Graham's private doc "Scales Tensions Log"), then prompt tuning.
- Cleanup log in HANDOFF.md (runner retry, GitHub Pages off, old branches).
- Optional: cookieless page counts for the browser app (needs a line in Privacy).

## Scales Full in App Store Connect (done 15 to 16 November 2026; kept as the record)

Order: the build first, then the purchase, then the listing, then stop.

1. Agreements, Tax and Banking: the Paid Apps agreement must be active (Graham, with his bank and tax details).
2. Monetization, In-App Purchases, create a Non-Consumable: Reference name "Scales Full", Product ID
   `com.grahamdeno.scales.full` (cannot be changed later), price $6.99, Family Sharing off, all storefronts the app uses.
3. Localization (English U.S.): display name "Scales Full"; description (Apple allows 45 characters) "Argue, Tensions, Themes. Pay once, keep it." Review screenshot: Settings, Scales Full.
4. Review notes on the version (Graham's final text, 16 November, also keeps the 988 safety note and says "it makes no network requests of its own; purchases go through the App Store"): "The app is free to use. Scales Full is a one-time purchase (Settings, Scales Full).
   Every download has all features free for 14 days from the first download; the purchase and Restore purchase work
   at any time, also during the 14 days. Argue with it, Tensions and Themes need Apple Intelligence (iPhone 15 Pro or
   later, iOS 26); on other devices they do not appear."
5. Attach the new build (2.36.0, build 62) to version 1.0 and attach the in-app purchase to the version.
6. Update the listing from `appstore/listing.json` (the `App Store listing` workflow with write: true).
7. STOP. Graham reviews and presses Submit for Review himself.
