#!/usr/bin/env bash
# Copies the Scales web app into a folder, for the iPhone app (ios/web, bundled at build time) or the website.
# Usage: scripts/bundle-web.sh DEST [SRC]   (SRC defaults to the repo root)
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
dest="${1:?destination folder}"; src="${2:-$here}"
rm -rf "$dest"; mkdir -p "$dest"
grep -v -E '^\s*(#|$)' "$here/scripts/web-files.txt" | while read -r f; do
  [ -e "$src/$f" ] || { echo "missing: $f" >&2; exit 1; }
  cp -R "$src/$f" "$dest/"
done
[ -f "$dest/index.html" ] && [ -f "$dest/core.js" ] && [ -f "$dest/sets.js" ] || { echo "web app incomplete in $dest" >&2; exit 1; }
echo "web app copied to $dest ($(find "$dest" -type f | wc -l | tr -d ' ') files)"
