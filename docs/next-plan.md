# Scales next: build plan

The new Scales, built beside the current app in `next/`, reachable at `scales.tangomike.app/app/next/` and from inside
the iPhone app with no TestFlight build. The current app's files and data are never changed, except for one link.

Work lives on the branch `next-build` until step 8. Nothing on that branch is live.

## What it is

- **Meet** (pistachio): one thought. Swipe up = next. Pull down = put away. Tap = edit. Nothing else on screen.
- **Write** (plum): "What's on your mind?", Keep. A new thought comes back tomorrow.
- **Edit** (plum): the thought and an optional note. Delete takes two taps.
- **Strip and library** (plum): "Your thoughts" along the bottom edge; tap to open everything, search, Bring back.
- **No verdicts.** The app reads each visit: 7 s or less = skipped, 11 s or more = thought about, 7 to 11 s = seen,
  edited or noted = worked on. Time counts only while the thought is on screen and the app is open; over 5 min
  with no touch counts as seen.
- **Return schedule:** skipped 1 day; seen 2 days; thought about 2 + 2 per time (max 21); worked on 4 + 3 per time (max 30).
  Avoided thoughts are set heavier and come first. Nothing leaves unless the person puts it away.
- **Your thoughts come along:** first open copies the current app's thoughts (read only): active ones join the rotation
  5 a day, most skipped first; lived and let-go ones arrive put away.

## Steps

Model notes: **Opus** for anything touching feel, data safety or judgment calls; **Sonnet** for well-specified
building, tests and shipping; **Haiku** for mechanical edits. Each step lists what "done" means.

| # | Step | Model | Status | Done when |
|---|---|---|---|---|
| 1 | Logic: `next/core.js` (visit reading, return schedule, import, labels) | Opus | Done | Written; covered by step 5 |
| 2 | Page: `next/index.html` (Meet, gesture, Write, Edit, strip, library, undo, haptics, backup) | Opus | Done; loads clean at 390 px with an imported thought, gestures not yet driven | Runs with no console errors |
| 3 | Offline and home screen: `next/sw.js` (network first, own cache, scope `./`) and `next/manifest.webmanifest` (pistachio theme, reuses `../icons`) | Sonnet | Done; verified offline in Chromium | Loads offline after one visit; does not touch the root `scales-v*` cache |
| 4 | Switch links: "Try the new Scales" in the current app's Settings > Help and about (keeps `?native=1` in the iPhone app); "Back to the current Scales" is already in the library | Sonnet | Done; current app bumped to 1.88.0, its worker now clears only `scales-v*` caches | Both directions work in a 390 px browser and keep `?native=1` |
| 5 | Unit tests: `tests/next.test.js` for classify, nextGap, recordVisit, pickNext order, importOld (status mapping, 5 a day, old data untouched), whenLabel, 4 AM day start | Sonnet | Done; 159 pass | `node --test` passes |
| 6 | Browser check at 390, 375 and 430 wide: swipe up, pull down + Undo, tap to edit, write, library search and Bring back, import from seeded old data, no console errors | Sonnet | Done; `tests/e2e/next.e2e.js` passes at 390, 375, 430 | Playwright script passes; screenshots of each screen |
| 7 | Feel review of step 6 screenshots against the canvas boards (spacing, weights, plum fade, strip) | Opus | To do | Changes listed or "no change" |
| 8 | Ship: branch, issue, PR, merge with `scripts/ship.sh`; confirm Pages deploy and that `/app/next/` loads | Sonnet | To do | Live at scales.tangomike.app/app/next/ |
| 9 | Graham tries it on his phone for a few days | Graham | To do | Notes on thresholds (100 px up, 160 px down, 7 s / 11 s) and the plum fade |
| 10 | Tune from his notes | Opus for feel, Sonnet for edits | Later | |
| 11 | Swap: decide when `next/` replaces the current app, and how its data carries over | Opus | Later | A separate plan |

## Out of scope for this build

AI lines, quotes, voices, replies, collections, reminders, badges, Scales Plus, app icons, CSV, the iCloud daily save.
Each can earn its way back later, one at a time.

## Open questions

- Library on plum bends "plum is for your hand on it." Keep, or open it on pistachio?
- First-time nudge (the thought lifts once at 2.5 s): enough, or does a new user need one line of text?
- The 5-a-day pace for imported thoughts: right for Graham's deck size?
