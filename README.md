# Scales

A small phone app for turning the principles you collect into how you actually live.

You write down a principle you want to live by ("the hard conversation is usually shorter than the dread before it"), or load a starter deck. Scales keeps putting it in front of you. Each time, you mark it Sit with it, Skip, or Living it. Once you act on it without being reminded, it moves to your Living it record with a line on where it showed up.

<p>
  <img src="docs/deck.png" width="200" alt="The deck at rest: one principle and the ring">
  <img src="docs/deck-push.png" width="200" alt="After letting go early: a line pushing back, and the ring again">
  <img src="docs/deck-reflect.png" width="200" alt="After holding through: a question to sit with, then Next principle">
  <img src="docs/ledger.png" width="200" alt="Ledger view: the weight key and principles grouped as Avoiding, Working on and Nearly lived">
</p>

## How it works

**Writing.** Capture and Edit open on matte paper with black lettering (on the White look, the reverse), so writing reads as a different mode from the deck. Cancel is on the left and Add or Save on the right; the keyboard comes up with the sheet. Capture is one field: where it came from, collection, title and author are under More details, and the character count shows only near the 1,500 limit.

**First run.** A new deck opens on a short welcome: what Scales is, a starter deck or one principle of your own, then the hold, shown once. The + next to the menu captures a principle anytime.

**The deck.** Quiet until asked. At rest the screen holds one principle and a ring. Press and hold anywhere on the bottom of the screen: after half a second your three choices open above your thumb, Living it, Sit with it and Skip. Slide onto one and let go, or let go and tap one. Letting go never chooses by itself; slide off the list or tap outside it to close it. There is no date and no progress bar. Messages sit at the bottom of the screen, near your thumb.

| Move | Choose | What happens |
|---|---|---|
| Skip | from the choices | Scales pushes back once with a plain line, and offers Later. Skip it rests the principle: its count goes up by 1, it rests, then comes back first and set heavier. |
| Sit with it | from the choices | A real quote from today's voice, where the principle came from, and Talk it through with that voice. After 8 seconds the test counts against Skip (the count drops by 1) and Next principle appears. Nothing moves on by itself. |
| Living it | from the choices | Opens a short form for where it showed up, then moves the principle to your record. |

A quick tap on the ring does nothing, so a stray touch never rests a principle. The three moves are also buttons for VoiceOver and the keyboard, and the arrow keys (left, up, right). Everything else (Capture, Edit, Show, the Ledger, Collections, Settings) is in the menu at the top right. With a keyboard, N captures, E edits, L switches between the deck and the Ledger, M opens the menu, and comma opens Settings.

**The pushback and the quote.** When you choose Skip, one plain line pushes back, written by AI from the principle's own words and its record: nothing invented about your day, no metaphors. On Sit with it, the screen shows a real quote from today's voice instead of anything written. Scales reads the sourced quotes on that thinker's Wikiquote page (leaving out the disputed and misattributed ones), narrows them to the twenty that share the most words with your principle, and the AI picks the one that speaks to it, or none. When none fits, nothing is shown. Without a key, the closest match is shown only if it is a clear one. Each quote shows its author and work, and links to its Wikiquote page (text CC BY-SA 4.0). Both are kept on the principle and reused until you sit with it again or change its wording; a principle that reaches three Skip gets its pushback rewritten once. Each voice's quotes are kept on the phone for 30 days, and only the voice's name is sent to Wikiquote. Press and hold a line or quote to keep it as a principle of its own; a kept quote keeps its author and work.

**Reply to the line.** On the skip screen and the sit-with screen, tap Reply, or the line or quote itself, to answer it. A sheet slides up with the line pinned at the top and moves up with the keyboard, so nothing covers what you type; Done is in the title row. The reply is kept with the line it answered and shows under the line next time. Replying never makes or changes a choice: the choice you were making is still waiting when the sheet closes. In the Ledger, each principle's history shows its thread, line and reply, by date.

**Tap to see the line.** At rest, tap the principle to see the line Skip would show, and tap again to hide it. Nothing is chosen or counted. Once it has been read, Skip in the choices rests the principle straight away and Later is offered beside it. Skip without the tap still asks first, with the line.

**Later.** On the skip screen, or after tapping to see the line, Later is for a principle that deserves more time than you have right now. It is not a skip: no count, no weight, no rest. It waits until after 6 PM that day, then comes back first, headed Saved from earlier, with its quote. Nothing is counted until you choose: press and hold for Living it, Sit with it or Skip it (which rests it straight away). Up to three can wait at once, and a principle that came back from Later is not offered Later again until you have sat with it for the full eight seconds.

**Readable and reachable.** Text follows the iPhone's text size (Settings > Display & Brightness > Text Size). Undo stays for 8 seconds, or until your next move once VoiceOver or a keyboard reaches it. Settings > Your deck > Buttons instead of press and hold puts Skip, Sit with it and Living it on the main screen as plain buttons, for anyone who cannot press and hold.

**Show.** The deck draws from every collection by default. Show, in the menu, draws it from one; the chosen collection is named at the top of the deck.

**Editing.** Press and hold the principle, choose Edit this principle in the menu (or press E), or Edit on any Ledger row, to change a principle's wording or its details: collection, title, author and where it came from. Its counts, dates and weight are kept. Changing the wording of a principle still in the deck gets it a fresh AI line; changing only details keeps the line it has. A lived principle keeps its Living it date, evidence and last line either way. Principles can be up to 1,500 characters, long enough for a short poem. The Capture sheet has the same details under More details, collapsed by default.

**Weight.** A principle is set heavier each time you skip it: a new one is regular weight, and four or more Skip make it the boldest the type goes. Sit with it brings the count down, so the words lighten as the avoidance is worked off.

**Where it came from.** On Sit with it: its collection, where it came from and its author. Settings > Look > Show where it came from turns these off.

**Collections.** A collection groups principles, such as Poems or Stoic, and Show uses them to focus the deck. Typing a collection that matches an existing one apart from capitalization saves it under the existing spelling, so collections don't split. Settings > Manage collections lists every collection with its count; tap one to rename it, merge it into another by renaming it to that name, or remove it. Only the collection changes; everything else on each principle is kept.

**Rest and the front of the stack.** Skip rests a principle for four days by default, so a reflex skip each morning can't become a habit. Settings > Your deck > Rest after Skip changes it, from 1 to 7 days, starting with the next Skip. A Scales day runs from 4:00 AM to 4:00 AM, so a late-night session counts as the day it started in. On the morning it returns, every principle skipped since its last turn comes up first, once each: most avoided first, then the one waiting longest. After its turn it rejoins the weighted draw. If everything is resting, the deck says Nothing left today and when the next principle returns, with Show anyway to bring resting principles back until the day ends. Show on a Ledger row opens that principle on the deck, even while it rests.

**Today's set.** Each day starts with a set of principles, five by default (Settings > Your deck > Principles a day, 1 to 20). When the set is done, the deck says Done for today and sums up how it went. Keep going opens the deck again if you want more.

**Caught it.** When you live a principle without the app, open it in the Ledger and log where it showed up: real-life evidence. Three catches within 30 days ask whether you are ready to call it Living it.

**This week.** One line under the Ledger summary: moves this week, catches, and anything now living.

**Reminders.** Reminders built into Scales come with the iPhone app, scheduled on the device. Until then, Settings > Reminders walks through an iPhone Shortcuts automation: one in the morning for today's set, one after 6 PM for anything saved for Later. It does not open a link, because a link opens Safari, which keeps a separate copy of the data from the Home Screen app. (1.51.0 to 1.57.0 sent web push from a GitHub schedule; 1.58.0 removed it, since it could only ever reach one phone.)

**Weighting.** What you skip comes back more often. A principle's chance of showing up is `1 + 0.5 x skip count`, capped at 4x. A short cooldown keeps the same principle from repeating back to back.

**Pushing back.** The Ledger opens on Avoiding, the principles you skip most, so resistance is visible instead of hidden.

**Undo.** Skip, Sit with it, Living it, Later and Delete each show a toast with Undo that puts everything back, counts, rest days, the activity grid and the Ledger included. It goes after 8 seconds or at your next move, whichever comes first.

**Starter decks.** Stoic, Leadership, Athletic mindset and Self-overcoming sets, loaded on first run, from the empty deck, or Settings > Advanced, so a new deck has something in it. Every starter principle fills every field (collection, title, author, origin, tags, link and citation) as a worked example. Original lines are credited to Scales and cite their deck. The lines by Epictetus and Nietzsche use the exact wording of a named public-domain translation (Elizabeth Carter, George Long, Thomas Common), cite the work and section, and link to that chapter. Loading a deck again adds nothing new; it fills any empty fields on starter principles already in the deck without overwriting your own values.

**The ledger.** A record, not a scorecard. Tabs with counts show one group at a time: Avoiding (skipped three or more times), Working on, Nearly lived (no skips left, and sat with or caught) and Lived. It opens on Avoiding. Each principle shows two lines, set at its group's weight (bold, regular or light), with one fact on the right; resting principles say so. Tap a principle for its full text, its history and everything you can do with it. Under the summary, one line for this week. Below the list, a 12 week grid of days (darker on busier days, solid on days you caught yourself or marked Living it).

**The line under each principle.** A short line, 25 words or fewer, drawn from the words of the principle itself and written in the spirit of Jung and Nietzsche: avoidance is treated as the shadow protecting comfort, fear or self-image, and the line speaks for the person you are becoming rather than your comfort today. It holds the standard. No praise, no pep talk, and no grace for the gap between the principle and your conduct. It presses harder the more a principle has been skipped: fresh ones are asked what they demand, skipped ones what was chosen instead, and the most avoided are confronted with what the avoidance protects. Lines that slip into a gentle, permission-giving tone are rejected and asked for again. Built-in questions are used by default. If you add your own Anthropic API key in Settings, a new consideration is written for each showing by a small, fast model. Only the principle text, its skip count and days in the deck are sent. Settings > Your deck > AI questions and quotes switches AI off.

**Keep an AI line.** Sometimes the line says it better than you did. Tap **Keep** on an AI line (on the deck, or Keep line in the Living it record) and choose:

- **Add as a new principle.** It goes into the same collection beside the original, with fresh counts, cited as "Kept from an AI line" with the date and linked to the original. No author is set.
- **Replace my wording.** It works like Edit: counts, dates and status stay, and only the words change. The earlier wording is saved and shown in the Ledger.

Either one can be undone from the toast. Built-in questions have no Keep, since they are the same for every principle.

**A thinker weighs in.** After a move, **Weigh in** appears under the keys. Tap it and today's voice gives one line on the move you just made: whether Skip was honest or evasive, whether Living it was earned. The voices are Carl Jung, Friedrich Nietzsche, Fyodor Dostoevsky, Epictetus and Marcus Aurelius, plus anyone you add in Settings > Voices. Living people are not built in (1.60.0). One voice weighs in each day, in turn, changing at 4:00 AM.

The point is perspective, not quotation. The model reasons from each thinker's known ideas; nothing is copied from their writing, and every line is labeled as written by AI. Thinkers who have died speak in the first person ("In the spirit of Nietzsche"). Living people are written about in the third person, never voiced; a name you add is treated as living unless you mark it otherwise. The same checks as the AI line apply: short, no exclamation marks, nothing that softens the standard. **Keep** works on these lines too.

**Talk it through.** From the Weigh in sheet you can answer back, up to six replies, and the voice presses on your reasoning. The exchange is saved on the principle; **Talk** on its Ledger row opens it again, where it can be deleted. Weigh in and Talk it through need an API key and send only the principle, the move, its counts and the exchange itself.

## Origin

The name comes from scales falling from the eyes, and from Nietzsche's three metamorphoses: the camel carries ideas, the lion tests them, the child acts from them without thinking. Scales is built for the lion stage.

## Privacy

- Everything lives in the phone's browser storage. No account, no server, no analytics.
- The API key, if used, stays on the phone and is sent only to `api.anthropic.com`, with the principle, its skip count and anything you write to a voice.
- Today's voice's name is sent to Wikiquote (`en.wikiquote.org`) for its quotes. Quotes are Wikiquote text under CC BY-SA 4.0 and link back to their page.
- Settings > Your data says the same in one line.
- Starter decks are written for this app and contain no personal data.

### About the API key

The key is stored in the browser's local storage and sent directly from the phone, using Anthropic's header for browser access. That is a reasonable trade for a personal app with no server, but it has limits worth knowing:

- Anyone with the unlocked phone can read the key from Settings.
- Any script that ran on this page could read it. The app loads no third-party scripts and escapes all user text before display, which keeps that risk low, but it is not zero.

So use a key made only for Scales, and in the Anthropic Console give its workspace a low monthly spend limit (a few dollars covers heavy daily use with a small model). If the phone is lost, revoke the key in the Console. Removing it in Settings only clears it from this phone.
- CSV and JSON files are ignored by git (`.gitignore`) so a personal export never ends up in this repo.

## The iPhone app

`ios/` is Scales for iPhone: the web app in a native shell (`WebViewController.swift`) that loads `https://scales.tangomike.app/app/`, served from this repo's GitHub Pages site through a Cloudflare Worker so the app has its own address. The shell adds what a web app cannot do well on iPhone: reminders scheduled on the phone (Settings > Reminders, morning and evening, each with its own words and badge count, a week ahead, rescheduled whenever something changes) and the Home Screen badge. `.github/workflows/ios.yml` builds it on a cloud Mac; with the App Store Connect key in the repo secrets (`ASC_KEY_P8`, `ASC_KEY_ID`, `ASC_ISSUER_ID`) it signs it and uploads it to TestFlight. The project is generated by XcodeGen from `ios/project.yml`; bundle ID `com.grahamdeno.scales`.

## Install on an iPhone

1. Open `https://grahamdeno.github.io/scales/` in Safari.
2. Share > Add to Home Screen.
3. Open it from the home screen icon. It runs full screen and works offline.

In the iPhone app and at scales.tangomike.app, AI needs no key. Only on the old GitHub Pages address: Settings > Advanced > paste an Anthropic API key > Save key. See [About the API key](#about-the-api-key) first.

To check the key, tap **Test key** under AI key. It sends one tiny request and reports the result in plain terms: working, key not recognized, no credit on the account, rate or spend limit reached, or no connection.

## Your data

- **Back up / Restore** (Settings): a JSON file of the whole deck. Keep it in iCloud Drive. Restore merges, it does not overwrite.
- **Import / Export CSV** (Settings): columns `text,title,author,creationDate,tags,collection,link,citation`, which matches common highlight and quote exports. Export adds `scales_*` columns (status, skips, reflects, shed date, evidence, last model line) so a re-import keeps progress. Import leaves out principles already in the deck. Internal field names (`shed`, `skips`) are unchanged so older exports still import.
- Deleting the home screen icon deletes the data. Back up first.
- **Backup reminders** (as in The Road): once the deck has a principle, Done for today and the Ledger ask for a backup when there has never been one or the last is more than a week old. Not now waits two days. Settings shows when the last backup was. A cancelled share sheet does not count.
- Updates: opening Scales loads the newest release. If it was only resumed from the background, a bar says Scales was updated and stays until you tap Reload.

## The look

**Black and White (1.33.0).** Two flat matte surfaces, Black (the default) and White, chosen in Settings > Look, with a faint grain. No cards, raised keys, glass, shadows or rounded panels: the type carries the page, and lines are hairlines. The one filled control on each sheet is solid ink. One face, Geist, self-hosted so it looks the same offline, set at the weight each principle has earned.

The deck has one gesture, the hold, and shows only what the moment needs: the principle at rest, the pushback after Skip, the quote on Sit with it. Living it ends with a thin ring of ink that opens from the words. With Reduce Motion on, the ink, the springs, the ring and the view transitions are left out.

Earlier looks: 1.27.0 put the principle on a tilting card with a frosted tab bar; 1.28.0 and 1.29.0 followed a serif, front-page system with six color themes; 1.30.0 to 1.32.1 were Matte, with raised keys, frosted glass and swipes. 1.33.0 replaced them. A look chosen before keeps working: Matte opens as Black and Light as White.

## Project layout

```
index.html              the app: markup, styles, UI script
core.js                 pure logic: weighting, selection, answer checks, version
sw.js                   service worker: offline shell, network first
fonts/                  Geist (woff2, latin) and its license (OFL)
manifest.webmanifest    home screen name, colors, icons
icons/                  app icon, maskable icon, favicons, source SVG
tests/                  node:test suite for core.js and release wiring
docs/                   architecture diagrams and screenshots
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for diagrams of how the pieces fit, how a principle moves from capture to Living it, and what happens each time a card is shown.

No build step and no runtime dependencies. The type face is served from `fonts/`; the only outside requests are Wikiquote, for today's voice, and the Anthropic API, only if a key is set.

## Design decisions

- **One page, one logic file.** The UI lives in `index.html`. The parts worth testing (weighting, selection, answer checks) live in `core.js`, which the page loads with a plain script tag and the tests load with `require()`. Still nothing to build or install.
- **Network first service worker.** Updates show up the next time the app opens; the cache only covers being offline. API calls are never cached.
- **Built-in questions as the floor.** The app is fully usable with no key and no connection. With a key, the next card's line is fetched while the current card is read, and a built-in line is shown only if the model cannot supply a valid one (25 words or fewer after trimming to whole sentences, no exclamation mark, not a restatement of a long principle).
- **Skip cap at 4x.** Without a cap, one avoided principle would take over the deck.
- **Eight seconds before Next.** A quick Sit with it should not erase a Skip. Next waits eight seconds, and only then does the count drop.
- **One pushback, not two.** Skip asks once, with a line and Later; Skip it then rests the principle. A second warning would nag.
- **Lines reused, not rewritten.** The same pushback each time is cheaper and honest about the record; it is rewritten once at three Skip so it does not go stale, and both lines are rewritten after Sit with it.
- **A tap is not a move.** The choices open only after half a second of holding, and letting go never chooses, because Skip rests a principle for days.

## Run it locally

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`. The service worker needs `localhost` or HTTPS.

## Tests

```sh
node --test
```

Node 18 or later, no dependencies. `node --test tests/e2e/loop.e2e.js` (needs Playwright) drives the real page at iPhone size through first run, the hold, Skip, tap to see the line, Later and its return, Sit with it and Undo, and Capture; CI runs both. The unit tests cover weighting, the selection cooldown, answer cleanup and checks, and the version and offline-cache wiring. GitHub Actions runs the same command on every push.

## Versioning

Releases are numbered `MAJOR.MINOR.PATCH`:

| Part | When it changes | Example |
|---|---|---|
| Major | Breaking changes, such as a stored-data change that needs migration | 1.21.0 to 2.0.0 |
| Minor | New features and enhancements. Patch resets to 0. | 1.21.0 to 1.22.0 |
| Patch | Defect fixes only | 1.21.0 to 1.21.1 |

Every release, patches included, gets a new version number. GitHub Actions adds the matching git tag (`v1.21.0`) automatically after the tests pass.

## Updating the live app

1. Set `VERSION` (and `BUILT`) in `core.js` and the matching `CACHE` name in `sw.js` (`scales-v1.21.0`). The tests fail if they differ or if the version is not three numbers.
2. Run `node --test`.
3. Push to `main`. GitHub Pages redeploys in about a minute, and once the tests pass, GitHub Actions tags the commit with the new version (`v1.21.0`).
4. On the phone, tap Reload when the bar appears. Settings > Help shows the version.

## Roadmap

- iOS home screen widget showing the current principle
- Action Button shortcut for Skip and Sit with it
- Whoop recovery as context for when to show the harder principles (kept on device, never sent to the model)

## License

MIT. See [LICENSE](LICENSE).
