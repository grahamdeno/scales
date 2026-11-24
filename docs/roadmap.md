# Scales roadmap

The running plan for Scales. It follows Graham's playbook (grahamdeno/playbook, version 1.4.0): the process, roles,
rules and item format live there and aren't repeated here. HANDOFF.md holds how the code and shipping work.

**To pick up the work:** read "Where things stand", then "Decision log", then "Release scope".

## Where things stand (22 November 2026)

- Live: App Store 1.1 (2.37.0, build 63), released 20 November 2026. 148 storefronts, EU off.
- Next: 1.2 (items 1 to 3 below), approved 22 November 2026. Handoffs in `docs/handoffs/`. Build by Sonnet in the
  Scales Build chat; Opus reviews.
- 26 November: the timing evaluation (`docs/evaluation-plan.md`). 1.2 does not change the timing rules.

## Uploads and deploys in this repo

- **A push to `main` that touches `ios/**`, `.github/workflows/ios.yml`, `scripts/bundle-web.sh` or
  `scripts/web-files.txt` builds and uploads to TestFlight** (`ios.yml`). Merging such a PR needs Graham's test build go.
- A push to `main` or `release` that touches `site/**`, the web app files, `fonts/**` or `icons/**` deploys the website
  (`site.yml`). Merging such a PR needs Graham's ship go.
- `listing.yml` runs only by hand and never submits.

## Decision log

Newest first.

| Date | Decision | Why |
|---|---|---|
| 22 Nov 2026 | 1.2 scope: box breathing, a custom put-away haptic, Share Sheet import. French and Spanish follow in 1.3. | Graham's picks after the 1.1 release. |
| 22 Nov 2026 | Box breathing grows the words 1.8% (the Gentle size); haptics carry the rhythm. | 3% and 5% were judged distracting. |
| 22 Nov 2026 | New permanent identifiers approved: bundle ID `com.grahamdeno.scales.share`, App Group `group.com.grahamdeno.scales`. | Needed for the Share Sheet extension. |
| 22 Nov 2026 | Not built: a weekly check-in and Apple Intelligence use tracking. | Neither serves the person using the app, and on-device data never reaches Graham. |
| 22 Nov 2026 | Reminders stay off. | No users yet; a reminder is the first step toward nagging. Reopen only if people stop returning. |
| 22 Nov 2026 | Closed stale issues #6, #7, #8, #9, #98, #216. | Done, or written for Scales 1. |

## Release scope

- **1.2:** approved 22 November 2026. Items, in build order: 1 Box breathing, 2 Put-away haptic, 3 Share Sheet import.
- **1.3:** French and Spanish (app text and App Store listing). Not yet shaped.
- **Purchases:** no change (Scales Full, `com.grahamdeno.scales.full`, $6.99).
- **Branch:** reviewed 1.2 PRs collect on `next-1.2` (merge go, no upload); one PR `next-1.2` to `main` makes the
  test build (test build go).
- **Go-aheads:** merge go for #323, #324 (23 November 2026) and #325 (24 November 2026), all into `next-1.2`. Test build go
  "test build 1.2" (24 November 2026): the release PR `next-1.2` to `main`, MARKETING_VERSION 1.2, web 2.38.0.

## Items

### 1. Box breathing (story, approved 22 November 2026)

As a person sitting with a thought, I want the words and the haptics to follow a box-breathing rhythm so that I can
slow down and stay with the thought.

- **Given** Settings, **when** I open Breathing words, **then** I can choose Off, Gentle or Box breathing. Gentle is
  today's behavior. Existing settings carry over: on becomes Gentle, off stays Off.
- **Given** Box breathing, **when** a thought has been on screen 20 seconds untouched, **then** the words grow 1.8% over
  4 s (in), stay 4 s (hold), shrink over 4 s (out), stay 4 s (hold), and repeat. Size is one constant in the code.
- **Given** the iPhone app, **then** a soft haptic rises through each in-breath and falls through each out-breath;
  holds are silent.
- **When** I touch the screen, leave the reading screen or the app goes to the background, **then** words and haptics
  stop at once.
- **Given** Reduce Motion, **then** the words stay still and the haptics still run. The browser app shows the words only.
- **Given** a visit during which box breathing ran, **then** the visit records it, so the evaluation can report those
  visits apart.
- Out of scope: other rhythms, sound, a breathing screen of its own.
- Needs an iPhone build.

### 2. Custom put-away haptic (requirement, approved 22 November 2026)

Putting a thought away plays one custom pattern in place of today's thud plus let-go: a soft lift, a short pause, a low
landing tap that fades, like setting something on a shelf. Checked by feel on Graham's phone; one or two tuning rounds
expected. Falls back to a heavy tap on iPhones without Core Haptics. Needs an iPhone build.

### 3. Share Sheet import (story, approved 22 November 2026)

As a reader, I want to select text in any app and share it to Scales so that a thought I find gets saved without
retyping.

- **Given** selected text in another app, **when** I tap Share, then Scales, **then** a small sheet shows the text
  (editable), an optional Source line, and Keep and Cancel.
- **Given** a shared link with no text, **then** the Source line holds the link and the text starts empty; Keep waits
  for words.
- **When** I tap Keep, **then** the thought is held on the phone and added as a new thought the next time Scales opens.
  Nothing is lost if Scales is closed, and nothing is added twice.
- Nothing leaves the phone. The App Privacy answers do not change.
- Out of scope: images, files, sharing out of Scales.
- Needs an iPhone build and the two approved identifiers (Grok creates them in the Apple Developer portal).
