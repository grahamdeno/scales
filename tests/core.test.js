// Tests for core.js and for the wiring that keeps the installed app in sync.
// Run with: node --test   (Node 18 or later, no dependencies)

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../core.js");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

// Small seeded generator so weighted draws are repeatable.
function lcg(seed) {
  let x = seed >>> 0;
  return () => ((x = (1664525 * x + 1013904223) >>> 0) / 4294967296);
}
const item = (id, skip_count = 0, text = "Principle " + id) => ({ id, skip_count, text });

test("version matches the service worker cache name", () => {
  const m = read("sw.js").match(/const CACHE = "scales-v(\d+)"/);
  assert.ok(m, "CACHE constant not found in sw.js");
  assert.equal(Number(m[1]), C.VERSION);
});

test("core.js is loaded by the page and cached for offline use", () => {
  assert.match(read("index.html"), /<script src="core\.js"><\/script>\s*<script>/);
  assert.match(read("sw.js"), /"core\.js"/);
});

test("weight rises 0.5 per skip and caps at CAP", () => {
  assert.equal(C.weight(item("a", 0)), 1);
  assert.equal(C.weight(item("a", 2)), 2);
  assert.equal(C.weight(item("a", 6)), C.CAP);
  assert.equal(C.weight(item("a", 50)), C.CAP);
});

test("tier groups skip counts into 0, 1 and 3", () => {
  assert.deepEqual([0, 1, 2, 3, 9].map(C.tier), [0, 1, 1, 3, 3]);
});

test("pickFrom returns null for an empty deck", () => {
  assert.equal(C.pickFrom([], []), null);
});

test("pickFrom leaves out the last 3 shown when the deck has more than 3", () => {
  const pool = ["a", "b", "c", "d", "e"].map((id) => item(id));
  const rand = lcg(1);
  for (let i = 0; i < 200; i++) {
    const p = C.pickFrom(pool, ["a", "b", "c"], rand);
    assert.ok(["d", "e"].includes(p.id), "picked " + p.id);
  }
});

test("pickFrom leaves out only the last 1 shown in a deck of 3 or fewer", () => {
  const pool = ["a", "b", "c"].map((id) => item(id));
  const rand = lcg(2), seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(C.pickFrom(pool, ["a", "b", "c"], rand).id);
  assert.deepEqual([...seen].sort(), ["a", "b"]);
});

test("pickFrom falls back to the whole deck when everything is on cooldown", () => {
  const pool = [item("a")];
  assert.equal(C.pickFrom(pool, ["a"], lcg(3)).id, "a");
});

test("pickFrom shows avoided principles more often, in proportion to weight", () => {
  const pool = [item("fresh", 0), item("avoided", 6)]; // weights 1 and 4
  const rand = lcg(4), n = 20000;
  let avoided = 0;
  for (let i = 0; i < n; i++) if (C.pickFrom(pool, [], rand).id === "avoided") avoided++;
  const share = avoided / n;
  assert.ok(share > 0.77 && share < 0.83, "avoided share was " + share.toFixed(3));
});

test("clean keeps the first line and strips labels, quotes and dashes", () => {
  assert.equal(C.clean('Line: "What does this cost you?"\nSecond line'), "What does this cost you?");
  assert.equal(C.clean("Rest is work — or is it?"), "Rest is work. or is it?");
  assert.equal(C.clean("  \n\n  "), "");
});

test("fit trims long answers to whole sentences", () => {
  const s = "What would change if this were true? " + "word ".repeat(30).trim() + ".";
  assert.equal(C.fit(s), "What would change if this were true?");
  assert.equal(C.fit("word ".repeat(30).trim() + "."), "");
  assert.equal(C.fit("Short enough."), "Short enough.");
});

test("vet accepts a line that names a short principle (regression)", () => {
  const t = { text: "Discipline is freedom" };
  const v = C.vet("If discipline is freedom, what are you choosing to stay bound by?", t);
  assert.ok(v.line, "rejected: " + v.reason);
});

test("vet rejects empty, overlong, cheerful and echoing answers", () => {
  const long = { text: "The hard conversation is usually shorter than the dread before it, every single time." };
  assert.equal(C.vet("", long).reason, "empty");
  assert.equal(C.vet("word ".repeat(40), long).reason, "too long");
  assert.equal(C.vet("You are doing great!", long).reason, "cheerful tone");
  assert.equal(C.vet(long.text, long).reason, "echoed the thought");
});

test("vet rejects lines that grant grace instead of holding the standard", () => {
  const t = { text: "I train when I said I would." };
  for (const s of ["Be gentle with yourself today.", "Give yourself grace on the hard days.",
                   "It's okay to rest when you need to.", "Self-compassion is part of discipline.",
                   "Allow yourself one more day."]) {
    assert.equal(C.vet(s, t).reason, "softened", s);
  }
  assert.ok(C.vet("What comfort did you buy by skipping it, and what will it cost the man you mean to become?", t).line);
});

test("built-in lines fit the length limit and contain no grace phrases", () => {
  const html = read("index.html");
  const block = html.slice(html.indexOf("var FALLBACK = {"), html.indexOf("};", html.indexOf("var FALLBACK = {")));
  const lines = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.equal(lines.length, 9);
  for (const l of lines) {
    const v = C.vet(l, { text: "x" });
    assert.ok(v.line, l + " rejected: " + v.reason);
  }
});

test("starter decks hold unique principles and every author line is attributed", () => {
  const html = read("index.html");
  const block = html.slice(html.indexOf("var STARTERS = {"), html.indexOf("\n  };", html.indexOf("var STARTERS = {")) + 5);
  const STARTERS = new Function("return " + block.replace(/^var STARTERS = /, "").replace(/;\s*$/, ""))();
  assert.deepEqual(Object.keys(STARTERS), ["stoic", "leadership", "athletic", "overcoming"]);
  const seen = new Set();
  for (const k of Object.keys(STARTERS)) {
    assert.match(html, new RegExp('data-starter="' + k + '"'), "no button for " + k);
    for (const it of STARTERS[k].items) {
      const text = typeof it === "string" ? it : it.text;
      if (typeof it !== "string") assert.ok(it.author, text + " has no author");
      assert.ok(!seen.has(text.toLowerCase()), "duplicate: " + text);
      seen.add(text.toLowerCase());
      assert.doesNotMatch(text, /—/, "em dash in: " + text);
    }
  }
});
