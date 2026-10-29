# Scales swap plan: when the new Scales becomes Scales

**Status, 29 October 2026:** done through S6 and the load colour from S8, as 2.0.0. Graham decided on the day: no other
users, Scales 1 can go today, Plus code left in place unused, no reminder for now, subtitle "One thought at a time".
Scales 1's code is on the branch `scales-1.88.0` (and tag `v1.88.0`) instead of a served `/app/classic/`.
Left: S7 (take Plus off sale), the rest of S9 (listing and screenshots), and the website.

Step 11 of `docs/next-plan.md`. The new Scales (`/app/next/`, 2.0.0-next) replaces the current app (`/app/`, 1.88.0)
in the iPhone app and on the web. Nothing here runs until Graham says go at the decision point (step S4).

## What has to be true first

- Graham has used the new Scales daily for at least 7 days and tuned it (steps 9 and 10).
- No thought has gone missing in that time.
- The open questions at the bottom are answered.

## What the swap touches

| Area | Today (current app) | After the swap | Risk if missed |
|---|---|---|---|
| Thoughts | `scales.thoughts.v1` | `scales.next.thoughts.v1`; the old key is kept, read only, forever | Losing thoughts written in the current app after the first import |
| Daily save to iCloud | Automatic, through the shell's `save` message (14 dated copies) | Must be added to the new app; the shell already supports it, so no iPhone build is needed | **No automatic backup at all.** The new app only has a manual Back up |
| Reminders and badge | Scheduled by the page through the shell | None in the new app (out of scope) | Old reminders keep firing and a badge sticks, pointing at an app that no longer asks for them |
| Scales Plus (AI) | $19.99 a year in the shell, AI server on Cloudflare | No AI in the new app | Selling a subscription that delivers nothing |
| App icons | Automatic, Light, Black, Paper, Glass | No icon choice in the new app; the icon stays whatever is set | Low |
| Haptics | Shell styles | Same shell, styles tick, medium, success, thud | None |
| Load colour | Shell paints smoke `#DCD9D3` before the page loads | Should be pistachio `#B9C9A3` | A grey flash on every launch; needs one iPhone build |
| App Store listing | "Scales: Weigh Your Thoughts", "Is it true? Do you live it?", Plus screenshots | New subtitle, new screenshots, no Plus | Review rejects a listing that does not match the app |
| Quotes, voices, replies, Ledger, activity | `scales.quotes.v1`, `scales.activity.v1`, `scales.prefs.v1` | Not carried; the data stays on the phone, untouched | None, as long as nothing deletes it |

## Steps

Model notes, as in the build plan: **Opus** for data safety and judgment; **Sonnet** for well-specified building,
tests and shipping; **Haiku** for mechanical edits.

| # | Step | Model | Done when |
|---|---|---|---|
| S1 | **Catch-up import.** `mergeOld(store, old)` in `next/core.js`: adds any thought from the current app that the new one does not have (matched by `o` + old id), and never overwrites a thought already in the new app. Runs on every open until the swap, so thoughts written in the current app during the trial still arrive. Tests: new, edited, deleted and put-away cases | Opus | Tests pass; a thought written in the current app shows up in the new one on next open |
| S2 | **Daily save.** The new app sends the shell's `save` message once a day (same JSON shape idea, its own file name `Scales next backup.json`), and sends `ready` so the shell's queued scripts run | Sonnet | In the iPhone app, the file appears in iCloud Drive, Scales |
| S3 | **Quiet the current app.** On first open of the new app in the iPhone app, send `unschedule` and `badge 0` | Sonnet | No reminder fires the next day; no badge |
| S4 | **Decision point.** Graham confirms: 7 days used, nothing lost, open questions answered | Graham | A yes |
| S5 | **Full backup before the swap.** The new app's Back up, plus the current app's own export, saved to Files | Graham, guided | Two files in Files |
| S6 | **Swap the web app.** Move the current app to `/app/classic/` (its own files, worker scope and cache, still reading `scales.thoughts.v1`). Move `next/` to `/app/`. `/app/next/` redirects to `/app/`. Version 2.0.0. The new root worker clears only `scales-v` caches that are not its own. Library link becomes "Open the old Scales" pointing at `/app/classic/` | Sonnet builds, Opus reviews | Both load at 390 px; the iPhone app opens the new Scales with no new build; tests and the browser check pass |
| S7 | **Stop selling Plus.** In App Store Connect, remove Plus from sale (Graham, or his assistant, from exact steps). Set `PLUS_PREVIEW=off`. The shell's StoreKit code stays, unused, until S8 | Graham | Plus no longer offered |
| S8 | **One iPhone build.** Load colour pistachio; drop the Plus, icon and reminder code from the shell (or leave it dormant, see questions); bump the build | Sonnet builds, Opus reviews the removal | TestFlight build installs and opens the new Scales with no grey flash |
| S9 | **Listing.** New subtitle, description and screenshots from the new app; then submit for review | Opus writes, Graham approves | Submitted |
| S10 | **Cleanup, 30 days later.** Remove `/app/classic/` only if Graham agrees; the old data key is never deleted | Sonnet | Graham says so |

## Rollback

- **Web (S6):** revert the merge commit and let Pages redeploy, about a minute. The iPhone app shows the current
  app again on next open. Both apps' data is untouched, because neither writes to the other's key.
- **iPhone build (S8):** expire the TestFlight build; the previous build still loads the web app.
- **Data:** no step deletes `scales.thoughts.v1` or `scales.next.thoughts.v1`. The S5 files are the last line.

## Things to know during the trial (now)

- Until S1 ships, the new Scales copied your thoughts once, on its first open. A thought you write in the current app
  after that will not appear in the new one. Write new thoughts in the new app while you try it.
- Reminders from the current app still fire, and tapping one opens the current app.

## Open questions for Graham

1. Plus: is anyone other than you on it (TestFlight testers with a preview)? If not, S7 is simple.
2. Drop the shell's Plus, icon and reminder code in S8, or leave it dormant in case AI comes back?
3. Does the new Scales need a reminder at all, or does it stay something you open, never something that calls you?
4. Keep the App Store name "Scales" with a new subtitle? A suggestion to react to: "One thought at a time."
5. Keep `/app/classic/` for 30 days, or longer?
