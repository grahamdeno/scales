# Scales

Capture thoughts and inspect them until they become beliefs you live. Installable web app (PWA) hosted on GitHub Pages.

## Deploy

1. Create a public repo named `scales` on GitHub.
2. Upload every file in this folder (keep the `icons` folder and the `.nojekyll` file).
3. Settings > Pages > Source: Deploy from a branch > `main` / `(root)` > Save.
4. Wait about a minute, then open `https://<username>.github.io/scales/` in Safari on the iPhone.
5. Share > Add to Home Screen.

## Setup on the phone

- Settings (slider icon) > AI line: paste an Anthropic API key and tap Save key. Without a key, built-in lines are used.
- The key is stored only on the phone and sent only to api.anthropic.com. Set a monthly spend limit in the Anthropic Console.

## Data

- Thoughts are stored on the phone only (no account, no server).
- Use Settings > Back up regularly and keep the file in iCloud Drive. Restore merges a backup in.
- Settings > Import CSV / Export CSV uses the columns `text,title,author,creationDate,tags,collection,link,citation`. Export adds `scales_*` columns (status, skips, reflects, shed date, evidence) so a re-import keeps progress. Import skips thoughts already in the deck. CSV files are read on the phone and never uploaded; do not commit them to this repo.
- Deleting the home screen icon deletes the data. Back up first.

## Updating

Replace `index.html` in the repo. To force an update of cached files, change `CACHE` in `sw.js` (for example `scales-v2`).
