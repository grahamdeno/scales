# Website plan: scales.tangomike.app for Scales 2

Words and page plan by Opus; build by Sonnet. Build after Scales 2.1.0 ships (`docs/2.1-plan.md`), which changes
the times and two support answers. The words below are final unless Graham changes them; the builder uses
them as written. Plain words, no em-dashes, no military metaphors.

## Build notes (for Sonnet)

- Pages: `site/index.html`, `site/support.html`, `site/privacy.html`, `site/404.html`, one stylesheet `site/site.css`.
  Keep the strict CSP in `site/_headers`: no inline styles, no scripts, images and fonts from the site only.
- Look: the app's two grounds, no accent colour. Pistachio `#B9C9A3` with ink `#2A1E2E` on top; the lower part of the
  landing page is a plum `#3B2240` sheet with bone `#F1E9D8` text and `#BBA7BE` muted text, rounded top corners
  (22px), like the library rising from the strip. Geist (already in `site/fonts`). Buttons are pills: plum with bone
  text on pistachio; pistachio with ink text on plum. No blue, no smoke.
- Screenshots: make them from the real app with Playwright at 390 x 844, device scale 3, seeded with the sample
  thoughts below. Save as `site/img/shot-meet.png` (one thought), `site/img/shot-library.png` (library open, All), and
  `site/img/shot-pull.png` (mid pull-down, "Put away" hint showing). Phone frame as today (`.phone`).
- Sample thoughts for the screenshots: "Most problems are smaller than the dread before them." (skipped 3 times, so it
  is bold), "Rest is part of the work.", "Say the hard thing early, while it is still small.", "Finish the day before
  starting the next one.", "I am not my first reaction."; put away: "Be present, need little.", "Ask one more question
  than feels polite."
- Remove what Scales 2 no longer has: the thinker drawings (`img/*.svg`), `shot-ledger.png`, `shot-question.png`,
  `shot-today.png`, the price section, the voices section, every mention of Plus, AI, Skip, Reflect, Lived, the Ledger,
  Wikiquote and reminders.
- Icons: keep `favicon.ico`, `favicon.png`, `apple-touch-icon.png`, `img/icon.png` and their `?v=fulcrum` addresses.
- `<title>`: "Scales: One thought at a time"; meta description: the hero lede. Support: "Scales Support"; Privacy:
  "Scales Privacy".
- `.github/workflows/site.yml` live checks: `/` must contain "One thought at a time"; `/site.css` must contain
  `--pist`. Keep the `/api/ai` 402 check (the dormant server is still deployed).
- Check: every page at 375, 390 and 430 wide and at 1280 wide, no horizontal scroll, no console errors (CSP
  violations show there). Send Graham screenshots before merging.

## Landing page (`/`)

Nav: Scales (icon) · Support · Privacy · button "Get the iPhone beta"
(`mailto:support@tangomike.app?subject=%5BScales%5D%20Beta%20invite`)

### Hero (pistachio)

**One thought at a time.**

Write down what's on your mind. Scales hands it back later, one thought at a time, and notices how long you stay
with each one.

Buttons: "Get the iPhone beta" · "Open in your browser" (`/app/`)

Small: Free. No account. Your thoughts stay on your phone.

Image: `shot-meet.png` in the phone frame.

### The plum sheet begins

**How it works** (kicker)

**Two moves. That's all.**

- **Swipe up.** Move on. It comes back another day.
- **Pull down.** Put it away. It waits in your list, one tap from coming back.
- **Tap.** Edit it, or add a note about what came up.

Changed your mind? Undo stays on screen for five seconds.

Image: `shot-pull.png`.

---

**No buttons to judge it** (kicker)

**Scales reads the pause.**

There's no rating, no streak and no "done". Scales notices one thing: how long a thought stays on your screen.

- **A glance,** 20 seconds or less. It comes back tomorrow, a little bolder.
- **A real look,** 30 seconds or more. It rests longer each time.
- **An edit or a note.** It rests longest.

The thoughts you keep glancing past come first, in heavier type. What you avoid shows instead of hiding.

---

**Your thoughts** (kicker)

**Nothing disappears on its own.**

Everything you've written is in Your thoughts, the strip at the bottom of the screen. Pull it up to search, see what's
coming back and when, and bring back anything you put away.

Image: `shot-library.png`.

---

**Private by default** (kicker)

**Yours, on your phone.**

- **No account.** Nothing to sign up for.
- **Nothing you write leaves your phone.** No AI, no ads, no tracking.
- **A daily copy in your own iCloud Drive.** The iPhone app saves everything once a day, without asking.

---

**One thought at a time.**

Start in your browser now. The iPhone app is in beta; ask and we'll send you an invite.

Buttons: "Get the iPhone beta" · "Open in your browser"

Footer: Made by Graham D. at tangomike.app · Support · Privacy · support@tangomike.app

## Support (`/support`)

**Support.**

Questions about Scales, answered plainly. If yours isn't here, write to us and a person answers.

**Ask anything.** Email support@tangomike.app. Put Scales in the subject so it reaches the right inbox. Most answers
come within two days. Button: "Email support"

### Using Scales

**What do I put in Scales?**
Anything on your mind that you want to come back to: a line from a book, something someone said, a rule you're trying
to keep. One sentence is enough.

**How do I move between thoughts?**
Swipe up to move on. Pull down to put a thought away. Tap it to edit it or add a note. After either move, Undo stays on
screen for five seconds.

**Why did a thought come back so soon?**
A glance of 20 seconds or less brings it back the next day. Stay with it for 30 seconds or more and it rests longer each
time. Edit it or add a note and it rests longest.

**Why is one thought in bolder type?**
You've glanced past it before. Each time sets it a little heavier and moves it toward the front. Staying with it
lightens it again.

**Where did a thought go?**
Pull up Your thoughts at the bottom of the screen and choose Put away. Tap Bring back and it returns tomorrow.

**How many thoughts show up each day?**
Every thought that's due. When none are left, Scales says when the next one is back.

**How do I delete a thought?**
Tap it, then tap Delete twice. Tap anywhere else to cancel.

### Your data

**Where are my thoughts kept?**
On your phone. The iPhone app also saves everything once a day, and when you leave it, to iCloud Drive, Scales (or
Files, On My iPhone, Scales when iCloud is off).

**Can I make a backup myself?**
Yes. Pull up Your thoughts and tap Back up at the bottom of the list.

**How do I move to a new phone?**
Restoring from a backup isn't in Scales yet. Keep your backups in iCloud Drive and email us; we'll help you bring
your thoughts across.

**How do I delete everything?**
Delete the app. Then remove the Scales folder in iCloud Drive if you don't want the backups. Nothing is kept anywhere
else.

## Privacy (`/privacy`)

**Privacy.**

Short version: everything you write stays on your phone. There's no account, no AI, no ads and no tracking.

Three cards:
- **On your phone.** Your thoughts and notes. Saved daily to your own iCloud Drive.
- **Leaves your phone.** Nothing you write.
- **Never.** Ads, tracking, selling data, or an account.

### What stays on your phone

Everything you write: your thoughts, your notes, and when each one comes back. It's stored in the app on your device.
The iPhone app saves a copy once a day to iCloud Drive, Scales, which is your iCloud, not ours. We can't see it.

### What leaves your phone

Nothing you write. Opening Scales loads the app from scales.tangomike.app, like opening any website; the hosting
services see that request, not your thoughts. Scales sends no reminders and makes no other requests.

### What we never do

No ads. No analytics or tracking across apps and websites. No selling or sharing data. No account, so there's nothing
about you on our side to leak.

### Deleting your data

Delete the app to remove everything on your phone, and the Scales folder in iCloud Drive to remove the backups. Because
we keep nothing, there's nothing to request from us.

### Children

Scales isn't made for children under 13 and doesn't knowingly collect anything from them.

### Changes and contact

If this changes, the date below changes. Questions: support@tangomike.app.

Effective October 29, 2026.

## 404

**Not here.** That page doesn't exist. Scales is on the home page, and the app opens in your browser at /app/.

Buttons: "Home" · "Open the app"

## For Graham

- **Restore is missing.** Scales 2 saves backups but can't read one back. The support page says so honestly. Adding
  Restore (a file picker in the library that merges a backup, never overwriting) is a small Sonnet job; worth doing
  before anyone else installs it.
- The hero line "and notices how long you stay with each one" is the one claim that may feel watched. Alternative:
  "and lets how long you stay decide when it comes back."
