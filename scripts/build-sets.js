// Builds sets.js (what the app loads) from content/sets.json (the reviewed lines with their sources).
// Run after any change to the sets: node scripts/build-sets.js. A test fails if sets.js is out of date.
"use strict";
const fs = require("fs"), path = require("path");
function build() {
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "content", "sets.json"), "utf8"));
  // Who a set is from, in a few words: one or two names, or a count; "Written for Scales" when there is no source.
  const from = (s) => {
    const names = [];
    s.items.forEach((it) => { const n = it.src ? d.sources[it.src].by : it.by; if (n && !names.includes(n)) names.push(n); });
    return !names.length ? "Written for Scales" : names.length <= 2 ? names.join(" and ") : names.length + " writers";
  };
  const sets = d.sets.map((s) => ({
    id: s.id, name: s.name, blurb: s.blurb, from: from(s),
    items: s.items.map((it) => {
      const src = it.src ? d.sources[it.src] : null;
      return { id: it.id, text: it.text, by: src ? src.by + ", " + src.title : (it.by || "") };
    })
  }));
  const body = JSON.stringify({ starters: d.starters, sets }, null, 1);
  return "// Built from content/sets.json by scripts/build-sets.js. Do not edit by hand.\n" +
    "(function (root) { var S = " + body + ";\n" +
    "  if (typeof module !== \"undefined\" && module.exports) module.exports = S; else root.ScalesSets = S; })(this);\n";
}
if (require.main === module) { fs.writeFileSync(path.join(__dirname, "..", "sets.js"), build()); console.log("sets.js written"); }
module.exports = build;
