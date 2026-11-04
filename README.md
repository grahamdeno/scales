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
- **2.32.0:** Argue with it opens its own page, like a tension: the case against and what it assumes, "and yet", the case
  for (filled in a moment later), what the case against would let you off, and the question with a note to answer it.
  Both cases are shorter (two sentences under 40 words). Edit keeps only the word. Breathing words at 1.8%.
- **2.31.1:** Argue for it instead no longer declines nearly every thought: it asks what the thought gets right, with no SKIP
  rule (the safety check has already run). If it can't make the case, the argument stays with a quiet line, never the crisis note.
- **2.31.0:** Argue with it names what the case against would let you off ("If this wins, you'd be free to"), asks "Which
  would you rather be true? Why?" with Write a note, and can argue for the thought instead (kept with it; never for
  protective thoughts). Refining a thought: after putting one away, Say why waits until the next move; the Say why page has
  "Save reason" and "Save and write the next one", which opens Write with the question from the reason; the two thoughts
  are linked ("Grew from" in Edit, "Led to" in Put away) and the new one shows next.
  Breathing words (branch breathe-test): after 20 seconds with a thought and no touch, its words breathe, about 1% larger
  and back, 4 seconds in and 6 out; any touch stops it; off under Reduce Motion or Settings, Look, Breathing words.
- **2.30.3:** Add to note keeps the whole argument: "Against it: …" and "It assumes: …" (before, only the assumption).
- **2.30.2:** The whole top of Your thoughts drags the sheet closed: search field, insight, chips and gear included. A tap
  still taps; a sideways swipe on the chips still scrolls them.
- **2.30.1:** Onboarding pacing. One spotlight at a time instead of one per launch (an iPhone app is rarely relaunched, so
  that meant days): the next shows once the person has done what the last pointed at (open Edit after the edit hint, and
  Argue with it is pointed out), or after 5 minutes away. "Swipe right to go back" is a clear pill, not faint text. Help
  has "Show the tips again".
- **2.30.0:** Onboarding. The first screen asks one thing ("What's on your mind?") with a lighter example, and offers five
  lines from the sets as a clear second choice. After the first thought of your own, and on the end screen while there are
  fewer than 10 thoughts, two sets are offered (stops after two "Not now"s). One-time hints: a spotlight on tap to edit
  after the third card, on Argue with it at the first Edit, and on Tensions when the first pair appears (one spotlight a
  session, never while typing, read aloud under VoiceOver); a pulse on the strip at 10 thoughts if the list was never
  opened; "Swipe right to go back" the first time a page slides in. Automated browsers see none of it unless ?tips=1.
- **2.29.0:** Tensions tuned on real misses. Questions, long thoughts (over 280 characters) and protective thoughts are
  left out. Batches of 12, about two thirds inside one theme and the rest mixed. A stricter prompt with examples makes the
  model name the conflict; each pair then gets a second look (agree, different things, or opposite) and only "opposite"
  is kept. Pairs marked Not a tension become examples of a miss. Shown and dismissed pairs are counted on the phone.
  The gear in Your thoughts lines up with the search field (2.28.1).
  Pages that slide in from the right (Settings, Insights, Backups and the rest) swipe back to the right to close.
  Delete, armed, turns soft coral with a warning haptic and a 4-second line, then resets; deleting offers Undo for 5 seconds.
  Visits: time with Edit open now counts, and running Argue with it counts as thinking about the thought.
  Your thoughts: no visible title; search and the gear share the top row; one insight a day sits under them and opens
  Insights (which goes back to where it came from). Put away is a row like the others, with "One tap from coming back."
- **2.28.0:** + New moves to the strip at the bottom right, the count sits beside Your thoughts, and the sheet has no
  New of its own. Shutting the sheet, it slides in behind the strip, so its header no longer lingers in the strip's place.
- **2.27.0:** Back up now, in the iPhone app, saves its own file into iCloud Drive, Scales, named with the date and
  time, never replaced or pruned. An automatic copy with no thoughts never replaces one that has some.
- **2.26.0 (build 44):** The iPhone app carries the web app inside it and opens with no connection; every save is also
  kept in a file the app owns, so iOS clearing web storage can't lose a thought. Tensions never uses a thought that
  protects someone. The Apple Intelligence message says why it's off. The browser app is served from Cloudflare.
- **2.25.0:** Fixes from the 1.0 audit. A card left on screen for over 5 minutes now reads as seen (the swipe that ended the
  visit used to reset the idle clock first, so idle was never true; visits before 2.25.0 may count such a card as thought
  about). A save the phone refuses says so, once a session, and points to Backups; a full visit log keeps its newest half
  and tries again. Quiet text no longer fades below 4.5:1 (the quiet line, the history line, the Who said it hint,
  empty library groups, a zero in Insights). Help says a put-away thought waits under Put away; the Sets message says
  "bookmarked"; Insights' "Coming" tags use the findings' own names. The website no longer says beta. The Plus AI server
  (`server/ai.mjs`) is no longer deployed; its code and tests stay.
- **2.24.1:** After Jung reworded further from the translations (darkness, inside, accept, light, fate, roots, irritate,
  shadow), and two sources corrected: "someone in me" is Civilization in Transition (CW 10); "children learn" is The
  Psychology of the Child Archetype (CW 9i, par. 293). Lines already on a phone keep their old words.
- **2.24.0:** First run and a safety line. The very first thought written is due today, so it is the first card the
  person meets ("Kept. Here it is."). Until each move has been made once, "↑ Next" rests faintly above the thought and
  "Put away ↓" below it (static, so Reduce Motion keeps it). The first-run example is "Most things go better when I slow
  down." Argue with it never argues against a thought that protects someone (staying alive or safe, recovery, a
  person's worth): plain cases are caught on the phone before the model is asked, the model answers SKIP for the rest,
  and a guardrail stop reads the same. It shows "This one isn't for arguing with." with 988 (US) or the local emergency
  number. Themes and Your week no longer show raw model errors.
- **2.23.0:** Insights number first: each finding leads with a big number in the accent (or a short word: Early,
  Afternoon, 67%) and a two- or three-word label, so the eye can run down the column. A zero is faded and doesn't open.
  What isn't ready yet is a row of small tags under "Coming as you use Scales".
- **2.22.0:** a second theme, Stone (warm stone to read on, graphite for sheets, pistachio accent; Dark puts the thought
  on graphite with sheets a step darker), chosen in Settings, Look, Colors (called Theme in 2.22.0); Pistachio stays the default. Settings order:
  Insights, Look, Add and back up (Sets, Import thoughts, Backups), Help and about. Tensions: "Not a tension" on the
  pair screen removes the pair for good (with Undo).
- **2.21.0:** Edit is a sheet. It rises over the thought, which stays in view above it (dimmed), with a handle at the
  top. Pull it down, tap above it, or tap Done to keep; Cancel throws changes away. Write still fills the screen.
- **2.20.0:** pull Edit down to keep and close, like Done. The screen follows the finger; past 140 px it closes (a tick
  marks the line), short of it it springs back. Only from the top of the form; with the keyboard up the first pull
  only lowers it. Cancel still throws changes away.
- **2.19.0:** Edit is calmer: who said it is a quiet line right under the thought (tap to change; "Add who said it"
  when blank), then the history line, then two words, "Add a note" and "Argue with it". No labels or boxes; a note is
  plain text you tap to change. Insights is a list of findings, one sentence each with a line under it; the thoughts
  behind a finding open with a tap, one finding at a time; parts without enough history are named in one line at the
  bottom.
- **2.18.0:** Insights always shows all six parts; one with nothing true to say yet says what it waits for. Voices
  drop "After" and anything after a comma ("Epictetus, The Enchiridion" is Epictetus) and need a fifth of visits.
  Website: a "Think it through" section (the three reasons, Argue with it, Tensions, Insights) with real screenshots
  from `scripts/shots.js`; privacy and support updated for Apple Intelligence. App Store: eight new screenshots and
  `appstore/listing.json`.
- **Insights (2.17.0):** Settings, Insights. Counted on the phone from what you did; only parts with something true
  to say are shown. Turning points (skipped 3+ times, mostly, before the last two weeks, sat with since), What you've
  lived (put away in 30 days, with your reason), Rewrites (first words above the words now), Still avoiding (4+ skips
  in three weeks), When you think (time of day of longer visits, 8+ needed), Whose words hold you (share of longer
  visits by who said it, 5+ visits per voice). Rewording a thought keeps its old words (the last 5) from 2.17.0.
- **Say why (2.17.0):** the Put away message offers "Say why", one optional line kept as the reason; the Put away list
  shows it under the thought, tap the words to change it; Bring back clears it.
- **Settings order (2.17.0):** Add thoughts, Insights (Themes and your week when Apple Intelligence is on), Look, Your
  data, Help and about.
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
node tests/e2e/native-store.e2e.js  # the iPhone app's store script, with the shell faked
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
