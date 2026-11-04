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
- The browser app at `/app/` is copied from the `release` branch into the Cloudflare site by the Website workflow
  (`scripts/bundle-web.sh`, file list in `scripts/web-files.txt`). `server/ai.mjs` is the dormant Plus AI server.
- `site/`: the scales.tangomike.app website (Cloudflare Pages, deployed by `.github/workflows/site.yml`; strict CSP, no inline code).
- Tests: `node --test` (`tests/core.test.js`, `tests/platform.test.js`) and `node tests/e2e/app.e2e.js` (Playwright).
- Plans: `docs/next-plan.md`, `docs/swap-plan.md`.

## Shipping

- Work on a branch, open an issue, PR, merge. The owner wants Claude to open and merge PRs itself.
- `scripts/ship.sh BRANCH ISSUE "title"` with the commit message in `$SCRATCH/msg.txt` commits staged work, opens and
  merges the PR and waits for CI. With work already committed, open and merge through `gh api` (REST only).
- iPhone app (build 40 on): the web app is bundled inside the binary at build time from main
  (`scripts/bundle-web.sh ios/web`), served at scales-app://local/ by `WebScheme.swift`. It makes no network requests.
  Web changes reach the iPhone only through a new build: run the `iPhone app` workflow on main (Run workflow), which
  bundles, signs and uploads to TestFlight. Pushes to `ios/**` or the bundle scripts on main do the same automatically.
- Everything the page saves is mirrored to Application Support/Scales/store.json (`NativeStore.swift`,
  `NativeStore.js`). On start the newer of file and localStorage wins (a revision counter). The first launch of build
  40 copied what the web version saved under https://scales.tangomike.app (old localStorage, left in place).
- Browser app: scales.tangomike.app/app/ serves the `release` branch (Website workflow, Cloudflare). Merging to main
  changes nothing for browser users. To release: run the unit and browser tests on main, then
  `git push origin main:release` (fast-forward only); the Website workflow deploys it; check VERSION at /app/core.js.
  GitHub Pages is no longer used by the site (it still builds `release`; can be turned off).
- The marketing site (`site/`: home, Support, Privacy) deploys to Cloudflare from main with the same workflow.
- Secrets live only in GitHub and Cloudflare. Claude cannot set them; the owner's Grok assistant does, from exact
  prompts Claude writes. Never paste tokens.
- Choosing a model: Opus for feel, data safety and judgment calls; Sonnet for well-specified building, tests and
  shipping; Haiku for mechanical edits.

## Where things stand (4 November 2026)

Start here in a new session: this section, `docs/release-plan.md` (submit, launch day, beta, after launch), and the
Cleanup log below.

- App: 2.32.1, iPhone build 55. The web app is bundled into the iPhone app; the browser copy at
  scales.tangomike.app/app/ serves the `release` branch and runs the same code. Version history is in README.md.
- App Store: version 1.0 is Prepare for Submission with build 55 attached. Listing text updated on 4 November (iOS 26,
  works without a connection, the case for). New 8 screenshots in `appstore/screenshots/`; Grok uploads them (not yet
  confirmed). Release is manual. Graham has not submitted and will decide when; only he presses Submit for Review and
  Release.
- Public beta: deferred (4 November). Graham tunes the timing on his own data for a few weeks first; plan kept in
  `docs/release-plan.md`.
- Held branch `launch-day`: App Store as the main button on the landing page and an iPhone-app card in the browser app;
  links are placeholders until launch (see the release plan).
- Rollback points (branches): `before-argue-v2` (before 2.31.0) and `before-argue-page` (before 2.32.0). Feature branches
  as shipped: `argue-v2`, `refine-v1`, `breathe-test`, `argue-page`, `argue-keep`.
- Tensions log: Graham sends screenshots of Tensions as they appear; each is judged and logged, with tuning ideas, in his
  private Claude doc "Scales Tensions Log" (https://claude.ai/artifact/LUNmkyw1gpvgBEyFaTn9Fx), never in this public
  repo. No prompt changes until he asks for the full analysis. Pairs from before 4 November came from the old prompt.
- 12 November, 8:40 am ET: a scheduled task starts a fresh session that asks for "Scales backup.json" and runs
  `docs/evaluation-plan.md`. Rule changes now need a new build to reach the iPhone.
- Shipping: open a PR, wait for the `test` and `browser` checks, merge, move `release` to the merge commit
  (`git push origin <sha>:refs/heads/release`), then run the `iPhone app` workflow on main; a run GitHub cancels for want of a
  Mac ("not acquired") is re-run. Build number = run number. Tags can't be pushed from Claude sessions; use branches.
- Working agreements: Graham says "ship" before anything merges; prompts for Grok put the irreversible steps first and
  ask for a report; plain words, no em-dashes; Opus for judgment and data safety, Sonnet for building.

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

## Cleanup log

Loose ends from the 2 November 2026 pre-submission work. None blocks 1.0. Fold them into the 30-day plan.

- Cloudflare `PLUS_PREVIEW` variable (Production and Preview) does nothing now that /api/ai is gone. Remove it (Grok).
  The `ANTHROPIC_API_KEY` secret was removed 2 November; confirm the next Website deploy is the live one.
- `server/ai.mjs` and its tests (verifyPlus, verifyPreview, the AI server) are no longer deployed. Delete them, or keep
  them only if a server-side feature is planned. Update the header comment in `.github/workflows/site.yml`, which still
  describes the AI server.
- App Store Connect: the Plus Yearly subscription is unattached and Ready to Submit. Delete it, or leave it, when the
  $9.99 lifetime Supporter unlock (non-consumable, NV-4) is built. Never attach it to 1.0.
- iPhone shell: `clearReminders` and `setBadge` (the "unschedule" and "badge" messages) exist only to clear old
  Scales 1 reminders. Remove them in a later build. The NWPathMonitor offline screen stays until the web app is bundled.
- iOS workflow: `runs-on: macos-26` waits for GitHub's arm64 Mac runners; on 2 November two runs were cancelled
  unbuilt ("not acquired ... capacity constraints"). Consider a fallback runner label, or retry on cancel.
- Unit tests were red on main for about 20 minutes on 2 November: build 39 merged without `node --test`, and the
  stale Plus test stopped one Website deploy. Add branch protection that requires the `test` workflow before merge.
- RE-1: add a check that `release` only moves to a main commit whose tests passed.
- GitHub Pages is unused since 2.26.0; turn it off in repo settings (Grok), and remove `next/` if no old links need it.
- iPhone builds bundle the web app from main, not `release`. At each ship, merge, build, then move `release` to the
  same commit so the browser and the iPhone run the same version.
- Remote branches: dozens of merged feature branches remain on GitHub. Prune the merged ones.
- `docs/ARCHITECTURE.md` (RE-3) predates Scales 2 and the release pin. Update it.
- EU is off (148 countries). To sell there later: set DSA trader status in App Store Connect, then turn the EU back on.
- Cloudflare Web Analytics is off. Decide after launch whether the marketing site gets it; if yes, update Privacy.
- 12 November evaluation: visits before 2.25.0 never recorded idle, so treat any visit over 5 minutes as seen only.
- Support page promises "a person answers, usually within two days." Keep it only if that holds.

## Open items

- Subtitle idea, not adopted (2 November 2026): "Question your own thoughts" (26 characters) in place of "Write it down.
  Let it return." It matches the Think it through direction (Argue with it, Tensions, Insights). Graham kept the
  current subtitle for now and may come back to it; to change it, set "subtitle" in appstore/listing.json and run the
  App Store listing workflow with write: true.

- A bespoke put-away haptic would need an iPhone build (today it is thud plus letgo, sent from the page).
- A reminder may come back later; for now Scales is something you open on your own.
- 12 November evaluation: follow `docs/evaluation-plan.md` and run `scripts/evaluate.js` on the backup (timing lines,
  day size, drip, top-up and Keep going attention, feature use, outcomes, health). Leave out visits with
  `kind: "review"` and `undone: true`.
- Possible later additions (not built): a one-tap weekly check-in, how the app was opened (needs a build), Apple
  Intelligence use, Share Sheet import (needs a build), Kafka translations after 1 January 2027.
- Import fix shipped in 2.11.0: a line that is only "- Name" names the line above it, quoted or not.
