# Scales 2: how it is built

Current as of 2.35.0 (November 2026). Scales 1 (the Deck, the Ledger, Skip/Reflect/Lived, AI with Scales Plus) ended at
1.88.0; its code is on the branch `scales-1.88.0` and tag `v1.88.0`. Finished plans are in `docs/archive/`.

## The pieces

```
iPhone app (ios/App, Swift)                      Browser (scales.tangomike.app/app/)
  WKWebView at scales-app://local/                 the same web app, from the release branch
  WebScheme.swift serves the bundled web app       no native extras; its own data
  NativeStore keeps a file copy of the data
  bridge: haptics, backup, icon, look, AI
        \                                          /
         +---------- the web app (one page) ------+
           index.html  the screens, gestures, storage, bridge calls
           core.js     every rule: schedule, visits, insights, Argue and Tensions prompts, import, restore
           sets.js     the five sets of lines (built from content/sets.json)
           sw.js       offline cache (browser only)
```

- **One page, no framework, no build step.** `index.html` holds the styles and the screen code; `core.js` holds the
  rules as pure functions (tested in `tests/core.test.js`), exported as `ScalesNext` in the page and `module.exports`
  in Node.
- **The iPhone app is a shell.** `scripts/bundle-web.sh` copies the files listed in `scripts/web-files.txt` into the
  app at build time; nothing loads from the internet. The browser copy is deployed by `.github/workflows/site.yml`
  whenever `release` moves.
- **Versioning.** `VERSION` in core.js, the `CACHE` name in sw.js and the `?v=` addresses in index.html and sw.js move
  together (a test checks). Merging to `main` builds the iPhone app (`ios.yml`) and sends it to TestFlight; moving
  `release` publishes the browser copy.

## Screens

| Screen | Ground | What it does |
|---|---|---|
| Meet | Pistachio | One thought. Swipe up: next. Pull down: put away (Undo, then Say why). Tap: edit. |
| Write | Plum | "What's on your mind?", Keep. A new thought comes back tomorrow. |
| Edit | Plum | Wording, who said it, a note, bookmark, Argue with it, delete (two taps). |
| Argue with it | Plum | The case against, what it assumes, what it would let you off; the case for on request; your answer. |
| Tension | Pistachio | Two of your thoughts that pull against each other; "Not a tension"; ↑ Done. |
| Your thoughts | Plum sheet | Search, an Insight line, filters, Just seen, then groups: Tensions, Avoiding, Sitting with, Seen not sat with, Not met yet, Put away. |
| Settings | Plum | Look (colour, light or dark, icon), Insights, Sets, Import, Backups, How Scales works, About. |

## The schedule (core.js)

| Rule | Value | Why |
|---|---|---|
| A visit 20 s or less (`SKIP_MAX_MS`) | skipped | A glance is not a thought |
| A visit 30 s or more (`THOUGHT_MIN_MS`) | thought about | Time spent is the signal; no buttons to grade |
| 20 to 30 s, or idle over 5 min (`IDLE_MS`) | seen | Phone set down counts for little |
| Editing or a note | worked on | Whatever the time |
| Comes back after a skip | 5 days (`SKIP_GAP`), even through Keep going | "Back in five days" stays true |
| Comes back after seen / thought / worked | 2 days / 2+2n up to 21 / 4+3n up to 30 | Absorbed thoughts fade, never leave |
| Thinking or working on it | takes off one skip | Avoidance can be worked off |
| Type weight (`weight`) | 600 + 50 per skip, to 800 | Avoidance shows in the words |
| A day | 30 cards (`DAY_SIZE`), at most 5 avoided (`AVOID_PER_DAY`), from 4 am (`DAY_START_HOUR`) | Enough, not a backlog |
| New and imported thoughts | imports 5 a day (`IMPORT_PER_DAY`); sets 2 a day (`SET_PER_DAY`) | Arrivals don't swamp the day |
| Order within the day | `nextCard`: avoided, new, due, then extra; spread evenly; seeded by day so it is stable all day | Same order if you reopen |
| Standing (`standing`) | Avoiding, Sitting with, Seen not sat with, Not met yet | The library groups |

Nothing is ever removed by the schedule. Put away and delete are the person's own moves.

## Storage (localStorage, mirrored to a file on iPhone)

| Key | Holds |
|---|---|
| `scales.next.thoughts.v1` | Every thought: text, by, note, created, due, skips/thinks/works, last 30 visits, bookmark, away, kept argument |
| `scales.next.ui.v1` | Settings and one-time hints |
| `scales.next.log.v1` | The visit log (up to `LOG_MAX` 5000), for Insights and the evaluation |
| `scales.next.events.v1` | Counts of what was used, no thought text (up to `EVENTS_MAX` 8000) |
| `scales.next.gone.v1` | Ids of deleted thoughts, so a restore does not bring them back |
| `scales.next.tensions.v1` | Found pairs and pairs marked "Not a tension" |
| `scales.next.ai.v1` | Whether Apple Intelligence is available, and the last argument requests |
| `scales.thoughts.v1`, `scales.prefs.v1`, `scales.activity.v1`, `scales.quotes.v1` | Scales 1 data. Not read since 2.35.0 (it was copied in on first open before that) and not carried in backups |

On iPhone, `NativeStore.js` sends every change to `NativeStore.swift`, which writes `Application Support/Scales/store.json`
(a change to the thoughts at once, anything else within half a second, everything on going to the background) and
puts it back into the page on launch if WebKit's storage was cleared.

## The bridge (page to iPhone)

The page posts to `window.webkit.messageHandlers.scales`:

| Message | The app |
|---|---|
| `ready` | Sends queued calls, the icon and the accessibility state |
| `store` | NativeStore: saves the change |
| `haptic` | Plays a named pattern (Haptics.swift) |
| `save` | Writes the daily backup to iCloud Drive > Scales (14 dated copies kept) |
| `backup` | Back up now: the share sheet with the backup file |
| `icon`, `look` | Changes the app icon; sets light or dark for the window |
| `aiStatus`, `ai` | Asks whether Apple Intelligence is available; runs an Argue or Tensions prompt on the phone |

The app calls back into the page: `window.scalesNative` (version, build, text scale, TestFlight), `scalesActive`,
`scalesSaved`, `scalesBackedUp`, `scalesIcon`, `scalesIconError`, `scalesTextScale` (Larger Text, capped at 1.5x, the
thought at 1.3x).

## Argue with it and Tensions

Both run only on the phone, with Apple's on-device model (FoundationModels). The prompts are in core.js
(`ARG_INSTRUCTIONS`, `ARG_FOR_INSTRUCTIONS`, `TEN_INSTRUCTIONS`, `TEN_CHECK`); `parseArg`, `parseFor` and the Tensions
parser check every answer and drop anything malformed. Thoughts about self-harm (`PROTECTED_RE`) are never sent. In the
browser both are absent.

## Tests

- `node --test tests/core.test.js tests/platform.test.js`: the rules and the website.
- `node tests/e2e/*.e2e.js`: Playwright at three iPhone widths, with a mock of the iPhone bridge.
- `node tests/audit/run.js`: the UX audit (18 journeys, screen states, 30 simulated days). WebKit and the iPhone
  Simulator (Maestro flows in `tests/audit/maestro/`) run in GitHub Actions; see `docs/audit/`.
