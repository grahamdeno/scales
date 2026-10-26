# Scales

A small phone app for turning the principles you collect into how you actually live.

You write down a principle you want to live by ("the hard conversation is usually shorter than the dread before it"), or load a starter deck. Scales keeps putting it in front of you. Each time, you mark it Testing it, Not today, or Living it. Once you act on it without being reminded, it moves to your Living it record with a line on where it showed up.

<p>
  <img src="docs/deck.png" width="200" alt="The deck at rest: one principle and the ring">
  <img src="docs/deck-push.png" width="200" alt="After letting go early: a line pushing back, and the ring again">
  <img src="docs/deck-reflect.png" width="200" alt="After holding through: a question to sit with, then Next principle">
  <img src="docs/ledger.png" width="200" alt="Ledger view: the weight key and principles grouped as Avoiding, Working on and Nearly lived">
</p>

## How it works

**The deck.** Quiet until asked. At rest the screen holds one principle and a ring, nothing else. Hold the ring and the words step back and ink in again one by one; the line under the ring says what letting go would do right now.

| Move | Hold the ring | What happens |
|---|---|---|
| Not today | let go early | The app pushes back once: a line to make you think twice, and the ring again. Hold again to stay with it. Let go early a second time, or tap Set aside anyway, and it is set aside: its count goes up by 1, it rests, then comes back more often and set heavier. |
| Testing it | hold until the ring closes (about 2.4 seconds) | A question to sit with, where the principle came from, and Talk it through with today's voice. After 8 seconds the test counts against Not today (the count drops by 1) and Next principle appears. Nothing moves on by itself. |
| Living it | slide up while holding | Opens a short form for where it showed up, then moves the principle to your record. |

A quick tap on the ring does nothing, so a stray touch never rests a principle. The three moves are also buttons for VoiceOver and the keyboard, and the arrow keys (left, up, right). Everything else (Capture, Edit, Show, the Ledger, Collections, Settings) is in the menu at the top right. With a keyboard, N captures, E edits, L switches between the deck and the Ledger, M opens the menu, and comma opens Settings.

**The two lines.** Each principle keeps two written lines: one that pushes back when you let go early, and one to reflect on after you hold through. Both are written in the background while the principle is on screen, so they are ready when needed, and kept on the principle. Coming back to it after a Not today shows the same lines again; a principle that reaches three Not today gets its pushback rewritten once, sharper. Moving on from a Testing it spends both, so the next time it comes up it gets new ones. Changing the wording does the same. Press and hold a written line to keep it as a principle of its own.

**Show.** The deck draws from every collection by default. Show, in the menu, draws it from one; the chosen collection is named at the top of the deck.

**Editing.** Press and hold the principle, choose Edit this principle in the menu (or press E), or Edit on any Ledger row, to change a principle's wording or its details: collection, title, author and where it came from. Its counts, dates and weight are kept. Changing the wording of a principle still in the deck gets it a fresh AI line; changing only details keeps the line it has. A lived principle keeps its Living it date, evidence and last line either way. Principles can be up to 1,500 characters, long enough for a short poem. The Capture sheet has the same details under More details, collapsed by default.

**Weight.** A principle is set heavier each time you set it aside: a new one is regular weight, and four or more Not today make it the boldest the type goes. Testing it brings the count down, so the words lighten as the avoidance is worked off.

**Where it came from.** While you test a principle: its collection, where it came from and its author. Settings > Look > Show where it came from turns these off.

**Collections.** A collection groups principles, such as Poems or Stoic, and Show uses them to focus the deck. Typing a collection that matches an existing one apart from capitalization saves it under the existing spelling, so collections don't split. Settings > Manage collections lists every collection with its count; tap one to rename it, merge it into another by renaming it to that name, or remove it. Only the collection changes; everything else on each principle is kept.

**Rest and the front of the stack.** Not today sets a principle aside for four days by default, so a reflex skip each morning can't become a habit. Settings > Deck > Rest after Not today changes it, from 1 to 7 days, starting with the next Not today. A Scales day runs from 4:00 AM to 4:00 AM, so a late-night session counts as the day it started in. On the morning it returns, every principle set aside since its last turn comes up first, once each: most avoided first, then the one waiting longest. After its turn it rejoins the weighted draw. If everything is resting, the deck says Nothing left today and when the next principle returns, with Show anyway to bring resting principles back until the day ends. Show on a Ledger row opens that principle on the deck, even while it rests.

**Today's set and today's focus.** Each day starts with a set of principles, five by default (Settings > Deck > Today's set, 1 to 20); dots at the top show how far along you are. When the set is done, the deck says Done for today, sums up how it went, and asks which one you will act on today. That one becomes **today's focus** and stays on screen. Keep going opens the deck again if you want more. Every third time you choose Testing it, Scales asks for the smallest act you can take today, and that act appears with today's focus.

**Evening check-in and Caught it.** From 6 PM until the day ends at 4:00 AM, Scales opens on one question about today's focus: did you live it today? Not today, Partly, or Yes. Yes asks where it showed up and logs it as **Caught it**, real-life evidence that you lived the principle without the app. You can also log a catch any time from the menu (Caught it) or from a principle in the Ledger. Three catches within 30 days ask whether you are ready to call it Living it.

**Your week.** On Sunday, Scales opens a short review of the last seven days: how many principles you weighed, how many times you caught yourself, what you now live, and what pushed back most, with one voice weighing in on the week if you ask. It is in the Ledger any day.

**Daily reminder.** Scales has no server, so it cannot send notifications. Settings > Daily reminder walks through an iPhone Shortcuts automation that shows a notification at a time you choose, once for the morning set and once for the evening check-in. It does not open a link, because a link opens Safari, which keeps a separate copy of the data from the Home Screen app.

**Weighting.** What you set aside comes back more often. A principle's chance of showing up is `1 + 0.5 x not today count`, capped at 4x. A short cooldown keeps the same principle from repeating back to back.

**Pushing back.** The In deck list puts the principles you set aside most at the top, and Your week names the one that pushed back most, so resistance is visible instead of hidden.

**Undo and the first card.** Not today, Testing it, Living it and Delete each show a toast with Undo for 5 seconds that puts everything back, counts, rest days, the activity grid and the Ledger included. The first card anyone sees shows the three moves in a small panel; it is dismissed by Got it, a tap outside it, or the first real move, and does not come back.

**Starter decks.** Stoic, Leadership, Athletic mindset and Self-overcoming sets, loaded from Settings or the empty deck, so a new deck has something in it. Every starter principle fills every field (collection, title, author, origin, tags, link and citation) as a worked example. Original lines are credited to Scales and cite their deck. The lines by Epictetus and Nietzsche use the exact wording of a named public-domain translation (Elizabeth Carter, George Long, Thomas Common), cite the work and section, and link to that chapter. Loading a deck again adds nothing new; it fills any empty fields on starter principles already in the deck without overwriting your own values.

**The ledger.** A record, not a scorecard. A key at the top shows what the weights mean, then every principle in the deck at its weight, grouped as Avoiding (set aside three or more times), Working on, and Nearly lived (no Not today left, and tested or caught), each with one short count on the right. Lived principles fold under one row that opens in place. Below them, Your week and a 12 week grid of days (darker on busier days, solid on days you caught yourself or marked Living it). Tap a principle for its history (set aside, smallest acts, catches, talks, wording changes, Living it) and everything you can do with it. The Living it and evidence sheets show the last model line a principle received, so it is in view while you write.

**The line under each principle.** A short line, 25 words or fewer, drawn from the words of the principle itself and written in the spirit of Jung and Nietzsche: avoidance is treated as the shadow protecting comfort, fear or self-image, and the line speaks for the person you are becoming rather than your comfort today. It holds the standard. No praise, no pep talk, and no grace for the gap between the principle and your conduct. It presses harder the more a principle has been set aside: fresh ones are asked what they demand, set-aside ones what was chosen instead, and the most avoided are confronted with what the avoidance protects. Lines that slip into a gentle, permission-giving tone are rejected and asked for again. Built-in questions are used by default. If you add your own Anthropic API key in Settings, a new consideration is written for each showing by a small, fast model. Only the principle text, its not today count and days in the deck are sent. Settings > AI lines can switch model lines off while keeping the key.

**Keep an AI line.** Sometimes the line says it better than you did. Tap **Keep** on an AI line (on the deck, or Keep line in the Living it record) and choose:

- **Add as a new principle.** It goes into the same collection beside the original, with fresh counts, cited as "Kept from an AI line" with the date and linked to the original. No author is set.
- **Replace my wording.** It works like Edit: counts, dates and status stay, and only the words change. The earlier wording is saved and shown in the Ledger.

Either one can be undone from the toast. Built-in questions have no Keep, since they are the same for every principle.

**A thinker weighs in.** After a move, **Weigh in** appears under the keys. Tap it and today's voice gives one line on the move you just made: whether Not today was honest or evasive, whether Living it was earned. The voices are Carl Jung, Friedrich Nietzsche, Fyodor Dostoevsky, Epictetus, Marcus Aurelius, Esther Perel, Jordan Peterson and David Goggins, plus anyone you add in Settings > Voices. One voice weighs in each day, in turn, changing at 4:00 AM.

The point is perspective, not quotation. The model reasons from each thinker's known ideas; nothing is copied from their writing, and every line is labeled as written by AI. Thinkers who have died speak in the first person ("In the spirit of Nietzsche"). Living people are written about in the third person ("Through Goggins's lens"), never voiced; a name you add is treated as living unless you mark it otherwise. The same checks as the AI line apply: short, no exclamation marks, nothing that softens the standard. **Keep** works on these lines too.

**Talk it through.** From the Weigh in sheet you can answer back, up to six replies, and the voice presses on your reasoning. The exchange is saved on the principle; **Talk** on its Ledger row opens it again, where it can be deleted. Weigh in and Talk it through need an API key and send only the principle, the move, its counts and the exchange itself.

## Origin

The name comes from scales falling from the eyes, and from Nietzsche's three metamorphoses: the camel carries ideas, the lion tests them, the child acts from them without thinking. Scales is built for the lion stage.

## Privacy

- Everything lives in the phone's browser storage. No account, no server, no analytics.
- The API key, if used, stays on the phone and is sent only to `api.anthropic.com`.
- Starter decks are written for this app and contain no personal data.

### About the API key

The key is stored in the browser's local storage and sent directly from the phone, using Anthropic's header for browser access. That is a reasonable trade for a personal app with no server, but it has limits worth knowing:

- Anyone with the unlocked phone can read the key from Settings.
- Any script that ran on this page could read it. The app loads no third-party scripts and escapes all user text before display, which keeps that risk low, but it is not zero.

So use a key made only for Scales, and in the Anthropic Console give its workspace a low monthly spend limit (a few dollars covers heavy daily use with a small model). If the phone is lost, revoke the key in the Console. Removing it in Settings only clears it from this phone.
- CSV and JSON files are ignored by git (`.gitignore`) so a personal export never ends up in this repo.

## Install on an iPhone

1. Open `https://grahamdeno.github.io/scales/` in Safari.
2. Share > Add to Home Screen.
3. Open it from the home screen icon. It runs full screen and works offline.

Optional: menu (top right) > Settings > AI lines > paste an Anthropic API key > Save key. See [About the API key](#about-the-api-key) first.

To check the key, tap **Test key** under AI lines. It sends one tiny request and reports the result in plain terms: working, key not recognized, no credit on the account, rate or spend limit reached, or no connection.

## Your data

- **Back up / Restore** (Settings): a JSON file of the whole deck. Keep it in iCloud Drive. Restore merges, it does not overwrite.
- **Import / Export CSV** (Settings): columns `text,title,author,creationDate,tags,collection,link,citation`, which matches common highlight and quote exports. Export adds `scales_*` columns (status, skips, reflects, shed date, evidence, last model line) so a re-import keeps progress. Import leaves out principles already in the deck. Internal field names (`shed`, `skips`) are unchanged so older exports still import.
- Deleting the home screen icon deletes the data. Back up first.

## The look

**Black and White (1.33.0).** Two flat matte surfaces, Black (the default) and White, chosen in Settings > Look, with a faint grain. No cards, raised keys, glass, shadows or rounded panels: the type carries the page, and lines are hairlines. The one filled control on each sheet is solid ink. One face, Geist, self-hosted so it looks the same offline, set at the weight each principle has earned.

The deck has one gesture, the hold, and shows only what the moment needs: the principle and the ring at rest, the pushback after letting go early, the reflection after holding through (1.34.0). Living it ends with a thin ring of ink that opens from the words. With Reduce Motion on, the ink, the springs, the ring and the view transitions are left out.

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

No build step and no runtime dependencies. The type face is served from `fonts/`; the only outside request is the Anthropic API, and only if a key is set.

## Design decisions

- **One page, one logic file.** The UI lives in `index.html`. The parts worth testing (weighting, selection, answer checks) live in `core.js`, which the page loads with a plain script tag and the tests load with `require()`. Still nothing to build or install.
- **Network first service worker.** Updates show up the next time the app opens; the cache only covers being offline. API calls are never cached.
- **Built-in questions as the floor.** The app is fully usable with no key and no connection. With a key, the next card's line is fetched while the current card is read, and a built-in line is shown only if the model cannot supply a valid one (25 words or fewer after trimming to whole sentences, no exclamation mark, not a restatement of a long principle).
- **Not today cap at 4x.** Without a cap, one avoided principle would take over the deck.
- **Eight seconds before Next.** A quick test should not erase a Not today. The reflect screen holds Next back for eight seconds, and only then does the test lower the count.
- **One pushback, not two.** Letting go early a second time sets the principle aside. A second warning would nag.
- **Lines reused, not rewritten.** The same pushback each time is cheaper and honest about the record; it is rewritten once at three Not today so it does not go stale, and both lines are rewritten after a test.
- **A tap is not a move.** A press shorter than 0.3 seconds on the ring does nothing, because Not today rests a principle for days.

## Run it locally

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`. The service worker needs `localhost` or HTTPS.

## Tests

```sh
node --test
```

Node 18 or later, no dependencies. Covers weighting, the selection cooldown, answer cleanup and checks, and the version and offline-cache wiring. GitHub Actions runs the same command on every push.

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
4. On the phone, close and reopen Scales, then check Settings > About for the new version number.

## Roadmap

- iOS home screen widget showing the current principle
- Action Button shortcut for Not today and Testing it
- Whoop recovery as context for when to show the harder principles (kept on device, never sent to the model)

## License

MIT. See [LICENSE](LICENSE).
