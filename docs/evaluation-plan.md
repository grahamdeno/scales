# Scales evaluation plan: 12 November 2026

**When:** on or after 12 November 2026. A scheduled reminder fires that morning.
**Who:** Graham sends the backup; Claude (Opus) runs the analysis and recommends; Graham decides.
**After it:** Graham decides whether to press Submit for Review on version 1.0 (build 38 attached, manual release).

## How to run it

1. Graham: Scales, Settings, Your data, Back up. Send "Scales backup.json".
2. Claude: `node scripts/evaluate.js "Scales backup.json"` (add `--since 2026-10-30` to start at the day-size change).
3. Claude: read the six sections against the decision rules below, and write the recommendations as one short list.
4. Graham decides. Rule changes are web-only and reach every build, including the one submitted.

## Privacy

Everything below stays on the phone and leaves only inside the backup Graham chooses to send. No thought text is ever
written to the event log: only ids, lengths, counts, screens, taps and timings (a browser test checks this). The App
Store privacy label stays "Data Not Collected".

## What is recorded

**Visit log** (`visits` in the backup; newest 5,000 kept). One entry per card left:

| Field | Meaning | Since |
|---|---|---|
| `at`, `id`, `ms` | when, which thought, time on the card | 2.0 |
| `kind` | skipped, seen, thought, worked, or review (a look that moved no schedule; from 2.12.0 only library opens) | 2.0 |
| `how` | next, away, edit, other | 2.0 |
| `len` | length of the thought | 2.0 |
| `pile` | due, new, avoid (most skipped, up to 5 a day, 2.12.0), extra (top-up), more (Keep going), review, picked (from the library) | 2.9.0 |
| `n` | place in the session (a gap over 5 minutes starts a new session) | 2.9.0 |
| `size` | day size in force (30) | 2.9.0 |
| `cls` | how the time reads, even for a review | 2.9.0 |
| `s` | session id | 2.10.0 |

**Event log** (`events` in the backup; newest 8,000 kept). Every event has `t` (time), `e` (name) and `s` (session):

| Event | Recorded when | Holds |
|---|---|---|
| `session` | app opened, or back after more than 5 minutes away | src (launch, return), hour, weekday |
| `resume` | back within 5 minutes (same session) | time away |
| `session_end` | app hidden or closed | length, cards seen |
| `boot` | each load | version, build, TestFlight, load time to first card, screen size, phone Dark, Appearance, time zone, thought count |
| `snapshot` | first session of each day | total, in rotation, put away, bookmarked, due, waiting, by source, with who said it, with a note, average length, added in 7 days |
| `screen` | any screen or page opened | which |
| `tap` | any button or link | its id (never its text) |
| `swipe_back` | a swipe let go short of the line | distance |
| `closing` | the closing screen shown | limit or done, cards so far today |
| `write` | a thought kept | length, lines, who said it, quoted |
| `edit` | Edit closed | which parts changed: text, note, who, bookmark |
| `undo`, `delete` | undo used; a thought deleted | id; where, and its source |
| `import`, `restore` | an import or restore finished | how many added or skipped |
| `error`, `storage_fail`, `native_fail` | something went wrong | message and place; which store; save or icon |

## The questions, and how each will be decided

**1. Timing lines (20 s skip, 30 s thought).**
Measure: spread of time on real visits (reviews and idle visits left out), the share each pair of lines would call
skipped, seen and thought, and time by length of thought.
Decide: the skip line sits at the natural break between glances and reading. The thought line should catch real
dwelling, not ordinary reading speed. If long thoughts take much longer, consider lines that scale with length.

**2. Day size (30).**
Measure: cards per day and per session; median time and share read as thought by place in the session (1-5, 6-10,
11-20, 21-30, 31+); how often the limit is reached and Keep going is tapped.
Decide: if attention on cards 21-30 falls below about 60% of cards 1-10, lower the size to where it holds. If Keep going
cards hold about 80% or more, raise it. If the limit is rarely reached, the size is not the constraint.

**3. New thoughts a day (5).**
Measure: thoughts written per day (own, imported, sets) and the line waiting to arrive (daily snapshot).
Decide: if the waiting line grows week over week, raise the drip. If it's empty most days, 5 is fine.

**4. Top-up and Keep going attention.**
Measure: time and share read as thought for due, new, avoid, extra and more, side by side.
Decided early (2.12.0, 1 November): extra and more count as real visits, because as reviews they left the same cards at
the front of the next day. Before 2.12.0 they were logged as `review`; from 2.12.0 they carry a real `kind`. Check now
whether avoid cards hold attention like due cards, and whether 5 a day is the right number.

**4b. Coverage (2.12.0).**
Measure: distinct thoughts seen per 7 and 14 days against the number in rotation; how many of today's cards were also
shown yesterday; longest gap between showings.
Decide: the whole rotation should come round in about a week with no day repeating the last. If not, look at the skip
gap (5 days) and the avoid share (5 a day).

**5. Use: what earns its place.**
Measure: screens and taps by count; sessions by hour and weekday; how cards are left; swipes that spring back; undo
rate; writes, edits and deletes.
Decide structure from use: a feature untouched for the whole window is a candidate to move deeper or remove (except
Back up, Restore and Privacy, which matter rarely but must be there). Frequent spring-backs or undos point to a gesture
problem. The busiest hours inform when a reminder or widget update should land.

**6. Outcomes: does Scales do its job.**
Measure: thoughts put away and days to get there; how many are thought about 0, 1-2 and 3+ times; worked on; skipped 3+
times; notes added.
Decide: thoughts skipped again and again without ever being thought about are candidates for a nudge (edit it, put it
away, or let it go).

**7. Health.**
Measure: page errors, storage and native failures, load time to first card, versions in use, Appearance in use.
Decide: any error is a bug to fix before Submit for Review. Load time over about 1.5 s at the 90th percentile is
worth looking at.

## Limits to keep in mind

- One person and about two weeks: patterns are a guide, not proof. Novelty inflates early use.
- Visits before 30 October have no pile or place; events start with 2.10.0. Use `--since` to compare like with like.
- The logs keep the newest 5,000 visits and 8,000 events; the daily iCloud backup keeps older history.
- A deleted thought takes its visits with it.

## Worth adding later (not built, each needs a decision)

- **One-tap check-in:** once a week, "Did any thought change what you did this week?" Yes or no. The only direct measure
  of whether Scales works; everything else is behavior.
- **How the app was opened:** from the Home Screen icon, a widget or a notification. Needs a new iPhone build.
- **Apple Intelligence use:** how often themes and the week are run, and whether the result is opened again.
