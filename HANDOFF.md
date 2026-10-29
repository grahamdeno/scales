# Scales: handoff notes

For a new working session. Read this, then README.md.

## What Scales is

Scales 2 (from 2.0.0, October 2026): "One thought at a time." One of the person's own thoughts on a pistachio ground.
Swipe up to move on, pull down to put it away, tap to edit; both moves undo for 5 s. No verdict buttons: the app reads
each visit by time (20 s or less skipped, 30 s or more thought about) and edits, and schedules the return. Nothing leaves
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
- `site/`: the scales.tangomike.app website. It still describes Scales 1 and needs a rewrite.
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

## Before the App Store submission

- Done (29 October): Plus was never approved, so it was never on sale; `ScalesPlusPreview: false` in `ios/project.yml`;
  `PLUS_PREVIEW=off` in Cloudflare. The App Store name is "Scales: One Thought at a Time" ("Scales" is taken by another
  account); version 1.0, iPhone only. Listing text, URLs, App Privacy (Data Not Collected) and 4+ are set.
- Left: choose the subtitle, EU trader status, attach the final build and `store/` screenshots, Submit for Review.

## Design rules

- One thought on screen. Nothing else unless a hand is on it.
- No verdicts. The person only moves on or puts away; the app reads the rest.
- A thought never disappears on its own. Everything put away is one tap from coming back.
- Two grounds, no accent: pistachio `#B9C9A3` with ink `#2A1E2E`; plum `#3B2240` with bone `#F1E9D8`.
- Haptics confirm or reward; key moments (put away, keep) get longer patterns.
- Test at 375, 390 and 430 wide before saying it works.
- Owner's style: plain words, no em-dashes, no military metaphors; do checks yourself rather than handing them back.

## Open items

- The website (`site/`) still shows Scales 1.
- A bespoke put-away haptic would need an iPhone build (today it is thud plus letgo, sent from the page).
- A reminder may come back later; for now Scales is something you open on your own.
- Library on plum, the first-time nudge, and the 5-a-day import pace were open questions; the owner has not raised them.
- Times review, on or after 12 November: read `visits` in the daily backup and recommend the skip and thought lines
  (see `docs/2.1-plan.md`, step 10). Leave out visits with `kind: "review"` (opened from Bookmarked) and `undone: true`.
- 2.2.0 is on `release-2.2`, not shipped: Bookmark, New filter, scrolling filters, Done and Keep as words, growing fields,
  new icons with a picker, website copy. See `docs/2.1-plan.md`.
