# Scales: handoff notes

For a new working session. Read this, then README.md (release notes, newest first).

## What Scales is

"Weigh your thoughts." A deck of the person's own thoughts, shown a few a day (default 5). For each card:
**Skip**, **Reflect** (8-second sit, counts, the thought gets lighter) or **Lived** (moves to the Ledger).
**Not sure it's true?** opens **The other side** (the case against; AI with Plus), answered with
**Let go / Revise / Not done yet**. The Ledger is the record. Scales Plus ($19.99/yr, 14-day trial) adds AI
questions, the best quote from today's voice, and replies.

## Where things live

- `index.html`: the whole app UI (CSS + one IIFE). `core.js`: logic, `VERSION`, `BUILT`. `sw.js`: offline cache.
  Every release bumps the version in all three (`core.js` VERSION, `sw.js` cache name and `core.js?v=` in SHELL,
  and the `core.js?v=` script tag in `index.html`). A test checks they match.
- `server/ai.mjs` becomes `functions/api/ai.js` (Cloudflare Pages Function, the AI proxy; checks Apple's signed
  records: `verifyPlus` for buyers, `verifyPreview` for TestFlight copies; `PLUS_PREVIEW=off` ends previews).
  `server/app-proxy.js` serves `/app/` from GitHub Pages.
- `site/`: scales.tangomike.app landing, support and privacy pages. Strict CSP: no inline styles.
- `ios/`: the iPhone app, a WKWebView shell (`WebViewController.swift`) loading
  `https://scales.tangomike.app/app/?native=1`. `Haptics.swift` plays named haptics. XcodeGen (`project.yml`).
  Icons are Icon Composer bundles (`AppIcon.icon` plus the fixed `AppIcon-Light`, `-Black`, `-Paper`, `-Glass`).
- Tests: `node --test` (unit, string and logic checks) and `node --test tests/e2e/loop.e2e.js` (Playwright,
  iPhone-sized). The e2e tests that play the iPhone app delete `navigator.serviceWorker`, because WKWebView has none.

## Shipping

- Work on a branch, open an issue, PR, merge. The owner wants Claude to open and merge PRs itself.
- `scripts/ship.sh BRANCH ISSUE "title"` with the commit message in `$SCRATCH/msg.txt` (first line title, then
  body). It runs the unit tests, commits as grahamdeno with the co-author trailer, pushes, opens and merges the PR,
  and waits for CI. Set `SCRATCH` to any folder.
- Web changes go live when GitHub Pages deploys (about a minute). The iPhone app picks them up when reopened.
- Anything under `ios/**` on main builds and uploads to TestFlight automatically (workflow `iPhone app`); the run's
  annotation says "Uploaded build N to TestFlight". The tester must update in the TestFlight app.
- Secrets live only in GitHub and Cloudflare. Claude cannot set them; the owner's Grok assistant does, from exact
  prompts Claude writes. Never paste tokens.

## Before the App Store submission

- Set `ScalesPlusPreview: false` in `ios/project.yml` (App Review runs in Sandbox and would see the preview).
- Optionally set `PLUS_PREVIEW=off` in Cloudflare.

## Design rules learned the hard way (October 2026)

- One screen, one question; the buttons at the bottom answer it. No second lines on buttons.
- Words say what they do: "Answer it" / "Your take" / "Argue back", "+ Add to my thoughts" (never for a question),
  "Not sure it's true?". Avoid "Keep" for two meanings.
- Nothing in the main loop scrolls. The thought is never cut: `fitThought` steps its type down, refits when the
  font loads and when the card resizes; `fitLine` does the same for the line under it.
- Quiet: after 3 s only the top bar, progress and labels dim. The thought, its question, the credit, the options
  and the choices stay bright and act on the first touch.
- AI in a voice is credited "Written by AI, as **Name**". Names stay readable.
- Haptics confirm or reward, never decorate. The signature buzz plays once a day at "Done for today".
- Test on a phone-like setup (late font, no service worker, 375/390/430 wide) before saying it works.
- Owner's style: plain words, no em-dashes, no military metaphors; do checks yourself rather than handing them back.

## Open items

- App icons: Automatic, Light, Black, Paper and Glass (1.85.0; all but Automatic need Plus). Ember, Blue and Graphite
  were drawn and are on hold, not rejected. Glass's point could be a brighter blue at small sizes (a reviewer's note).
- Whether to extend the quiet fade further, or tune DWELL_MS (3 s) and SKIP_ASK_AT (2).
- Reflect without Undo is a trial (`REFLECT_UNDO = false` in index.html).
- Shoebox song-question fix (separate repo) is waiting on the owner.
- App Store Connect listing: name "Scales: Weigh Your Thoughts", subtitle "Is it true? Do you live it?".
