# Scales: handoff notes

For a new working session. Read this, then README.md.

## What Scales is

Scales 2 (from 2.0.0, October 2026): "One thought at a time." One of the person's own thoughts on a pistachio ground.
Swipe up to move on, pull down to put it away, tap to edit; both moves undo for 5 s. No verdict buttons: the app reads
each visit by time (20 s or less skipped, 30 s or more thought about; the 12 November evaluation may move these) and edits, and schedules the return. A skip comes back in 5 days. The day's pile (2.12.0) takes up to 5 most-skipped, spreads new ones through, and fills the rest longest-unseen first, so the whole collection comes round in about a week. Nothing leaves
unless the person puts it away. Plum is for when their hand is on it: Write, Edit, the library.

Scales 1 (Skip, Reflect, Lived, the Ledger, voices, AI with Scales Plus) ended at 1.88.0. Its code and release notes are
on the branch `scales-1.88.0` and the tag `v1.88.0`. Its data on the phone (`scales.thoughts.v1` and friends) is only
read, never written or deleted.

## Where things live

- `index.html` (page), `core.js` (logic, `VERSION`), `sw.js` (offline). Every release bumps `VERSION`, the `CACHE`
  name and both `core.js?v=` addresses together; a test checks they match.
- `next/`: the trial address. It forwards to `/app/` with the query (so `?native=1` survives) and its worker unregisters.
- `ios/`: WKWebView shell loading `https://scales.tangomike.app/app/?native=1`. The page talks to it with
  `window.webkit.messageHandlers.scales.postMessage`: `ready`, `haptic` (tick, medium, success, thud, letgo,
  signature), `save` (daily backup file), `unschedule` and `badge` (sent on open to clear Scales 1's reminders).
  StoreKit, icon and reminder code stays in the shell, unused (the owner's choice).
- `server/app-proxy.js` serves `/app/` from GitHub Pages. `server/ai.mjs` is the dormant Plus AI server.
- `site/`: the scales.tangomike.app website (Cloudflare Pages, deployed by `.github/workflows/site.yml`; strict CSP, no inline code).
- Tests: `node --test` (`tests/core.test.js`, `tests/platform.test.js`) and `node tests/e2e/app.e2e.js` (Playwright).
- Plans: `docs/next-plan.md`, `docs/swap-plan.md`.

## Shipping

- Work on a branch, open an issue, PR, merge. The owner wants Claude to open and merge PRs itself.
- `scripts/ship.sh BRANCH ISSUE "title"` with the commit message in `$SCRATCH/msg.txt` commits staged work, opens and
  merges the PR and waits for CI. With work already committed, open and merge through `gh api` (REST only).
- Web changes go live when GitHub Pages deploys (about a minute). The iPhone app picks them up when reopened.
- Anything under `ios/**` on main builds and uploads to TestFlight automatically (workflow `iPhone app`).
- Secrets live only in GitHub and Cloudflare. Claude cannot set them; the owner's Grok assistant does, from exact
  prompts Claude writes. Never paste tokens.
- Choosing a model: Opus for feel, data safety and judgment calls; Sonnet for well-specified building, tests and
  shipping; Haiku for mechanical edits.

## Where things stand (31 October 2026)

- Web app: 2.12.0 (pile rework: skip back in 5 days, 5 avoided a day, longest unseen first, day-seeded shuffle, top-up and Keep going are real visits). Before it, 2.11.2. Settings is grouped cards (also Sets and Import), the daily pile is 30 with Keep going,
  Appearance (Automatic, Light, Dark; the control shows only in builds from 38), telemetry on the phone only, and a small
  footer in Settings ("Your thoughts stay on your phone." with the Pistachio icon).
- Website (`site/`): redesigned and live (real screenshots in Light and Dark, Sets, Support and Privacy updated). Check it
  by `https://scales.tangomike.app`. Stylesheet is `?v=2.2.0`; the Website workflow checks it.
- App Store: version 1.0 is a draft with build 38 attached, seven captioned 6.9-inch screenshots uploaded (made by
  `scripts/shots.js` and `scripts/appstore.js`, files in `appstore/screenshots/`), release set to manual, status Prepare
  for Submission. Graham chose to wait until after 12 November to press Submit for Review. Only he presses it.
- Left: EU trader status (his decision), then Submit for Review.
- 12 November, 8:40 am ET: a scheduled task starts a fresh session that asks for "Scales backup.json" and runs
  `docs/evaluation-plan.md`. Rule changes from the evaluation are web-only and reach every build, including build 38.

## Before the App Store submission

- Done (29 October): Plus was never approved, so it was never on sale; `ScalesPlusPreview: false` in `ios/project.yml`;
  `PLUS_PREVIEW=off` in Cloudflare. The App Store name is "Scales: One Thought at a Time" ("Scales" is taken by another
  account); version 1.0, iPhone only. Listing text, URLs, App Privacy (Data Not Collected) and 4+ are set.

## Design rules

- One thought on screen. Nothing else unless a hand is on it.
- No verdicts. The person only moves on or puts away; the app reads the rest.
- A thought never disappears on its own. Everything put away is one tap from coming back.
- Two grounds, no accent: pistachio `#B9C9A3` with ink `#2A1E2E`; plum `#3B2240` with bone `#F1E9D8`.
- Haptics confirm or reward; key moments (put away, keep) get longer patterns.
- Test at 375, 390 and 430 wide before saying it works.
- Owner's style: plain words, no em-dashes, no military metaphors; do checks yourself rather than handing them back.

## Open items

- A bespoke put-away haptic would need an iPhone build (today it is thud plus letgo, sent from the page).
- A reminder may come back later; for now Scales is something you open on your own.
- 12 November evaluation: follow `docs/evaluation-plan.md` and run `scripts/evaluate.js` on the backup (timing lines,
  day size, drip, top-up and Keep going attention, feature use, outcomes, health). Leave out visits with
  `kind: "review"` and `undone: true`.
- Possible later additions (not built): a one-tap weekly check-in, how the app was opened (needs a build), Apple
  Intelligence use, Share Sheet import (needs a build), Kafka translations after 1 January 2027.
- Import fix shipped in 2.11.0: a line that is only "- Name" names the line above it, quoted or not.
