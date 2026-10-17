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

// Evaluate the STARTERS data from index.html, with its O() helper and README constant.
function starters() {
  const html = read("index.html");
  const from = html.indexOf("  var README = ");
  const to = html.indexOf("\n  };", html.indexOf("var STARTERS = {", from)) + 5;
  return new Function(html.slice(from, to) + "\nreturn STARTERS;")();
}

test("starter decks hold unique principles, each with a button", () => {
  const html = read("index.html"), S = starters();
  assert.deepEqual(Object.keys(S), ["stoic", "leadership", "athletic", "overcoming"]);
  const seen = new Set();
  for (const k of Object.keys(S)) {
    assert.match(html, new RegExp('data-starter="' + k + '"'), "no button for " + k);
    for (const it of S[k].items) {
      assert.ok(!seen.has(it.text.toLowerCase()), "duplicate: " + it.text);
      seen.add(it.text.toLowerCase());
      assert.doesNotMatch(it.text, /\u2014/, "em dash in: " + it.text);
    }
  }
});

test("every starter principle fills every field (Story 8)", () => {
  const S = starters();
  for (const k of Object.keys(S)) for (const it of S[k].items) {
    for (const f of C.STARTER_FIELDS) assert.ok(String(it[f] || "").trim(), k + ": '" + it.text.slice(0, 30) + "' has no " + f);
    assert.ok(C.ORIGINS.includes(it.origin), "unknown origin " + it.origin);
    assert.ok(it.title.length <= C.LIMITS.title && it.author.length <= C.LIMITS.author);
    assert.ok(it.tags.split(",").length >= 2, "needs two or more tags: " + it.text);
    assert.match(it.link, /^https:\/\//);
  }
  // Each deck mixes origins so the two-line label shows in examples.
  for (const k of Object.keys(S)) assert.ok(new Set(S[k].items.map((i) => i.origin)).size >= 2, k + " uses one origin");
});

test("original lines credit Scales; public-domain lines cite a named translation", () => {
  const S = starters();
  for (const k of Object.keys(S)) for (const it of S[k].items) {
    if (it.author === "Scales") assert.match(it.link, /grahamdeno\/scales/);
    else assert.match(it.citation, /translated by /, it.author + " needs a translation in its citation");
  }
  const all = Object.values(S).flatMap((d) => d.items.map((i) => i.text));
  assert.ok(all.includes("Whatever cannot obey itself, is commanded. Such is the nature of living things."));
  assert.ok(!all.includes("He who cannot obey himself will be commanded."), "paraphrase must be gone");
});

test("loadStarter adds once, fills empty fields, keeps user values, replaces old wording", () => {
  const S = starters(), deck = S.overcoming;
  const first = C.loadStarter([], deck.name, deck.items, 0);
  assert.equal(first.add.length, deck.items.length);
  assert.equal(C.loadStarter(first.add, deck.name, deck.items, 0).add.length, 0, "reload adds nothing");

  const old = { id: "x", text: "He who cannot obey himself will be commanded.", author: "Friedrich Nietzsche", collection: "Self-overcoming",
    status: "active", skip_count: 3, reflect_count: 5, created_at: "2026-10-01T00:00:00.000Z", recent_lines: ["old line"] };
  const mine = { id: "y", text: "Stop saying things that make you weak.", title: "My title", origin: "", collection: "Self-overcoming",
    status: "shed", evidence: "kept", recent_lines: ["final"] };
  const r = C.loadStarter([old, mine], deck.name, deck.items, 0);
  assert.equal(r.add.length, deck.items.length - 2);
  assert.equal(r.updated, 2);
  assert.equal(old.text, "Whatever cannot obey itself, is commanded. Such is the nature of living things.");
  assert.deepEqual([old.skip_count, old.reflect_count, old.created_at, old.recent_lines], [3, 5, "2026-10-01T00:00:00.000Z", []]);
  assert.match(old.citation, /Thomas Common/);
  assert.equal(old.author, "Friedrich Nietzsche");
  assert.equal(mine.title, "My title", "user value kept");
  assert.equal(mine.origin, "Not sure", "empty field filled");
  assert.deepEqual([mine.status, mine.evidence, mine.recent_lines], ["shed", "kept", ["final"]]);
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
  assert.match(html, /window\.history\.scrollRestoration = "manual"/, "must use window.history; the app's own history array hides it");
  assert.match(html, /function closeSheet\(restore\) \{[\s\S]{0,400}resetScroll\(\)/, "closing a sheet resets the page offset");
  assert.match(html, /addEventListener\("focusout"/);
});

test("Settings shows a screen check for real-device layout numbers", () => {
  const html = read("index.html");
  assert.match(html, /id="screenCheck"/);
  assert.match(html, /function screenCheck\(\)/);
});

// ---------- 1.24.0: rest for the day, front of the stack ----------
const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min);
const card = (id, extra = {}) => Object.assign({ id, text: "P " + id, status: "active", skip_count: 0, lifetime_skips: 0 }, extra);

test("a Scales day runs from 4:00 AM to 4:00 AM", () => {
  assert.equal(C.dayOf(at(2026, 10, 13, 3, 59)), "2026-10-12");
  assert.equal(C.dayOf(at(2026, 10, 13, 4, 0)), "2026-10-13");
  assert.equal(C.dayOf(at(2026, 10, 13, 23, 59)), "2026-10-13");
  assert.equal(C.addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(C.addDays("2026-12-31", 1), "2027-01-01");
});

test("the 4:00 AM boundary holds across daylight saving", () => {
  process.env.TZ = "America/New_York";
  // Nov 1, 2026: clocks fall back at 2:00 AM. Mar 8, 2026: clocks spring forward at 2:00 AM.
  assert.equal(C.dayOf(new Date(2026, 10, 1, 3, 59)), "2026-10-31");
  assert.equal(C.dayOf(new Date(2026, 10, 1, 4, 0)), "2026-11-01");
  assert.equal(C.dayOf(new Date(2026, 2, 8, 3, 59)), "2026-03-07");
  assert.equal(C.dayOf(new Date(2026, 2, 8, 4, 0)), "2026-03-08");
});

test("Not today rests a principle until the next Scales day and owes it one turn at the front", () => {
  const t = card("a");
  C.applySkip(t, "2026-10-13");
  assert.deepEqual([t.skip_count, t.lifetime_skips, t.rest_until, t.lead_due], [1, 1, "2026-10-17", true]);
  assert.equal(C.REST_DAYS, 4);
  for (const d of ["2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"]) assert.equal(C.isResting(t, d), true, d);
  assert.equal(C.isResting(t, "2026-10-17"), false);
  assert.equal(C.frontQueue([t], "2026-10-16").length, 0, "no turn while resting");
  assert.equal(C.frontQueue([t], "2026-10-17").length, 1, "takes its turn the day it returns");
});

test("resting principles are never drawn, unless Show anyway is on", () => {
  const list = [card("a", { rest_until: "2026-10-14" }), card("b")];
  for (let i = 0; i < 50; i++) assert.equal(C.nextCard(list, [], "2026-10-13", false).card.id, "b");
  const all = [card("a", { rest_until: "2026-10-14" }), card("b", { rest_until: "2026-10-14" })];
  const r = C.nextCard(all, [], "2026-10-13", false);
  assert.deepEqual([r.card, r.resting], [null, 2], "everything resting: nothing left today");
  assert.ok(C.nextCard(all, [], "2026-10-13", true).card, "show anyway draws from resting");
});

test("the front of the stack: most avoided first, then longest waiting, once each", () => {
  const today = "2026-10-14";
  const list = [
    card("fresh"),
    card("two-old", { skip_count: 2, lead_due: true, rest_until: today, last_shown_at: "2026-10-01T10:00:00.000Z" }),
    card("two-new", { skip_count: 2, lead_due: true, rest_until: today, last_shown_at: "2026-10-12T10:00:00.000Z" }),
    card("three", { skip_count: 3, lead_due: true, rest_until: today }),
    card("resting", { skip_count: 5, lead_due: true, rest_until: "2026-10-15" }),
    card("counted-not-owed", { skip_count: 4 })
  ];
  assert.deepEqual(C.frontQueue(list, today).map((t) => t.id), ["three", "two-old", "two-new"]);
  const seen = [], hist = [], now = at(2026, 10, 14, 7);
  for (let i = 0; i < 3; i++) {
    const r = C.nextCard(list, hist, today, false, () => 0.5);
    assert.equal(r.lead, true); seen.push(r.card.id); hist.push(r.card.id); C.markShown(r.card, now, r.lead);
  }
  assert.deepEqual(seen, ["three", "two-old", "two-new"]);
  const after = C.nextCard(list, hist, today, false, () => 0.5);
  assert.equal(after.lead, false, "each leads once; then the weighted draw resumes");
  assert.notEqual(after.card.id, "resting");
});

test("skipping a card at the front rests it and owes it tomorrow's turn", () => {
  const t = card("a", { skip_count: 1, lead_due: true, rest_until: "2026-10-14" });
  C.markShown(t, at(2026, 10, 14, 7), true);
  assert.deepEqual([t.lead_due, t.led_on], [false, "2026-10-14"]);
  C.applySkip(t, "2026-10-14");
  assert.deepEqual([t.skip_count, t.rest_until, t.lead_due], [2, "2026-10-18", true]);
  assert.equal(C.frontQueue([t], "2026-10-17").length, 0);
  assert.equal(C.frontQueue([t], "2026-10-18").length, 1);
});

test("principles saved before 1.24.0 neither rest nor lead", () => {
  const old = card("a", { skip_count: 3 });
  assert.equal(C.isResting(old, "2026-10-13"), false);
  assert.equal(C.frontQueue([old], "2026-10-13").length, 0);
});

test("Nothing left today names the earliest return; existing rests keep their day (1.25.0)", () => {
  const list = [card("a", { rest_until: "2026-10-17" }), card("b", { rest_until: "2026-10-14" }), card("c")];
  assert.equal(C.nextReturn(list, "2026-10-13"), "2026-10-14", "a rest set under 1.24.0 is kept");
  assert.equal(C.nextReturn([card("x")], "2026-10-13"), "");
  assert.doesNotMatch(read("index.html"), /resting until " \+ C\.DAY_START_HOUR/, "copy must not promise 4:00 AM tonight");
});

// ---------- undo (1.26.0) ----------
const deckOf = (...ts) => Object.fromEntries(ts.map((t) => [t.id, t]));
const full = (id, extra = {}) => Object.assign({ id, text: "Principle " + id, status: "active", skip_count: 0, lifetime_skips: 0,
  reflect_count: 0, consecutive_reflects: 0, recent_lines: [], created_at: "2026-10-01T12:00:00.000Z" }, extra);

test("undo after Not today restores counts, rest, the turn at the front, activity and history", () => {
  const thoughts = deckOf(full("a", { skip_count: 1, lifetime_skips: 2, consecutive_reflects: 2 }), full("b", { lead_due: true }));
  const activity = { "2026-10-16": { i: 3, s: 0 } }, history = ["b", "a"];
  const before = JSON.parse(JSON.stringify({ thoughts, activity, history }));
  const u = C.undoPoint(thoughts, activity, history, "a");
  C.applySkip(thoughts.a, "2026-10-16");
  activity["2026-10-16"].i++;
  C.markShown(thoughts.b, new Date(2026, 9, 16, 9), true); history.push("b"); // the next card comes up
  const r = C.applyUndo(u);
  assert.deepEqual({ thoughts: r.thoughts, activity: r.activity, history: r.history }, before);
  assert.equal(r.current, "a");
  assert.equal(r.thoughts.a.rest_until, undefined);
  assert.equal(r.thoughts.b.lead_due, true, "the next card keeps its turn at the front");
});

test("undo after Still working on it restores the reflect counts and skip step", () => {
  const thoughts = deckOf(full("a", { skip_count: 2, reflect_count: 4 }));
  const u = C.undoPoint(thoughts, {}, ["a"], "a");
  thoughts.a.reflect_count++; thoughts.a.consecutive_reflects++; thoughts.a.skip_count--;
  const r = C.applyUndo(u);
  assert.deepEqual([r.thoughts.a.reflect_count, r.thoughts.a.consecutive_reflects, r.thoughts.a.skip_count], [4, 0, 2]);
});

test("undo after Living it returns the principle to the deck and clears the record", () => {
  const thoughts = deckOf(full("a"));
  const activity = {};
  const u = C.undoPoint(thoughts, activity, ["a"], "a");
  Object.assign(thoughts.a, { status: "shed", shed_at: "2026-10-16T12:00:00.000Z", evidence: "Did it." });
  activity["2026-10-16"] = { i: 0, s: 1 };
  const r = C.applyUndo(u);
  assert.equal(r.thoughts.a.status, "active");
  assert.equal(r.thoughts.a.shed_at, undefined);
  assert.equal(r.thoughts.a.evidence, undefined);
  assert.deepEqual(r.activity, {});
});

test("undo after Delete brings the principle back with its history", () => {
  const thoughts = deckOf(full("a", { skip_count: 3, recent_lines: ["x"] }), full("b"));
  const u = C.undoPoint(thoughts, {}, ["a", "b"], "b");
  delete thoughts.a;
  const r = C.applyUndo(u);
  assert.deepEqual(Object.keys(r.thoughts).sort(), ["a", "b"]);
  assert.deepEqual(r.thoughts.a.recent_lines, ["x"]);
  assert.equal(r.current, "b");
});

test("an undo point is a copy: later changes do not leak in, and applying it twice is safe", () => {
  const thoughts = deckOf(full("a"));
  const u = C.undoPoint(thoughts, {}, [], null);
  thoughts.a.text = "changed";
  const r1 = C.applyUndo(u);
  r1.thoughts.a.skip_count = 9;
  const r2 = C.applyUndo(u);
  assert.equal(r2.thoughts.a.text, "Principle a");
  assert.equal(r2.thoughts.a.skip_count, 0);
  assert.equal(r2.current, null);
});

test("the page wires sheets as modal dialogs, Undo and the coach (1.26.0)", () => {
  const html = read("index.html");
  assert.equal((html.match(/<dialog class="sheet/g) || []).length, 9, "every sheet is a <dialog>");
  assert.doesNotMatch(html, /<section class="sheet/, "no sheet left as a hidden section");
  assert.match(html, /\.showModal\(\)/);
  for (const id of (html.match(/aria-labelledby="(sheet\w+Title)"/g) || []).map((m) => m.slice(17, -1))) {
    assert.match(html, new RegExp('id="' + id + '"'), id + " labels its sheet");
  }
  assert.match(html, /id="toastHost"[^>]*aria-live="polite"/);
  assert.match(html, /prefs\.coach_seen/);
  assert.doesNotMatch(html, /stripHtml|id="addChip"/, "the Pushing back strip is gone from the deck");
  assert.doesNotMatch(html, /Tap again to delete/, "Delete uses Undo, not a second tap");
});

// ---------- 1.27.0: the new look ----------
const A = (id, extra = {}) => Object.assign({ id, text: "P " + id, status: "active", skip_count: 0, lifetime_skips: 0 }, extra);

test("inCollection matches ignoring case and spacing; an empty filter matches everything", () => {
  assert.equal(C.inCollection(A("a", { collection: "Stoic" }), ""), true);
  assert.equal(C.inCollection(A("a"), ""), true);
  assert.equal(C.inCollection(A("a", { collection: "  stoic " }), "Stoic"), true);
  assert.equal(C.inCollection(A("a", { collection: "Explore  This" }), "explore this"), true);
  assert.equal(C.inCollection(A("a", { collection: "Poems" }), "Stoic"), false);
  assert.equal(C.inCollection(A("a"), "Stoic"), false);
});

test("deck chips list only collections still in the deck, most used first", () => {
  const list = [A("a", { collection: "Stoic" }), A("b", { collection: "Poems" }), A("c", { collection: "stoic" }),
    A("d", { collection: "Lived only", status: "shed" }), A("e")];
  assert.deepEqual(C.deckCollections(list), [{ name: "Stoic", count: 2 }, { name: "Poems", count: 1 }]);
  assert.deepEqual(C.deckCollections([A("x"), A("y", { status: "shed", collection: "Gone" })]), [], "no chips without collections in the deck");
});

test("the saved deck filter follows the collection's spelling and falls back to all when it is gone", () => {
  const list = [A("a", { collection: "Stoic" }), A("b", { collection: "Poems", status: "shed" })];
  assert.equal(C.deckFilter(list, "stoic"), "Stoic");
  assert.equal(C.deckFilter(list, ""), "");
  assert.equal(C.deckFilter(list, undefined), "");
  assert.equal(C.deckFilter(list, "Poems"), "", "every principle in it is lived");
  assert.equal(C.deckFilter(list, "Renamed away"), "");
});

test("a filtered deck draws only from its collection, front of the stack included", () => {
  const today = "2026-10-16";
  const list = [A("s1", { collection: "Stoic" }), A("s2", { collection: "Stoic" }),
    A("l1", { collection: "Leadership", lead_due: true, skip_count: 3 })];
  const pool = list.filter((t) => C.inCollection(t, "Stoic"));
  const r = lcg(3);
  for (let i = 0; i < 40; i++) assert.notEqual(C.nextCard(pool, [], today, false, r).card.id, "l1");
  assert.equal(C.nextCard(list, [], today, false, r).card.id, "l1", "unfiltered, the principle owed a turn leads");
});

test("outcomeMix counts every principle once and its percentages add up to 100", () => {
  const list = [A("a", { status: "shed" }), A("b", { status: "shed" }), A("c"), A("d"), A("e", { skip_count: 1 }), A("f", { skip_count: 2 }), A("g", { skip_count: 4 })];
  const m = C.outcomeMix(list);
  assert.deepEqual([m.live, m.work, m.skip, m.total], [2, 2, 3, 7]);
  assert.deepEqual(m.pct, { live: 29, work: 28, skip: 43 });
  assert.equal(m.pct.live + m.pct.work + m.pct.skip, 100);
  const thirds = C.outcomeMix([A("a", { status: "shed" }), A("b"), A("c", { skip_count: 1 })]).pct;
  assert.equal(thirds.live + thirds.work + thirds.skip, 100);
  assert.deepEqual(C.outcomeMix([]).pct, { live: 0, work: 0, skip: 0 }, "empty deck draws empty bars");
  assert.deepEqual(C.outcomeMix([A("a", { status: "shed" })]).pct, { live: 100, work: 0, skip: 0 });
  // Lifetime skips that were worked back down do not count as Not today now.
  assert.equal(C.outcomeMix([A("a", { lifetime_skips: 5, skip_count: 0 })]).work, 1);
});

test("swipeIntent keeps the commit rules and reads the direction for the glow", () => {
  assert.equal(C.SWIPE, 90);
  assert.deepEqual([C.swipeIntent(-91, 0).kind, C.swipeIntent(-91, 0).commit], ["skip", true]);
  assert.deepEqual([C.swipeIntent(91, 0).kind, C.swipeIntent(91, 0).commit], ["shed", true]);
  assert.deepEqual([C.swipeIntent(10, -91).kind, C.swipeIntent(10, -91).commit], ["keep", true]);
  assert.equal(C.swipeIntent(-90, 0).commit, false, "exactly 90px is not past the line");
  assert.equal(C.swipeIntent(-70, -100).commit, false, "up but too far sideways, and not far enough sideways");
  assert.equal(C.swipeIntent(-95, -200).kind, "skip", "sideways commit wins, as before");
  const mid = C.swipeIntent(45, 5);
  assert.deepEqual([mid.kind, mid.strength, mid.commit], ["shed", 0.5, false]);
  assert.equal(C.swipeIntent(10, -45).kind, "keep");
  assert.equal(C.swipeIntent(3, 2).kind, "", "a tap has no direction");
  assert.equal(C.swipeIntent(0, 0).strength, 0);
  assert.equal(C.swipeIntent(400, 0).strength, 1);
  assert.equal(C.swipeIntent(1000, 0).tilt, 14, "tilt is capped");
  assert.equal(C.swipeIntent(-40, 0).tilt, -2);
});

// ---------- 1.30.0: Matte, the menu, and keeping an AI line ----------
const css = () => { const html = read("index.html"), i = html.indexOf("<style>\n/* Layout (1.30.0)"); assert.ok(i >= 0, "Matte style block"); return html.slice(i, html.indexOf("</style>", i)); };
const rule = (c, sel) => { const i = c.indexOf("\n" + sel + " {"); assert.ok(i >= 0, sel + " rule"); return c.slice(i, c.indexOf("}", i)); };

test("rest after Not today is a setting from 1 to 7 days, 4 by default (1.30.0)", () => {
  assert.deepEqual([C.REST_DAYS, C.REST_MIN, C.REST_MAX], [4, 1, 7]);
  assert.equal(C.restDays(undefined), 4);
  assert.equal(C.restDays("x"), 4);
  assert.equal(C.restDays(0), 1);
  assert.equal(C.restDays(12), 7);
  assert.equal(C.restDays("2"), 2);
  const t = card("a");
  C.applySkip(t, "2026-10-17", 2);
  assert.equal(t.rest_until, "2026-10-19");
  C.applySkip(t, "2026-10-17");
  assert.equal(t.rest_until, "2026-10-21", "left out, the default four days");
  C.applySkip(t, "2026-10-17", 30);
  assert.equal(t.rest_until, "2026-10-24", "capped at seven");
  const html = read("index.html");
  assert.match(html, /C\.applySkip\(t, today\(\), restDays\(\)\)/, "the deck uses the saved rest length");
  assert.match(html, /function restDays\(\) \{ return C\.restDays\(prefs\.rest_days\); \}/);
});

test("keepAsNew adds the line beside the original, cited and linked, with fresh counts (Story 10)", () => {
  const orig = full("o", { collection: "Self-overcoming", skip_count: 2, author: "Someone" });
  const now = new Date(2026, 9, 17, 9);
  const r = C.keepAsNew([orig], orig, "  What comfort are you buying today?  ", now);
  const n = r.principle;
  assert.equal(n.text, "What comfort are you buying today?");
  assert.equal(n.collection, "Self-overcoming");
  assert.equal(n.citation, "Kept from an AI line on Oct 17, 2026");
  assert.equal(n.kept_from, "o");
  assert.equal(n.author, "", "no AI author");
  assert.deepEqual([n.status, n.skip_count, n.lifetime_skips, n.reflect_count, n.recent_lines], ["active", 0, 0, 0, []]);
  assert.equal(n.id, undefined, "the app assigns the id");
  assert.equal(orig.skip_count, 2, "the original is untouched");
  assert.equal(C.keepAsNew([orig, Object.assign(n, { id: "n" })], orig, "what comfort are YOU buying today?", now).reason, "duplicate");
  assert.equal(C.keepAsNew([orig], orig, "  ", now).reason, "empty");
  assert.equal(C.keepAsNew([orig], orig, "x".repeat(C.MAX_TEXT + 1), now).reason, "too long");
});

test("keepReplace changes only the wording and saves the earlier one (Story 10)", () => {
  const t = full("a", { text: "Old words", skip_count: 3, lifetime_skips: 4, reflect_count: 5, recent_lines: ["Better words"] });
  const other = full("b", { text: "Taken" });
  const now = new Date(2026, 9, 17, 9);
  assert.equal(C.keepReplace([t, other], t, "taken", now).reason, "duplicate");
  assert.equal(C.keepReplace([t, other], t, "Old words", now).reason, "unchanged");
  const r = C.keepReplace([t, other], t, "Better words", now);
  assert.equal(r.principle, t);
  assert.equal(t.text, "Better words");
  assert.deepEqual([t.skip_count, t.lifetime_skips, t.reflect_count, t.created_at], [3, 4, 5, "2026-10-01T12:00:00.000Z"]);
  assert.deepEqual(t.earlier, [{ text: "Old words", until: now.toISOString() }]);
  assert.equal(t.worded_from_ai, now.toISOString());
  assert.deepEqual(t.recent_lines, [], "a deck principle gets a line for its new wording");
  for (let i = 0; i < 6; i++) C.keepReplace([t], t, "Words " + i, now);
  assert.equal(t.earlier.length, 5, "the last five wordings are kept");
});

test("the Keep sheet offers add or replace, and both can be undone", () => {
  const html = read("index.html");
  assert.match(html, /<dialog class="sheet" id="sheetKeep"/);
  assert.match(html, /id="keepAdd" data-k="add" aria-pressed="true"/);
  assert.match(html, /id="keepRep" data-k="replace" aria-pressed="false"/);
  assert.match(html, /C\.keepAsNew\(all\(\), t, keepLine, now\)/);
  assert.match(html, /C\.keepReplace\(all\(\), t, keepLine, now\)/);
  assert.match(html, /undoable\("Added to "/);
  assert.match(html, /undoable\("Wording replaced\. Earlier wording kept\.", u\)/);
  assert.match(html, /var k = \$\("keepBtn"\); if \(k\) k\.hidden = !l\.ai;/, "Keep shows only on model lines");
  assert.match(html, /data-keep="/, "Keep is offered on the Living it record too");
  assert.match(html, /Earlier wording: /, "the Ledger shows the wording a principle had");
  assert.match(html, /Kept from an AI line on /);
});

test("the three moves are three keys, swipes, and arrow keys; press and hold edits (1.30.0)", () => {
  const html = read("index.html");
  for (const m of ["skip", "keep", "shed"]) assert.match(html, new RegExp('data-move="' + m + '"'), m + " key");
  assert.match(html, /act\(k\.getAttribute\("data-move"\)\)/);
  assert.match(html, /k === "ArrowLeft"\) act\("skip"\)/);
  assert.match(html, /k === "ArrowUp"\) act\("keep"\)/);
  assert.match(html, /k === "ArrowRight"\) act\("shed"\)/);
  assert.match(html, /if \(openSheet \|\| menu\.open \|\| isTyping\(document\.activeElement\)/, "shortcuts never fire while typing, in a sheet or in the menu");
  assert.match(html, /var HOLD_MS = 550;/);
  assert.match(html, /if \(t\) \{ coachSeen\(\); openEdit\(t\); \}/);
  assert.match(html, /key\.classList\.toggle\("down", k === kind/, "the key presses in while you swipe toward it");
  assert.match(html, /C\.swipeIntent\(dx, dy\)/);
  assert.match(html, /aria-describedby="cardHow"/);
  assert.doesNotMatch(html, /id="fab"|id="ring"|function openRing|wakeCorner/, "the corner button and its ring are gone");
});

test("everything else is in a modal menu at the top right (1.30.0)", () => {
  const html = read("index.html");
  assert.match(html, /<header class="top">[\s\S]*id="todayLbl"[\s\S]*id="backDeck"[^>]*hidden[\s\S]*id="menuBtn"[^>]*aria-haspopup="dialog"[^>]*aria-expanded="false"[^>]*aria-controls="menu"[\s\S]*<\/header>/);
  assert.match(html, /<dialog class="menu frost" id="menu"/);
  for (const m of ["capture", "edit", "ledger", "collections", "settings"]) assert.match(html, new RegExp('data-m="' + m + '"'), m + " is in the menu");
  assert.match(html, /\$\("mEdit"\)\.hidden = !onCard\(\);/, "Edit is listed only with a principle on screen");
  assert.match(html, /menu\.showModal\(\)/);
});

test("Matte: one face, two looks, raised and pressed materials (1.30.0)", () => {
  const c = css(), html = read("index.html"), sw = read("sw.js");
  assert.match(c, /--paper:#2E3038; --deep:#24262C; --rise:#363841; --ink:#ECE8E1;/);
  assert.match(c, /:root\[data-look="light"\] \{\s*--paper:#E3E7ED;/);
  assert.match(rule(c, ".raised"), /box-shadow:-6px -6px 14px var\(--hi\), 8px 10px 20px var\(--lo\)/);
  assert.match(c, /\.pressed, \.raised\[aria-pressed="true"\], \.raised\.down \{[^}]*inset 5px 6px 12px var\(--lo\)/);
  assert.match(c, /\.glass \{[^}]*backdrop-filter:blur\(22px\)/);
  assert.match(html, /@supports not \(\(-webkit-backdrop-filter:blur\(1px\)\) or \(backdrop-filter:blur\(1px\)\)\)/, "glass has a fallback");
  // Geist only, self-hosted, preloaded and cached.
  assert.ok(fs.statSync(path.join(root, "fonts/geist-latin.woff2")).size > 10000);
  assert.match(html, /font-family:"Geist"; font-style:normal; font-weight:100 900; font-display:swap; src:url\("fonts\/geist-latin\.woff2"\)/);
  assert.match(html, /<link rel="preload" href="fonts\/geist-latin\.woff2" as="font" type="font\/woff2" crossorigin>/);
  assert.match(sw, /"fonts\/geist-latin\.woff2"/);
  for (const gone of ["instrument-serif-latin", "geist-mono-latin", "inter-latin", "fraunces-latin"]) {
    assert.ok(!fs.existsSync(path.join(root, "fonts/" + gone + ".woff2")), gone + " is gone");
    assert.doesNotMatch(html + sw, new RegExp(gone), gone + " is not referenced");
  }
  assert.doesNotMatch(c, /Instrument Serif|Geist Mono|font-family:var\(--f-display\)/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.match(read("fonts/OFL.txt"), /Geist Project Authors/);
  assert.match(html, /function applyLook\(\)/);
  assert.match(html, /\.seg \[data-look\]/);
});

test("the principle sits on the page, not on a card, with where it came from under it", () => {
  const c = css(), html = read("index.html");
  const card = rule(c, ".card");
  assert.doesNotMatch(card, /background|box-shadow|border-radius|border:/, "no card chrome");
  assert.match(card, /justify-content:flex-end/);
  assert.match(html, /function whereHtml\(t\)/);
  assert.match(html, /if \(showWhere\(\)\) \{/);
  assert.match(html, /function showWhere\(\) \{ return prefs\.show_where !== false; \}/, "on by default");
  assert.match(html, /id="whereToggle" role="switch"/);
  assert.match(html, /id="aiToggle" role="switch"/);
  assert.match(html, /sample = prefs\.ai_off \? null : makeSampler\(savedKey\)/, "AI lines off uses the built-in questions");
});

test("the Ledger: gauge, capsules, pushing back tiles, the 12 week grid and the list (1.30.0)", () => {
  const html = read("index.html");
  for (const id of ["gauge", "gaugeArc", "caps", "capLive", "capRest", "capPush", "pb", "cal", "segDeck", "segShed", "ledgerList"]) assert.match(html, new RegExp('id="' + id + '"'), id);
  assert.match(html, /C\.outcomeMix\(items\)/);
  assert.match(html, /class="pbc raised" data-show="/, "a pushing back tile opens the principle on the deck");
  assert.match(html, /var cls = a && a\.s \? "lv" : n >= 3 \? "on2" : n \? "on" : "";/);
  assert.match(html, /\$\("v-ledger"\)\.addEventListener\("click"/);
});

test("the top: the day and date on the deck, the way back on the Ledger", () => {
  const html = read("index.html");
  assert.match(html, /\$\("backDeck"\)\.hidden = view !== "ledger";/);
  assert.match(html, /\$\("todayLbl"\)\.hidden = view !== "deck";/);
  assert.match(html, /function paintDate\(\)/);
  assert.match(html, /function paintStat\(\) \{[\s\S]{0,120}\$\("deckN"\)/, "the deck count sits in the footer");
});

test("motion respects reduced motion", () => {
  const html = read("index.html");
  assert.match(html, /document\.startViewTransition && !REDUCED\.matches/);
  assert.match(html, /function burst\(\) \{[^}]*REDUCED\.matches\) return;/);
  assert.match(html, /@media \(prefers-reduced-motion: no-preference\) \{ \.card\.enter/);
  assert.match(html, /@media \(prefers-reduced-motion: reduce\) \{ \.card, \.card\.spring/);
});

test("touch targets: keys, chips and row actions are at least 36px with 44px hit areas", () => {
  const c = css();
  assert.match(rule(c, ".iconbtn"), /width:44px; height:44px;/);
  assert.match(rule(c, ".key"), /height:clamp\(66px, 11svh, 92px\)/);
  assert.match(rule(c, ".chip"), /height:36px;/);
  assert.match(c, /\.chip::after \{ content:""; position:absolute; inset:-4px 0; \}/);
  assert.match(rule(c, ".acts-row button"), /min-height:44px; min-width:44px;/);
  assert.match(rule(c, ".menu button"), /min-height:48px;/);
});

// ---------- 1.31.0: a thinker weighs in, and Talk it through ----------
test("the voices: eight built in, living ones in the third person, added names living by default (Story 12)", () => {
  assert.deepEqual(C.VOICES.map((v) => v.id), ["jung", "nietzsche", "dostoevsky", "epictetus", "marcus", "perel", "peterson", "goggins"]);
  assert.deepEqual(C.VOICES.filter((v) => v.living).map((v) => v.id), ["perel", "peterson", "goggins"]);
  const all = C.allVoices([{ name: "  Viktor   Frankl " }, { name: "Seneca", first: true }, { name: " " }]);
  assert.equal(all.length, 10);
  assert.deepEqual(all.slice(8).map((v) => [v.id, v.name, v.living]), [["c:viktor frankl", "Viktor Frankl", true], ["c:seneca", "Seneca", false]]);
  assert.equal(C.chosenVoices(undefined, [{ name: "Seneca" }]).length, 8, "by default every built-in voice, none added");
  assert.deepEqual(C.chosenVoices(["goggins", "c:seneca", "jung"], [{ name: "Seneca" }]).map((v) => v.id), ["jung", "goggins", "c:seneca"]);
  assert.equal(C.chosenVoices([], []).length, 0);
});

test("one voice a day, rotating in order, changing with the Scales day (Story 12)", () => {
  const vs = C.chosenVoices(["jung", "nietzsche", "goggins"]);
  const seq = ["2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"].map((d) => C.voiceOfDay(vs, d).id);
  assert.equal(new Set(seq.slice(0, 3)).size, 3, "three days, three voices");
  assert.equal(seq[3], seq[0], "then it comes round again");
  assert.equal(C.voiceOfDay(vs, "2026-10-17").id, C.voiceOfDay(vs, "2026-10-17").id, "stable within a day");
  assert.equal(C.voiceOfDay([], "2026-10-17"), null);
  assert.equal(C.voiceOfDay(vs, C.dayOf(new Date(2026, 9, 18, 3, 30))).id, C.voiceOfDay(vs, "2026-10-17").id, "3:30 AM still belongs to the day before");
});

test("first person for thinkers who have died, third person for the living, never a quotation (Story 12)", () => {
  const t = { text: "Discipline is choosing what my future self needs.", skip_count: 2 };
  const n = C.VOICES.find((v) => v.id === "nietzsche"), g = C.VOICES.find((v) => v.id === "goggins");
  assert.equal(C.voiceLabel(n), "In the spirit of Nietzsche, written by AI");
  assert.equal(C.voiceLabel(g), "Through Goggins's lens, written by AI");
  const pn = C.weighPrompt(n, t, "skip", 27), pg = C.weighPrompt(g, t, "skip", 27);
  assert.match(pn, /Speak in the first person as Friedrich Nietzsche/);
  assert.match(pg, /Write in the third person about how David Goggins would see this/);
  assert.match(pg, /Never write as Goggins speaking, and never invent a quotation/);
  for (const p of [pn, pg]) {
    assert.match(p, /Move: Not today/);
    assert.match(p, new RegExp(C.MAX_WORDS + " words or fewer"));
    assert.match(p, /no permission to wait/);
    assert.doesNotMatch(p, /—/);
  }
});

test("Talk it through: the request carries the line and turns, replies are checked, six replies at most (Story 13)", () => {
  const g = C.VOICES.find((v) => v.id === "goggins"), t = { text: "P", skip_count: 1 };
  const talk = { move: "keep", line: "The line.", turns: [{ me: true, text: "Why?" }, { me: false, text: "Because." }, { me: true, text: "And?" }] };
  const r = C.talkRequest(g, t, talk);
  assert.match(r.system, /third person/);
  assert.deepEqual(r.messages.map((m) => m.role), ["user", "assistant", "user", "assistant", "user"]);
  assert.equal(r.messages[1].content, "The line.");
  assert.equal(C.talkLeft(talk), C.TALK_MAX - 2);
  assert.equal(C.talkLeft({ turns: Array.from({ length: 6 }, () => ({ me: true, text: "x" })) }), 0);
  assert.equal(C.TALK_MAX, 6);
  assert.equal(C.vetReply("").reason, "empty");
  assert.equal(C.vetReply("Go on!").reason, "cheerful tone");
  assert.equal(C.vetReply("Be gentle with yourself today.").reason, "softened");
  const long = Array.from({ length: 30 }, (_, i) => "Sentence number " + i + ".").join(" ");
  const v = C.vetReply(long);
  assert.ok(v.reply && v.reply.split(/\s+/).length <= C.REPLY_WORDS && /\.$/.test(v.reply), "cut to whole sentences");
  assert.equal(C.vetReply("One\n\nparagraph.").reply, "One paragraph.");
});

test("talks are saved on the principle, newest last, five kept (Story 13)", () => {
  const t = {};
  for (let i = 0; i < 7; i++) C.addTalk(t, { at: "t" + i, line: "l", turns: [] });
  assert.deepEqual(t.talks.map((x) => x.at), ["t2", "t3", "t4", "t5", "t6"]);
});

test("the page offers Weigh in only after a move, with a key, and keeps talks in the Ledger", () => {
  const html = read("index.html");
  assert.match(html, /<dialog class="sheet tall" id="sheetWeigh"/);
  assert.match(html, /function canWeigh\(\) \{ return !!\(sample && lastMove && lastMove\.day === today\(\)/);
  for (const m of ['noteMove(t, "skip")', 'noteMove(t, "keep")', 'noteMove(t, "shed")']) assert.ok(html.includes(m), m);
  assert.match(html, /lastMove = null; \/\/ the move is undone/);
  assert.match(html, /if \(!wTalk\(\)\.line\) askLine\(\);/, "the line is asked for only when Weigh in is tapped");
  assert.match(html, /C\.voiceLabel\(v\)/, "every line carries its label");
  assert.match(html, /openKeep\(t, k\.line\)/, "Keep works on these lines");
  assert.match(html, /data-talk="/);
  assert.match(html, /undoable\("Talk deleted\.", u\)/);
  assert.match(html, /id="voiceList"/);
  assert.match(html, /JSON\.stringify\(Object\.assign\(\{ model: MODEL, max_tokens: 1024 \}, req\)\)/, "one request path for lines and talks");
});
