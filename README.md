# Scales

A small phone app for turning the principles you collect into how you actually live.

You write down a principle you want to live by ("the hard conversation is usually shorter than the dread before it"), or load a starter deck. Scales keeps putting it in front of you. Each time, you mark it Still working on it, Not today, or Living it. Once you act on it without being reminded, it moves to your Living it record with a line on where it showed up.

<p>
  <img src="docs/deck-return.png" width="260" alt="Deck view in the Return theme">
  <img src="docs/ledger.png" width="260" alt="Ledger view showing lived count and history">
  <img src="docs/deck-linen.png" width="260" alt="Deck view in the Linen theme">
</p>

## How it works

**The deck.** One principle on screen at a time. Three moves:

| Move | Gesture | What happens |
|---|---|---|
| Not today | swipe left | Its count goes up by 1. The principle comes back more often. |
| Still working on it | swipe up | Counts as an inspection. If you stayed on the card at least 8 seconds, the not today count drops by 1. |
| Living it | swipe right | Opens a short form for where it showed up, then moves the principle to your record. |

**Editing.** Tap Edit on the card, or Edit on any Ledger row, to change a principle's wording. Its counts, dates and weight are kept. A principle still in the deck gets a fresh AI line for the new wording; a lived one keeps its Living it date, evidence and last line. Principles can be up to 1,500 characters, long enough for a short poem.

**Weighting.** What you set aside comes back more often. A principle's chance of showing up is `1 + 0.5 x not today count`, capped at 4x. A short cooldown keeps the same principle from repeating back to back.

**Pushing back.** The strip under the buttons shows the principles you set aside most, so resistance is visible instead of hidden.

**Starter decks.** Stoic, Leadership, Athletic mindset and Self-overcoming sets, loaded from Settings or the empty deck, so a new deck has something in it. Most lines are original to Scales; the few by Epictetus and Nietzsche are public domain and show their author on the card.

**The ledger.** How many principles you live, share of the deck lived and resisting, average days to live one, each principle's history, and a 12 week activity grid. The Living it list is the record: each principle in full, the last model line it received, and where it showed up, editable later. The Living it and evidence sheets show that last line too, so it is in view while you write.

**The line under each principle.** A short line, 25 words or fewer, drawn from the words of the principle itself and written in the spirit of Jung and Nietzsche: avoidance is treated as the shadow protecting comfort, fear or self-image, and the line speaks for the person you are becoming rather than your comfort today. It holds the standard. No praise, no pep talk, and no grace for the gap between the principle and your conduct. It presses harder the more a principle has been set aside: fresh ones are asked what they demand, set-aside ones what was chosen instead, and the most avoided are confronted with what the avoidance protects. Lines that slip into a gentle, permission-giving tone are rejected and asked for again. Built-in questions are used by default. If you add your own Anthropic API key in Settings, a new consideration is written for each showing by a small, fast model. Only the principle text, its not today count and days in the deck are sent.

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

Optional: Settings (slider icon) > AI line > paste an Anthropic API key > Save key. See [About the API key](#about-the-api-key) first.

To check the key, tap **Test key** under AI line. It sends one tiny request and reports the result in plain terms: working, key not recognized, no credit on the account, rate or spend limit reached, or no connection.

## Your data

- **Back up / Restore** (Settings): a JSON file of the whole deck. Keep it in iCloud Drive. Restore merges, it does not overwrite.
- **Import / Export CSV** (Settings): columns `text,title,author,creationDate,tags,collection,link,citation`, which matches common highlight and quote exports. Export adds `scales_*` columns (status, skips, reflects, shed date, evidence, last model line) so a re-import keeps progress. Import leaves out principles already in the deck. Internal field names (`shed`, `skips`) are unchanged so older exports still import.
- Deleting the home screen icon deletes the data. Back up first.

## Themes

Six themes: Auto (follows the phone's light or dark setting), Moss, Linen, Ink, Dusk and Return. Return is drawn from the Scales icon. Each theme is a set of CSS custom properties, so adding one means adding one block of color values and one entry in the theme list.

## Project layout

```
index.html              the app: markup, styles, UI script
core.js                 pure logic: weighting, selection, answer checks, version
sw.js                   service worker: offline shell, network first
manifest.webmanifest    home screen name, colors, icons
icons/                  app icon, maskable icon, favicons, source SVG
tests/                  node:test suite for core.js and release wiring
docs/                   architecture diagrams and screenshots
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for diagrams of how the pieces fit, how a principle moves from capture to Living it, and what happens each time a card is shown.

No build step and no runtime dependencies. The only outside requests are Google Fonts and, if a key is set, the Anthropic API.

## Design decisions

- **One page, one logic file.** The UI lives in `index.html`. The parts worth testing (weighting, selection, answer checks) live in `core.js`, which the page loads with a plain script tag and the tests load with `require()`. Still nothing to build or install.
- **Network first service worker.** Updates show up the next time the app opens; the cache only covers being offline. API calls are never cached.
- **Built-in questions as the floor.** The app is fully usable with no key and no connection. With a key, the next card's line is fetched while the current card is read, and a built-in line is shown only if the model cannot supply a valid one (25 words or fewer after trimming to whole sentences, no exclamation mark, not a restatement of a long principle).
- **Not today cap at 4x.** Without a cap, one avoided principle would take over the deck.
- **Dwell check on Still working on it.** A quick swipe up should not erase a Not today. Eight seconds on the card is the bar.

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

Every release, patches included, gets a new version number and a matching git tag (`v1.21.0`).

## Updating the live app

1. Set `VERSION` (and `BUILT`) in `core.js` and the matching `CACHE` name in `sw.js` (`scales-v1.21.0`). The tests fail if they differ or if the version is not three numbers.
2. Run `node --test`.
3. Push to `main` and tag the release: `git tag v1.21.0 && git push origin v1.21.0`. GitHub Pages redeploys in about a minute.
4. On the phone, close and reopen Scales, then check Settings > About for the new version number.

## Roadmap

- iOS home screen widget showing the current principle
- Action Button shortcut for Not today and Still working on it
- Whoop recovery as context for when to show the harder principles (kept on device, never sent to the model)

## License

MIT. See [LICENSE](LICENSE).
