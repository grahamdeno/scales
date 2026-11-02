# App Store files

Files App Store Connect asks for, kept here so they can be downloaded when setting it up.

- `listing.json`: the listing text (description, promotional text, keywords, subtitle). The workflow "App Store
  listing" reads what is live in App Store Connect; run with write: true, it puts this file on the version being
  prepared. It never submits.
- `screenshots/01-...08-*.png` (1320 x 2868, iPhone 6.9-inch): the listing's screenshots, in order. A caption over a
  real screen in a phone body. Remake with `node scripts/shots.js <folder>` (raw screens, copy the ones used into
  `screenshots/raw`), then `node scripts/appstore.js`.
- `screenshots/raw/`: the same screens without caption or phone body, also 1320 x 2868.
- `plus-review-screenshot.png` (1290 x 2796): the Scales Plus screen, for the subscription's App Review information.

Listing (Scales 2): name "Scales: One Thought at a Time", subtitle "Write it down. Let it return." (2.18.0: eight
screenshots, with Argue with it, Tensions and Insights.) Scales Plus is not offered; the screenshot above
is kept only for the record.
