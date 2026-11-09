// Tests for the parts of Scales outside the page: the website and its deploy workflow.
// (The Scales Plus server and its checks were removed in 2.34.0; git history keeps them.)
// Run with: node --test

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("the website is published whole: strict styles, and the app passed through (1.79.0)", () => {
  const h = fs.readFileSync(path.join(__dirname, "..", "site", "_headers"), "utf8");
  assert.match(h, /style-src 'self';/); assert.doesNotMatch(h, /unsafe-inline/, "no inline styles allowed");
  assert.ok(!fs.existsSync(path.join(__dirname, "..", "server", "app-proxy.js")), "2.26.0: no pass-through; the app is served from the site itself");
  assert.match(h, /\/app\/\n  ! Content-Security-Policy\n  Cache-Control: no-cache\n\/app\/\*\n  ! Content-Security-Policy\n  Cache-Control: no-cache/, "the app keeps its inline code, and is never served stale");
  const wf = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "site.yml"), "utf8");
  assert.doesNotMatch(wf, /cp server\/ai\.mjs/, "the Plus AI server is no longer deployed (2.25.0)"); assert.match(wf, /ref: release/, "the browser app comes from the release branch"); assert.match(wf, /scripts\/bundle-web\.sh out\/app rel/);
});

test("the Scales 2 website: four pages, strict CSP, no inline code, no Scales 1 words, no em-dashes (2.2.0)", () => {
  const pages = ["index", "support", "privacy", "404"];
  for (const p of pages) {
    const h = read("site/" + p + ".html");
    assert.doesNotMatch(h, /<script/i, p + ": no scripts");
    assert.doesNotMatch(h, /\sstyle=|<style/i, p + ": no inline styles");
    assert.doesNotMatch(h, /\u2014/, p + ": no em-dashes");
    for (const bad of ["Scales Plus", "Ledger", "Reflect", "Lived", "Wikiquote", "Weigh your thoughts", "Skip"]) {
      assert.ok(!h.includes(bad), p + " still mentions " + bad);
    }
    assert.match(h, /href="\/site\.css\?v=2\.3\.0"/);
  }
  assert.doesNotMatch(read("site/site.css"), /\u2014|smoke|#0a84ff|blue/i);
  assert.match(read("site/site.css"), /--pist:#B9C9A3/);
  const idx = read("site/index.html");
  for (const w of ["One thought at a time.", "Two moves. That&#39;s all.".replace("&#39;", "'"), "Nothing disappears on its own.", "Yours, on your phone.", "Start with lines worth keeping.", "Stay with a thought and it rests longer.", "Your own thoughts are the hardest to question.", "Hear the other side.", "See where your thoughts disagree.", "See what's changing."])
    assert.ok(idx.includes(w), "landing has: " + w);
  assert.match(read("site/privacy.html"), /Effective November 2, 2026\./); assert.doesNotMatch(read("site/privacy.html"), /no AI/); assert.match(read("site/privacy.html"), /on-device model/);
  const sup = read("site/support.html");
  assert.match(sup, /choose Backups, then Back up now/); assert.match(sup, /in five days/); assert.match(sup, /Apple Intelligence/); assert.match(sup, /Restoring adds what's missing and never\s+overwrites|Restoring adds what's missing and never overwrites/);
  for (const f of ["meet-light.png", "meet-dark.png", "meet-own.png", "pull.png", "library.png", "sets.png", "write.png", "icon.png", "argue.png", "tension.png", "insights.png"]) assert.ok(fs.existsSync(path.join(__dirname, "..", "site", "img", f)), f);
  const wf = read(".github/workflows/site.yml");
  assert.match(wf, /check \/ "One thought at a time"/); assert.match(wf, /check "\/site\.css\?v=2\.3\.0" "--pist"/);
});
