# Scales 1.0: release plan

Kept here so the steps survive any one session. Graham presses every irreversible button (Submit for Review, Release);
agents stop before them. Steps Claude can't do go to Grok as prompts, with the irreversible steps first.

## Where things stand (8 November 2026)

- Version 1.0 in App Store Connect: build 58 (2.33.1) attached, Prepare for Submission, not submitted.
- Listing text set (iOS 26 for Apple Intelligence; works without a connection; the case for).
- 8 screenshots (6.9-inch) remade from 2.33.1 and uploaded by Grok (8 November): `appstore/screenshots/`.
- Browser app at scales.tangomike.app/app/ runs the `release` branch.
- EU storefronts are off (no trader status). No subscriptions or in-app purchases (Plus deleted 8 November).

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

- The Scales Full unlock: $10 one-time (non-consumable), Argue with it and Tensions; earlier downloads keep
  everything; paid features stay iPhone-only, the browser stays a demo (decided 8 November).
- Tension log analysis (Graham's private doc "Scales Tensions Log"), then prompt tuning.
- Cleanup log in HANDOFF.md (runner retry, GitHub Pages off, old branches).
- Optional: cookieless page counts for the browser app (needs a line in Privacy).
