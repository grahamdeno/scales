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

test("version is MAJOR.MINOR.PATCH", () => {
  assert.equal(typeof C.VERSION, "string");
  assert.match(C.VERSION, /^\d+\.\d+\.\d+$/);
});

test("version matches the service worker cache name", () => {
  const m = read("sw.js").match(/const CACHE = "scales-v([^"]+)"/);
  assert.ok(m, "CACHE constant not found in sw.js");
  assert.equal(m[1], C.VERSION);
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

test("capture and edit share the principle length limit", () => {
  const html = read("index.html");
  for (const id of ["thoughtInput", "editInput"]) {
    const m = html.match(new RegExp('id="' + id + '"[^>]*maxlength="(\\d+)"'));
    assert.ok(m, id + " has no maxlength");
    assert.equal(Number(m[1]), C.MAX_TEXT, id);
  }
  assert.equal(C.MAX_TEXT, 1500);
});

test("checkEdit blocks empty, unchanged, overlong and duplicate wording", () => {
  const a = { id: "a", text: "I ask before I tell." };
  const b = { id: "b", text: "Stop saying things that make you weak." };
  const list = [a, b];
  assert.equal(C.checkEdit(list, a, "   ").reason, "empty");
  assert.equal(C.checkEdit(list, a, " I ask before I tell. ").reason, "unchanged");
  assert.equal(C.checkEdit(list, a, "x".repeat(C.MAX_TEXT + 1)).reason, "too long");
  const d = C.checkEdit(list, a, "  stop SAYING things   that make you weak.");
  assert.equal(d.reason, "duplicate");
  assert.equal(d.conflict, b);
  assert.ok(C.checkEdit(list, a, "I ask before I tell, every time.").ok);
  assert.ok(C.checkEdit(list, a, "y".repeat(C.MAX_TEXT)).ok);
});

test("applyEdit keeps history and clears model lines only for deck principles", () => {
  const active = { id: "a", text: "Old", status: "active", skip_count: 2, lifetime_skips: 3, reflect_count: 6,
    created_at: "2026-09-20T12:00:00.000Z", recent_lines: ["one", "two"] };
  C.applyEdit(active, "  New wording ");
  assert.equal(active.text, "New wording");
  assert.deepEqual([active.skip_count, active.lifetime_skips, active.reflect_count, active.created_at, active.status],
    [2, 3, 6, "2026-09-20T12:00:00.000Z", "active"]);
  assert.deepEqual(active.recent_lines, []);
  assert.ok(active.edited_at);

  const lived = { id: "b", text: "Old", status: "shed", shed_at: "2026-10-01T12:00:00.000Z", evidence: "Showed up.", recent_lines: ["last"] };
  C.applyEdit(lived, "New");
  assert.equal(lived.text, "New");
  assert.deepEqual([lived.status, lived.shed_at, lived.evidence, lived.recent_lines], ["shed", "2026-10-01T12:00:00.000Z", "Showed up.", ["last"]]);
});

// ---------- 1.22.0: details, labels, collections ----------
const P = (id, extra = {}) => Object.assign({ id, text: "Principle " + id, status: "active", collection: "", title: "", author: "", origin: "",
  skip_count: 1, lifetime_skips: 2, reflect_count: 3, created_at: "2026-09-01T12:00:00.000Z", recent_lines: ["line"] }, extra);

test("collections are counted case-insensitively, most used first", () => {
  const list = [P("a", { collection: "Poems" }), P("b", { collection: "poems" }), P("c", { collection: "Stoic" }),
    P("d", { collection: " " }), P("e", { collection: "Everyday", status: "shed" }), P("f", { collection: "Everyday" }), P("g", { collection: "Everyday" })];
  assert.deepEqual(C.collections(list), [{ name: "Everyday", count: 3 }, { name: "Poems", count: 2 }, { name: "Stoic", count: 1 }]);
});

test("a typed collection takes the spelling of an existing one", () => {
  const list = [P("a", { collection: "Poems" })];
  assert.equal(C.canonCollection(list, "  poems "), "Poems");
  assert.equal(C.canonCollection(list, "New   one"), "New one");
  assert.equal(C.canonCollection(list, "x".repeat(60)).length, C.LIMITS.collection);
  assert.equal(C.canonCollection(list, "   "), "");
});

test("detail-only edits are allowed and keep AI lines; unchanged is blocked", () => {
  const a = P("a", { collection: "Everyday" }), list = [a, P("b", { collection: "Poems" })];
  assert.equal(C.checkEdit(list, a, {}).reason, "unchanged");
  assert.equal(C.checkEdit(list, a, { collection: " everyday " }).reason, "unchanged");
  const r = C.checkEdit(list, a, { collection: "poems", title: " Morning note ", origin: "Chosen" });
  assert.ok(r.ok);
  assert.deepEqual([r.values.collection, r.values.title, r.values.origin], ["Poems", "Morning note", "Chosen"]);
  C.applyEdit(a, { collection: "poems", title: " Morning note ", origin: "Chosen" }, list);
  assert.deepEqual([a.collection, a.title, a.origin, a.recent_lines, a.skip_count, a.reflect_count], ["Poems", "Morning note", "Chosen", ["line"], 1, 3]);
});

test("clearing a detail deletes it, and unknown origins are dropped", () => {
  const a = P("a", { collection: "Poems", title: "T", author: "A", origin: "Chosen" });
  C.applyEdit(a, { collection: "  ", title: "", author: " ", origin: "" }, [a]);
  assert.deepEqual([a.collection, a.title, a.author, a.origin], ["", "", "", ""]);
  assert.equal(C.editValues([a], a, { origin: "Made up" }).origin, "");
});

test("details are cut to their limits", () => {
  const a = P("a");
  const v = C.editValues([a], a, { title: "t".repeat(200), author: "a".repeat(200) });
  assert.equal(v.title.length, C.LIMITS.title);
  assert.equal(v.author.length, C.LIMITS.author);
});

test("card label shows collection over origin, with Principle as the fallback", () => {
  assert.deepEqual(C.label(P("a", { collection: "Athletic mindset", origin: "Handed to me" })), { line1: "Athletic mindset", line2: "Handed to me" });
  assert.deepEqual(C.label(P("a", { collection: "Poems" })), { line1: "Poems", line2: "" });
  assert.deepEqual(C.label(P("a", { origin: "Not sure" })), { line1: "Principle", line2: "Not sure" });
  assert.deepEqual(C.label(P("a")), { line1: "Principle", line2: "" });
});

test("rename moves a whole collection; merging keeps the target's spelling", () => {
  const list = [P("a", { collection: "Stoicism" }), P("b", { collection: "stoicism", status: "shed", evidence: "e" }),
    P("c", { collection: "Stoic" }), P("d", { collection: "Poems" })];
  assert.equal(C.checkRename(list, "Stoicism", "").reason, "empty");
  assert.equal(C.checkRename(list, "Stoicism", "Stoicism").reason, "unchanged");
  assert.equal(C.checkRename(list, "Stoicism", "x".repeat(41)).reason, "too long");
  assert.deepEqual(C.checkRename(list, "Stoicism", "STOIC"), { ok: true, merge: true, target: "Stoic", moving: 2, total: 3 });
  assert.deepEqual(C.checkRename(list, "Poems", "Verse"), { ok: true, merge: false, target: "Verse", moving: 1, total: 1 });
  const before = JSON.stringify(list.map(({ collection, ...rest }) => rest));
  assert.equal(C.renameCollection(list, "Stoicism", "stoic"), 2);
  assert.deepEqual(list.map((t) => t.collection), ["Stoic", "Stoic", "Stoic", "Poems"]);
  assert.equal(JSON.stringify(list.map(({ collection, ...rest }) => rest)), before, "only collection changed");
});

test("remove clears a collection and leaves the principles", () => {
  const list = [P("a", { collection: "Explore This" }), P("b", { collection: "explore this" }), P("c", { collection: "Poems" })];
  assert.equal(C.removeCollection(list, "Explore This"), 2);
  assert.deepEqual(list.map((t) => [t.id, t.collection]), [["a", ""], ["b", ""], ["c", "Poems"]]);
});

test("page sizing stays at the rules confirmed full screen on the Home Screen (1.22.3)", () => {
  const html = read("index.html");
  const last = (re) => { const m = html.match(re); return m[m.length - 1]; };
  const root = last(/\nhtml \{[^}]*\}/g), body = last(/\nbody \{[^}]*\}/g);
  // html: at least the large viewport, never clipped. Clipping it ended the app short (1.22.1, 1.22.2).
  assert.match(root, /height:100%; min-height:100lvh;/);
  assert.doesNotMatch(root, /overflow|dvh|position/);
  // body: the dynamic viewport, not pinned with position:fixed (1.22.2).
  assert.match(body, /height:100%; height:100dvh; overflow:hidden;/);
  assert.doesNotMatch(body, /position:fixed|inset/);
});

test("page offsets from the keyboard and scroll memory are reset in script (1.22.1)", () => {
  const html = read("index.html");
  assert.doesNotMatch(html, /scrollIntoView/, "scrolling an element into view also scrolls the page");
  assert.match(html, /history\.scrollRestoration = "manual"/);
  assert.match(html, /function hide\(\)[^\n]*resetScroll\(\)/);
  assert.match(html, /addEventListener\("focusout"/);
});

test("Settings shows a screen check for real-device layout numbers", () => {
  const html = read("index.html");
  assert.match(html, /id="screenCheck"/);
  assert.match(html, /function screenCheck\(\)/);
});
