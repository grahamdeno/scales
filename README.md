# Scales: One thought at a time

Scales shows you one of your own thoughts at a time. There are no buttons to judge it. Swipe up to move on,
pull it down to put it away, tap it to edit it. Scales reads how long you stayed and brings each thought back
on its own schedule. Nothing leaves unless you put it away, and anything put away can be brought back.

Live at `scales.tangomike.app/app/`, and in the iPhone app (a web view of the same page).

## How it works

- **Meet (pistachio):** one thought. Swipe up past 100 px for the next one; pull down past 160 px to put it away.
  Both can be undone for 5 seconds. Tap the thought to edit it.
- **Write and Edit (plum):** "What's on your mind?", Keep. A new thought comes back tomorrow. Edit holds the thought
  and a note; Delete takes two taps, and a tap anywhere else takes the first one back.
- **The library (plum):** the strip at the bottom, "Your thoughts". Pull it up or tap it; pull the sheet down or tap
  outside to shut it. Search, filter (All, In rotation, Put away), Bring back. The gear opens Settings. From 2.13.0
  each row is one line in regular weight with its age on the right (Today, 3d, 5w, 4mo), and All is grouped by when
  the thought was added (This week, This month, Earlier), newest first. + New lives here only (it left the reading
  screen in 2.13.0).
- **Apple Intelligence (2.16.0, iPhone app):** a regular feature wherever Apple's on-device model is on (iPhone 15 Pro
  or later); nothing leaves the phone, and it uses the bridge already in the shell, so no new build. **Argue with it**:
  a word in Edit; one tap shows "The case against" (two or three sentences) and "It assumes" (one line), kept with the
  thought for those words and shown again without asking. Add to note puts the assumption in the note. **Tensions**:
  once a day, three batches of 30 thoughts (shuffled by the day) go to the model, which names pairs that pull against
  each other; Scales checks each pair, keeps the newest 12 and never repeats one. A row in Your thoughts (a dot for new
  pairs) opens them; a pair fills the reading screen with "and yet" between; swipe up or tap to go back.
- **Your thoughts by where you stand (2.15.0):** All opens on "Just seen" (the last five shown, newest first) and four
  groups, each one row with a short line and a count, opened with a tap: Avoiding (3 or more skips in the last 5
  visits; right side "4 of 5"), Sitting with (stayed 30 s or more, or edited, in the last 5; how long ago), Seen, not
  sat with (how long ago), Not met yet (when it arrives). Which groups are open is remembered. A search is one flat
  list with each match's group on the right. Rows stay one line (2.13.0).
- **The quiet line (2.14.0):** on the reading screen, one small faded line under the thought, only when it says
  something: "Skipped 4 of the last 5 times" (3 or more skips in the last 5 visits), or "Here 90 days, never sat with"
  (60 days or more with no visit of 30 s or more and no edit). Otherwise nothing.
- **Edit history (2.13.0):** one quiet line under the thought: "Added 41 days ago · skipped 6 of the last 8 times"
  (the last 10 real visits).
- **Backups (2.13.0):** Settings has one Backups row ("Automatic" in the iPhone app) opening a page with how saving
  works, the last save, Back up now and Restore. The iPhone app saves a copy every time you leave it and keeps 14.
- **Bookmark (2.2.0):** the bookmark at the top right of Edit marks a thought as one to come back to. It never changes
  when the thought returns. The library filters scroll: All, In rotation, Put away, New (the last 14 days), Bookmarked
  (with its count). A thought opened from Bookmarked is a review: nothing about its schedule changes and it is logged as
  `review`.
- **Who said it, sets and a first open (2.3.0):** under a new thought, "Add who said it" opens one line; typing an
  opening quotation mark opens it by itself. Blank means the thought is your own. The name shows quietly under the
  thought, and Edit can change it (not counted as work). An empty Scales opens on Write with an example in the field
  (gone on tap, never shown again) and "Or start with five", which adds five starter lines due today. Settings has
  Sets: Franklin's Virtues, The Stoics, Know Yourself, After Jung, Questions to Sit With (`content/sets.json`, built
  into `sets.js` by `scripts/build-sets.js`). Add brings a set in two lines a day; Remove (two taps) deletes the lines
  not yet shown and puts away the ones met, leaving any you bookmarked, noted or changed. Quotes are in modern English;
  each line's public-domain original is kept in `content/sets.json` and checked by `scripts/verify-sets.js`.
  After "That's all for today": Keep going, Write one, and Bookmarked.
- **Telemetry (2.10.0):** an event log on the phone only (sessions, screens, taps, writes, edits, errors, load time and a
  daily snapshot of the collection), carried in the backup. No thought text is ever in it. `scripts/evaluate.js` reads a
  backup and prints the evaluation in `docs/evaluation-plan.md`.
- **Today's pile (2.9.0, reworked 2.12.0):** a day is up to 30 cards, chosen so the whole collection comes round
  instead of the same cards every day. Of what is due: up to 5 of the most skipped (pile `avoid`), never-met thoughts
  still arriving five a day (`new`), and the rest (`due`) with the one unseen longest first. Avoided and new cards are
  spread evenly through the day, never two of a kind in a row. Ties are shuffled with a seed from the day, so the order
  holds all day and changes the next. A light day tops up to 30 with the longest unseen (`extra`). At 30 the day stops;
  Keep going carries on the same way (`more`) until everything has been seen once today. Every card in the pile is a
  real visit and moves its schedule; only a thought opened from the library is a review. With 176 thoughts the whole
  collection comes round in about a week, and no card repeats from one day to the next. Each visit logs its pile, its
  place in the session, the day size and how its time reads, so the size can be judged from use.
- **Import (2.7.0):** Settings, Import thoughts. Paste a note or list, or choose a text file, a CSV export (a quote
  column, plus author and title if present) or a Kindle "My Clippings.txt". Plain text splits at each line, or at each
  blank line when it has them (switchable). A name after a dash, or alone under a quote, becomes who said it. A preview
  lets you leave lines out; lines you already have are skipped; the rest arrive five a day.
- **Dark (2.5.0):** follows the phone. The reading ground turns plum with bone words, like the Plum icon; Write, Edit,
  the library and Settings go a deeper plum so moving between them still changes ground; pistachio stays the accent,
  and the Put away message turns pistachio so it shows on plum. Colors are tokens (`--ground*`) at the top of index.html.
- **Settings (2.8.0, cards 2.11.0):** each group is a card one step lighter than the page with its label above (Sets and Import use the same cards), and rows show their current value (Sets: how many added, App icon). Grouped as Add thoughts (Sets, Import), Look (Appearance, App icon), Your data (Back up, Restore),
  Help (How Scales works, Send feedback, Support) and About (Privacy, version and build). Appearance is Automatic, Light
  or Dark; Light and Dark hold against the phone and the iPhone app matches its status bar and keyboard (needs build 38
  or later; older builds don't show the choice). App icon has its own page.
- **Settings (2.1.0):** Your data (Back up, Restore from a backup), Help (How Scales works), About (Privacy, Support,
  Send feedback, the version). Privacy is linked here because the App Store requires it inside the app.
- **Reading a visit:** 20 s or less is skipped; 30 s or more is thought about; between is seen; an edit or a note is
  worked on. Time counts only while the app is open and the thought is on screen; over 5 minutes with no touch counts
  as seen.
- **Coming back:** skipped 5 days (2.12.0; was 1); seen 2 days; thought about 2 + 2 per time (21 at most); worked on
  4 + 3 per time (30 at most), counting this visit. Being due makes a thought eligible; the pile decides the order.
  Skipped thoughts are set heavier (600 to 800) and up to 5 a day are kept on purpose. Engaging works off one skip.
- A Scales day starts at 4 AM.

## Wide screens (2.7.0)
On anything wider than 520 px (the iPhone Duo's inner screen, an iPad-sized window, a desktop browser) Scales stays one centered phone-width column. The ground color fills the whole screen. When the Duo runs Scales beside another app, the column simply shrinks to the half-width. No new iPhone build is needed.

## Your data

- Everything stays on the phone (`localStorage`): `scales.next.thoughts.v1`, `scales.next.ui.v1`,
  `scales.next.gone.v1`. The "next" in the names is from the trial and stays, so nothing has to move.
- **Scales 1's data is read, never written.** On the first open its thoughts were copied in (5 a day, most skipped
  first; lived and let-go ones arrive put away). Every open still adds any Scales 1 thought not yet here; a thought
  deleted here is never brought back.
- **Daily save (iPhone app):** at each open and whenever the app goes to the background, everything is saved as
  "Scales backup.json" plus a dated copy (the last 14 kept) in iCloud Drive > Scales, or Files > On My iPhone > Scales.
  The file includes Scales 1's thoughts, settings, activity and quotes exactly as they are (never its API key).
- **Back up** (Settings) saves the same file wherever you choose. **Restore from a backup** (Settings) merges a Scales 2,
  trial or Scales 1 backup file: it adds thoughts this phone does not have and never changes or removes one that is here.
- **Visit log (2.0.1):** every visit is logged with its raw time and the skip and thought lines in force
  (`scales.next.log.v1`, newest 5000; also in the daily backup as `visits`). It is for judging the 20 s and 30 s lines
  from real use.

## Haptics (iPhone app)

Built from the shell's named styles, so new patterns need no app build: put away is a thud, then a fading buzz;
Keep is the signature (rises, lands, zips off); Bring back is medium then success; Undo is medium; Delete is two thuds;
crossing a swipe threshold is a light tick.

## Project layout

- `index.html`: the page (CSS and one script). `core.js`: the logic (visit reading, schedule, import, labels), tested
  in Node. `sw.js`: offline copy, network first. `manifest.webmanifest`, `icons/`, `fonts/`.
- `next/`: the trial address; it forwards to `/app/` keeping `?native=1`, and its worker removes itself.
- `ios/`: the iPhone app, a WKWebView shell loading `https://scales.tangomike.app/app/?native=1`; `Haptics.swift`.
- `site/`: the scales.tangomike.app website. `server/`: the `/app/` proxy and the Scales Plus AI server (dormant).
- `docs/`: `next-plan.md` (how Scales 2 was built) and `swap-plan.md` (how it replaced Scales 1).
- Scales 1 (1.88.0 and earlier) is on the branch `scales-1.88.0` and the tag `v1.88.0`, release notes included.

## Tests

```sh
node --test                      # logic and wiring; no dependencies
node tests/e2e/app.e2e.js        # Playwright at 390, 375 and 430 wide, plus the iPhone bridge
```

CI runs both on every push and pull request.

## Versioning

`MAJOR.MINOR.PATCH`. Each release changes `VERSION` in core.js, the `CACHE` name in sw.js (`scales-v2.0.0`) and the
`core.js?v=` address in index.html and sw.js together; a test checks they match. CI tags `v2.0.0` after tests pass.

## Scales Plus (dormant)

Scales 2 has no AI and Plus is not offered. The iPhone app's StoreKit, icon and reminder code and `server/ai.mjs` stay
in place, unused, in case AI comes back. `tests/platform.test.js` keeps the server's checks.

## License

MIT. See [LICENSE](LICENSE).
