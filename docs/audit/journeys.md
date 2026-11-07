# Scales UX audit: journeys and scoring

The audit walks Scales the way a person uses it, one gesture at a time, and scores each journey. It sits on top of the
functional tests in `tests/e2e/` (which check that features work) and asks a different question: is each job easy,
obvious and safe to do?

Run it with `node tests/audit/run.js`. Results land in `audit-out/` (report, contact sheet, videos, raw JSON).

## Principles the audit holds Scales to

These come from the owner's decisions and from the product's own promise ("One thought at a time").

1. **One job per screen.** The reading screen is for reading. Anything else is one deliberate step away.
2. **Nothing moves unless you moved it.** No thought changes place, disappears or is put away without a gesture.
3. **Every move can be taken back.** Swipe and pull undo for 5 s; destructive actions ask twice.
4. **Plain, blunt words.** Labels say what happens. No em-dashes, no coaching tone, no jargon.
5. **Big, calm targets.** Anything a finger needs to hit is at least 44 by 44 points. No screen shifts under a stray touch.
6. **The collection comes round.** Over a week every thought is met; skipped ones return in 5 days; avoidance pulls but never crowds.
7. **Private and resilient.** Works offline, refuses bad files cleanly, says so when it can't save.

## The journeys

Each journey has a person, a goal, the gestures in order, and a pass condition. "Cost" is the number of deliberate
interactions (tap, swipe, field filled) the walker needed; the target is what a calm, competent first-timer should need.

| # | Journey | Person | Pass condition | Target cost |
|---|---|---|---|---|
| J1 | First run: write the first thought | New, empty app | Heading says what to do; first thought kept; it is told when it comes back | 2 |
| J2 | First run: start with a set | New, empty app | Start with five adds lines and lands on a thought | 1 |
| J3 | Daily session | Regular, 176 thoughts | Swipe through to the day's end (30); the stop screen offers Keep going; no errors | 30 |
| J4 | Put away and undo | Regular | Pull down puts away; Undo restores the same thought in place; the count is right | 2 |
| J5 | Write a new thought mid-session | Regular | + New, type, Keep; back on the same card as before | 3 |
| J6 | Edit, note, bookmark | Regular | Tap opens Edit; change words, add a note, bookmark; Done returns; history shows the change | 6 |
| J7 | Find a thought | Regular | Open the list, search a word, open the hit; filters New and Bookmarked work | 4 |
| J8 | Look back at put away | Regular | Put away row opens, a put-away thought can be brought back | 4 |
| J9 | Import a pasted list | Regular | Paste text, preview splits right, Add; count goes up; new ones drip in | 4 |
| J10 | Add and remove a set | Regular | Add a set, see it counted; remove asks twice and only takes unseen lines | 5 |
| J11 | Back up and restore | Regular | Back up makes a file; a bad file is refused with a clear reason; a good one restores | 6 |
| J12 | Argue with it | Regular, iPhone with Apple Intelligence | Edit, Argue with it, read Against and For, write an answer, back to Edit | 4 |
| J13 | Tensions | Regular, Apple Intelligence | A tension appears, reads clearly, can be dismissed as wrong | 2 |
| J14 | Insights | Regular with history | Insights opens from Settings and only shows sections with something true to say | 3 |
| J15 | Change the look | Any | Stone and Pistachio, Light and Dark all apply at once and persist on reload | 3 |
| J16 | Coming back after two weeks | Regular, away 14 days | Opens to a real card (no wall of debt), no error, pile is the normal size | 0 |
| J17 | Learn how it works | New | How Scales works explains all three gestures and the timing in plain words | 3 |
| J18 | Offline and full storage | Any | A refused save says so and points to Back up now | 1 |

## The 30-day run

`tests/audit/sim.js` runs Scales' real scheduling code (`core.js`) for 30 simulated days over 176 made-up thoughts,
with four kinds of user: steady (every day, the full 30), light (10 a day, 5 days a week), avoider (skips half), and
away (two weeks off in the middle). Each thought has its own pull, so some get skipped far more than others.

It checks:

- **Return:** a skipped thought is due again 5 days later, and shown within 2 days of being due for a steady user.
- **Coverage:** a steady user meets every thought within 7 days.
- **Variety:** day-to-day overlap of the pile stays low (median under 20%).
- **Avoidance cap:** never more than 5 avoid-pile cards in a day.
- **Drip:** new thoughts arrive a few a day, never a flood.
- **Nothing moves on its own:** no thought is put away, deleted or changed except by the simulated user.
- **No starvation:** no thought in rotation goes unseen for more than 14 days for a steady user.

## Rule checks on every screen state

Run on each state the walker visits, in every size and look:

| Check | Rule |
|---|---|
| Tap targets | Visible buttons, links and fields at least 44 x 44 CSS px (Apple HIG). Smaller ones are listed with their size. |
| iOS focus zoom | Text fields at 16 px or more, or iOS zooms the page when one is focused. |
| Contrast | Text against its background at least 4.5:1 (3:1 for 24 px+ or bold 19 px+), WCAG AA. |
| Layout shift | Cumulative layout shift per state under 0.1; no horizontal scroll. |
| Truncation | No visible text cut off by its box. |
| Names | Every button, link and field has a name a screen reader can say. |
| Small text | No visible text under 12 px. |
| Reduced motion | With reduced motion on, nothing animates longer than 0.2 s. |
| Copy | No em-dashes, no exclamation marks in labels, no "please", no "click", no "simply/just/easy". |
| Undo or confirm | Every destructive control either offers Undo or asks twice (walked in J4, J6, J10). |
| Errors | No page errors or console errors. |
| Haptics | The native haptic for each key moment fires (put away, keep, delete), recorded from the iPhone bridge. |

## Scoring

Each journey gets a score out of 100:

| Part | Weight | How |
|---|---|---|
| Task success | 40 | All pass conditions met, or 0 |
| Interaction cost | 20 | Full marks at or under target; minus 5 per extra interaction |
| Clarity | 15 | Copy rules and words-on-screen; minus 3 per violation, minus 5 if a screen shows over 60 words |
| Accessibility | 15 | Tap targets, contrast, names, focus zoom; minus 2 per issue, capped |
| Resilience | 10 | No errors, no layout shift, undo/confirm where needed |

**Feel** (motion, haptics, timing) is not scored by the machine. Videos of each journey are in `audit-out/videos/` for
the owner to watch at normal speed.

**Usability (SUS)** comes only from people. See `docs/audit/human-round.md`.

### Severity of findings (Nielsen, 0 to 4)

| | Meaning |
|---|---|
| 4 | Blocks a job or loses data. Fix before release. |
| 3 | Major: people will get stuck or make mistakes often. Fix soon. |
| 2 | Minor: slows people or causes doubt. |
| 1 | Cosmetic. Fix when nearby. |
| 0 | Not a problem on reflection. |
