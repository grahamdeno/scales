# Scales: handoff notes

For a new working session. Read this, then README.md.

## What Scales is

Scales 2 (from 2.0.0, October 2026): "One thought at a time." One of the person's own thoughts on a pistachio ground.
Swipe up to move on, pull down to put it away, tap to edit; both moves undo for 5 s. No verdict buttons: the app reads
each visit by time (20 s or less skipped, 30 s or more thought about; the 26 November evaluation may move these) and edits, and schedules the return. A skip comes back in 5 days. The day's pile (2.12.0) takes up to 5 most-skipped, spreads new ones through, and fills the rest longest-unseen first, so the whole collection comes round in about a week. Nothing leaves
unless the person puts it away. Plum is for when their hand is on it: Write, Edit, the library.

Scales 1 (Skip, Reflect, Lived, the Ledger, voices, AI with Scales Plus) ended at 1.88.0. Its code and release notes are
on the branch `scales-1.88.0` and the tag `v1.88.0`. Its data on the phone (`scales.thoughts.v1` and friends) was
copied in on first open until 2.34.0; since 2.35.0 it is not read (Graham was its only user). Never written or deleted.

## Where things live

- `index.html` (page), `core.js` (logic, `VERSION`), `sets.js`, `sw.js` (offline). Every release bumps `VERSION`, the
  `CACHE` name, the `core.js?v=` and `sets.js?v=` addresses in index.html and sw.js, and the version strings in
  tests/e2e/app.e2e.js (search for the old number, including its escaped form `2\.34\.0`); a test checks they match.
- `ios/`: WKWebView shell that bundles the web app and serves it at `scales-app://local/`. The page talks to it with
  `window.webkit.messageHandlers.scales.postMessage`: `ready`, `store` (NativeStore), `haptic` (tick, medium, success,
  thud, letgo, signature), `icon`, `look`, `save` (daily backup file), `backup`, `aiStatus` and `ai` (Apple
  Intelligence). No StoreKit or reminder code (build 39 and 2.34.0 removed them).
- The browser app at `/app/` is copied from the `release` branch into the Cloudflare site by the Website workflow
  (`scripts/bundle-web.sh`, file list in `scripts/web-files.txt`).
- `site/`: the scales.tangomike.app website (Cloudflare Pages, deployed by `.github/workflows/site.yml`; strict CSP, no inline code).
- Tests: `node --test` (`tests/core.test.js`, `tests/platform.test.js`) and `node tests/e2e/app.e2e.js` (Playwright).
- UX audit: `node tests/audit/run.js` walks 18 journeys on three iPhone sizes, photographs every screen state, runs 30
  simulated days of the schedule and writes `audit-out/report.html`. Journeys and scoring: `docs/audit/journeys.md`;
  people: `docs/audit/human-round.md`. CI: the `UX audit` workflow (schedule check on every PR; full walk in Chromium
  and WebKit by hand) and `iPhone Simulator audit` (Maestro flows on a real simulator, by hand).
- Plans: `docs/release-plan.md`, `docs/evaluation-plan.md`. Finished plans are in `docs/archive/`.

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
  GitHub Pages is not used by the site; turning it off is a Grok step (8 November).
- The marketing site (`site/`: home, Support, Privacy) deploys to Cloudflare from main with the same workflow.
- Secrets live only in GitHub and Cloudflare. Claude cannot set them; the owner's Grok assistant does, from exact
  prompts Claude writes. Never paste tokens.
- Choosing a model: Opus for feel, data safety and judgment calls; Sonnet for well-specified building, tests and
  shipping; Haiku for mechanical edits.

## Where things stand (16 November 2026)

Start here in a new session: this section, `docs/release-plan.md` (after launch) and the Cleanup log below.

- Shipped: Scales 1.0 is live on the US App Store as "Scales: Question Your Thoughts" (Apple ID 6827552145), released
  16 November 2026 at 9:22 PM ET. Build 62, app 2.36.0, commit 6336079 (PR #313). Free; Scales Full $6.99 once
  (`com.grahamdeno.scales.full`, approved with the version). Phased release off. iPhone only, 148 storefronts (EU off).
- Website and browser app: 2.36.1 (launch day, PR #316, commit f377c3a); `release` is on the same commit. The site's
  main button is Download on the App Store; the browser app shows a Scales for iPhone card in Settings and keeps Scales
  Full hidden. Campaign links use provider token 126294308 with `ct=website` and `ct=browser-app`.
- tangomike.app lists Scales as "On the App Store" with an App Store link (`ct=tangomike`; grahamdeno/tangomike PR #7).
- The iPhone app runs 2.36.0 and the browser runs 2.36.1. The difference is browser and website only (the iPhone card
  and the App Store button); the next iPhone build brings both to the same version.
- Tag: `v1.0` for commit 6336079 is not yet created (sessions can't push tags; a Grok step once Graham confirms the name).
- Now (Stage 9 of the playbook): first-week ratings, reviews and crash checks on 17, 19 and 23 November (Grok);
  evaluation and Tensions log analysis on 26 November (scheduled task); then the move onto the playbook
  (grahamdeno/playbook, reports/rollout-plan.md).
- Branches: `launch-day` (the first draft of the launch changes) and `launch-day-1.0` (merged as PR #316) remain;
  neither is deleted without Graham's go. Rollback points: `before-argue-v2`, `before-argue-page`.
- TestFlight builds go to internal testing only (Graham). `scripts/testflight.rb` sets What to Test and never adds a
  build to an external group or submits it for Beta App Review (decided 16 November 2026). The `ios.yml` step is still
  named "Send to beta testers"; rename it with the next change that uploads a build anyway.
- Read-only App Store check: run the `App Store listing` workflow with `check: true` (version, build, screenshots,
  subscriptions, in-app purchases).
- Public beta: deferred (4 November); plan kept in `docs/release-plan.md`.
- Tensions log: Graham sends screenshots of Tensions as they appear; each is judged and logged, with tuning ideas, in his
  private Claude doc "Scales Tensions Log" (https://claude.ai/artifact/LUNmkyw1gpvgBEyFaTn9Fx), never in this repo.
  No prompt changes until the analysis on 26 November is approved. Pairs from before 4 November came from the old prompt.
- Rule and prompt changes are compiled into the iPhone app: they reach users only through a new build and release.
- Shipping: open a PR, wait for the `test` and `browser` checks, merge, move `release` to the merge commit
  (`git push origin <sha>:refs/heads/release`), then run the `iPhone app` workflow on main; a run GitHub cancels for want of a
  Mac ("not acquired") is re-run. Build number = run number. Each step needs its own go from Graham (merge, test build,
  ship).
- Working agreements: prompts for Grok put the irreversible steps first and ask for a report; plain words, no em-dashes;
  Opus for judgment and data safety, Sonnet for building.

## Before the App Store submission (done; 1.0 released 16 November 2026)

- Done: Plus was never approved or sold, and its subscription was deleted (8 November). The App Store name is "Scales: Question Your Thoughts" (subtitle "One thought at a time"; confirmed by Graham 16 November) ("Scales" is taken by another
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

- Done 8 November: the App Store Connect "Scales Plus Yearly" subscription and its group deleted (Grok; confirmed by
  the read-only check). The Cloudflare `PLUS_PREVIEW` variable may still exist; it does nothing, delete it any time.
- Done in 2.35.0: the Scales 1 import removed (importOld, mergeOld, Scales 1 backups, the Scales 1 copy in backups).
  Graham was the only Scales 1 user and confirmed his thoughts are in Scales 2 with a Scales 2 backup made since.
  Website screenshots now WebP (scripts/site-images.py); scripts/site-shots.js and the Plus review screenshot removed.
- Done in 2.34.0: `server/ai.mjs`, its tests and certificates removed; site.yml header updated.
- Done in 2.34.0: unused code swept from core.js and index.html, each item checked
  by search and the tests: pickNext (replaced by nextCard), groupByAdded, addedGroup and ADDED_GROUPS (replaced by
  libraryGroups), withArgNote, argNoteBlock and argNoteLine (Add to note is gone), the TESTFLIGHT variable, and seven
  style rules nothing uses (.acts, .quiet2, .hbtns, .lbl, .plus). Their tests went with them.
- Scales Full (decided 15 November, shipped in 2.36.0 with 1.0, build 62; tested in TestFlight and approved by Apple): free to use; Argue with it,
  Tensions, and Themes and your week are Scales Full, $6.99 once (non-consumable `com.grahamdeno.scales.full`), with 14
  days of everything from the first download (AppTransaction original purchase date). Family Sharing off at launch.
  Insights, backup and everything already made stay free and readable. Rule in `core.js` (`fullState`); StoreKit in
  `ios/App/FullStore.swift`; `ios/Scales.storekit` for Xcode and the simulator; test `tests/e2e/full.e2e.js`. App Store Connect
  steps (done) are in `docs/release-plan.md`.
- Done in 2.34.0: the Scales 1 reminder clearing (`unschedule`, `badge`, `clearReminders`, `setBadge`, the notification
  delegate in ScalesApp.swift) removed.
- iOS workflow: `runs-on: macos-26` waits for GitHub's arm64 Mac runners; on 2 November two runs were cancelled
  unbuilt ("not acquired ... capacity constraints"). Consider a fallback runner label, or retry on cancel.
- Unit tests were red on main for about 20 minutes on 2 November: build 39 merged without `node --test`, and the
  stale Plus test stopped one Website deploy. Add branch protection that requires the `test` workflow before merge.
- RE-1: add a check that `release` only moves to a main commit whose tests passed.
- GitHub Pages is unused since 2.26.0; turning it off is a Grok step (prompt given 8 November). `next/` and `.nojekyll`
  removed in 2.34.0.
- Private repo (decided 8 November): on GitHub Free, private repos get 2,000 Actions minutes a month and Mac minutes
  count 10x. An iPhone build is about 40 of those, a Simulator audit about 150; run the Simulator audit only before a
  release and keep releases bundled. Audit artifacts are kept 7 days (500 MB cap). Branch protection needs a paid plan
  on private repos.
- iPhone builds bundle the web app from main, not `release`. At each ship, merge, build, then move `release` to the
  same commit so the browser and the iPhone run the same version.
- Remote branches: dozens of merged feature branches remain on GitHub. Prune the merged ones.
- Done in 2.34.0: `docs/ARCHITECTURE.md` rewritten for Scales 2.
- EU is off (148 countries). To sell there later: set DSA trader status in App Store Connect, then turn the EU back on.
- Cloudflare Web Analytics is off. Decide after launch whether the marketing site gets it; if yes, update Privacy.
- 26 November evaluation: visits before 2.25.0 never recorded idle, so treat any visit over 5 minutes as seen only.
- Support page promises "a person answers, usually within two days." Keep it only if that holds.

## Open items

- Listing reconciled 16 November 2026: name "Scales: Question Your Thoughts", subtitle "One thought at a time", promotional
  text "Your own thoughts, one at a time, weighed both ways. Free to use; Scales Full is $6.99, once." ("weighed" on the
  store, true on every iPhone; "argued both ways" for Product Hunt, Hacker News and Reddit). Privacy line "Nothing you
  write is sent to us" (the backup goes to the person's own iCloud Drive; purchases go through the App Store).
  appstore/listing.json is the source; scripts/listing.rb sets the name too.

- Subtitle idea, not adopted (2 November 2026): "Question your own thoughts" (26 characters) in place of "Write it down.
  Let it return." It matches the Think it through direction (Argue with it, Tensions, Insights). Graham kept the
  current subtitle for now and may come back to it; to change it, set "subtitle" in appstore/listing.json and run the
  App Store listing workflow with write: true.

- A bespoke put-away haptic would need an iPhone build (today it is thud plus letgo, sent from the page).
- A reminder may come back later; for now Scales is something you open on your own.
- 26 November evaluation: follow `docs/evaluation-plan.md` and run `scripts/evaluate.js` on the backup (timing lines,
  day size, drip, top-up and Keep going attention, feature use, outcomes, health). Leave out visits with
  `kind: "review"` and `undone: true`.
- Possible later additions (not built): a one-tap weekly check-in, how the app was opened (needs a build), Apple
  Intelligence use, Share Sheet import (needs a build), Kafka translations after 1 January 2027.
- Import fix shipped in 2.11.0: a line that is only "- Name" names the line above it, quoted or not.
