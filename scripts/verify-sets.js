// Checks the public-domain original behind every quoted line in content/sets.json, word for word, against its source text.
// The modern English shown in the app is ours; "original" is what the source actually says.
// Usage: node scripts/verify-sets.js <folder holding the Project Gutenberg texts>
// A line marked "cut" stops before the end of the original sentence; only its final mark is ours.
// Spacing, line breaks, footnote marks like [148], italics underscores and the case of the first letter are ignored.
"use strict";
const fs = require("fs"), path = require("path");
const root = process.argv[2];
if (!root) { console.error("Give the folder that holds the source texts."); process.exit(2); }
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "content", "sets.json"), "utf8"));
const norm = (s) => s.replace(/-[ \t]*\r?\n\s*/g, "-").replace(/\[\d+\]/g, "").replace(/_/g, "").replace(/\s+/g, " ").trim();
const cache = {};
let bad = 0, n = 0;
const ids = new Set();
for (const set of data.sets) {
  for (const it of set.items) {
    if (ids.has(it.id)) { console.log("DUPLICATE id " + it.id); bad++; }
    ids.add(it.id);
    if (!it.src) continue;
    const src = data.sources[it.src];
    if (!src) { console.log("NO SOURCE " + it.id); bad++; continue; }
    if (!cache[it.src]) cache[it.src] = norm(fs.readFileSync(path.join(root, src.file), "utf8"));
    const hay = cache[it.src];
    // A line marked cut ends where the original sentence goes on; its closing mark is ours.
    const t = it.cut ? norm(it.original || "").replace(/[.,;:!?]+$/, "") : norm(it.original || "");
    n++;
    const first = t.slice(1);
    const ok = hay.includes(t) || hay.includes(t[0].toLowerCase() + first) || hay.includes(t[0].toUpperCase() + first);
    console.log((ok ? "ok   " : "MISS ") + it.id + "  " + src.by + ", " + src.title);
    if (!ok) bad++;
  }
}
for (const s of data.starters) if (!ids.has(s)) { console.log("STARTER NOT FOUND " + s); bad++; }
console.log(n + " quoted lines checked, " + (n - bad) + " found word for word, " + bad + " problems");
process.exit(bad ? 1 : 0);
