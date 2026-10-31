// Tests for core.js (Scales 2) and the wiring around it.
// Run with: node --test   (Node 18 or later, no dependencies)

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const N = require("../core.js");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const at = (y, mo, d, h = 12, mi = 0) => new Date(y, mo - 1, d, h, mi);

test("classify: 20 s or less is skipped, 30 s or more is thought about, between is seen", () => {
  assert.equal(N.classify(0, false, false), "skipped");
  assert.equal(N.classify(20000, false, false), "skipped");
  assert.equal(N.classify(20001, false, false), "seen");
  assert.equal(N.classify(29999, false, false), "seen");
  assert.equal(N.classify(30000, false, false), "thought");
  assert.equal(N.classify(60000, false, false), "thought");
});

test("classify: editing or noting wins; a long idle gap is only seen", () => {
  assert.equal(N.classify(1000, true, false), "worked");
  assert.equal(N.classify(60000, true, true), "worked");
  assert.equal(N.classify(600000, false, true), "seen");
  assert.equal(N.classify(2000, false, true), "seen");
});

test("nextGap: skipped 1, seen 2, thought 2+2n capped at 21, worked 4+3n capped at 30", () => {
  assert.equal(N.nextGap({}, "skipped"), 1);
  assert.equal(N.nextGap({}, "seen"), 2);
  assert.equal(N.nextGap({ thinks: 0 }, "thought"), 2);
  assert.equal(N.nextGap({ thinks: 3 }, "thought"), 8);
  assert.equal(N.nextGap({ thinks: 50 }, "thought"), 21);
  assert.equal(N.nextGap({ works: 0 }, "worked"), 4);
  assert.equal(N.nextGap({ works: 2 }, "worked"), 10);
  assert.equal(N.nextGap({ works: 50 }, "worked"), 30);
});

test("recordVisit: counts, due date, and engaging works off one skip", () => {
  const now = at(2026, 10, 29);
  const t = N.make("Rest is part of the work.", now);
  assert.equal(N.recordVisit(t, 3000, false, false, now), "skipped");
  assert.equal(t.skips, 1);
  assert.equal(t.due, "2026-10-30");
  assert.equal(N.recordVisit(t, 31000, false, false, now), "thought");
  assert.equal(t.thinks, 1);
  assert.equal(t.skips, 0, "thinking about it works off the skip");
  assert.equal(t.due, "2026-11-02", "the count includes this visit: 2 + 2 x 1 = 4 days");
  N.recordVisit(t, 1000, true, false, now);
  assert.equal(t.works, 1);
  assert.equal(t.due, "2026-11-05", "the count includes this visit: 4 + 3 x 1 = 7 days");
  assert.equal(t.skips, 0, "never below zero");
  assert.equal(t.visits.length, 3);
  assert.deepEqual(t.visits.map((v) => v.kind), ["skipped", "thought", "worked"]);
});

test("recordVisit keeps only the last 30 visits and never removes the thought", () => {
  const now = at(2026, 10, 29), t = N.make("x", now);
  for (let i = 0; i < 45; i++) N.recordVisit(t, 8000, false, false, now);
  assert.equal(t.visits.length, 30);
  assert.equal(t.away, null);
});

test("weight: 600 fresh, 50 heavier per skip, capped at 800", () => {
  assert.equal(N.weight({ skips: 0 }), 600);
  assert.equal(N.weight({ skips: 2 }), 700);
  assert.equal(N.weight({ skips: 4 }), 800);
  assert.equal(N.weight({ skips: 9 }), 800);
  assert.equal(N.weight({}), 600);
});

test("make: a new thought comes back tomorrow, in rotation", () => {
  const t = N.make("  Say it early.  ", at(2026, 10, 29));
  assert.equal(t.text, "Say it early.");
  assert.equal(t.due, "2026-10-30");
  assert.equal(t.away, null);
});

test("day starts at 4 AM", () => {
  assert.equal(N.dayKey(at(2026, 10, 29, 3, 59)), "2026-10-28");
  assert.equal(N.dayKey(at(2026, 10, 29, 4, 0)), "2026-10-29");
  assert.equal(N.dayKey(at(2026, 10, 29, 23, 30)), "2026-10-29");
  assert.equal(N.addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(N.addDays("2026-12-31", 1), "2027-01-01");
});

test("pickNext: most skipped first, then oldest due; skips the current; ignores put away and not yet due", () => {
  const now = at(2026, 10, 29);
  const mk = (id, o) => Object.assign({ id, text: id, created: "2026-01-01T00:00:00Z", due: "2026-10-29", away: null, skips: 0 }, o);
  const store = {
    a: mk("a", { skips: 0, due: "2026-10-27" }),
    b: mk("b", { skips: 3, due: "2026-10-29" }),
    c: mk("c", { skips: 3, due: "2026-10-28" }),
    d: mk("d", { skips: 9, away: "2026-10-01T00:00:00Z" }),
    e: mk("e", { skips: 9, due: "2026-10-30" })
  };
  assert.deepEqual(N.dueToday(store, now).map((t) => t.id), ["c", "b", "a"]);
  assert.equal(N.pickNext(store, now).id, "c");
  assert.equal(N.pickNext(store, now, "c").id, "b");
  assert.equal(N.pickNext({ e: store.e }, now), null);
  assert.equal(N.nextDue({ e: store.e, d: store.d }), "2026-10-30");
  assert.equal(N.nextDue({ d: store.d }), null);
  // soonest: who comes back first when nothing is due (ignores put away and the one named)
  assert.equal(N.soonest(store).id, "a");
  assert.equal(N.soonest(store, "a").id, "c");
  assert.equal(N.soonest({ d: store.d }), null);
  assert.equal(N.inRotation(store).length, 4);
  assert.equal(N.putAway(store).length, 1);
});

test("importOld: status mapping, 5 a day most skipped first, skips capped, old data untouched", () => {
  const now = at(2026, 10, 29);
  const old = {};
  for (let i = 0; i < 12; i++) old["k" + i] = { id: "k" + i, text: "Thought " + i, status: "active", skip_count: i === 7 ? 9 : 0, created_at: "2026-01-" + String(i + 1).padStart(2, "0") + "T00:00:00Z" };
  old.lived = { id: "lived", text: "Lived one", status: "shed", shed_at: "2026-09-01T00:00:00Z" };
  old.gone = { id: "gone", text: "Let go", status: "letgo", letgo_at: "2026-09-02T00:00:00Z" };
  old.blank = { id: "blank", text: "   ", status: "active" };
  const before = JSON.stringify(old);
  const out = N.importOld(old, now);
  assert.equal(JSON.stringify(old), before, "the old data is never changed");
  assert.equal(Object.keys(out).length, 14, "blank text is dropped");
  const active = N.inRotation(out);
  assert.equal(active.length, 12);
  assert.equal(N.putAway(out).length, 2);
  assert.ok(out.olived.away && out.ogone.away);
  const byDay = {};
  active.forEach((t) => { byDay[t.due] = (byDay[t.due] || 0) + 1; });
  assert.deepEqual(byDay, { "2026-10-29": 5, "2026-10-30": 5, "2026-10-31": 2 });
  assert.equal(out.ok7.due, "2026-10-29", "most skipped arrives first");
  assert.equal(out.ok7.skips, 4, "skips capped at 4");
  assert.equal(N.dueToday(out, now).length, 5);
  assert.equal(N.importOld(null, now) && Object.keys(N.importOld(null, now)).length, 0);
});

test("whenLabel", () => {
  const now = at(2026, 10, 29);
  assert.equal(N.whenLabel(null, now), "Today");
  assert.equal(N.whenLabel("2026-10-29", now), "Today");
  assert.equal(N.whenLabel("2026-10-20", now), "Today");
  assert.equal(N.whenLabel("2026-10-30", now), "Tomorrow");
  assert.equal(N.whenLabel("2026-11-02", now), "Mon");
  assert.equal(N.whenLabel("2026-11-20", now), "Nov 20");
});

test("version is MAJOR.MINOR.PATCH and matches the worker's cache and the page's core.js address", () => {
  assert.match(N.VERSION, /^\d+\.\d+\.\d+$/);
  const sw = read("sw.js"), m = sw.match(/const CACHE = "scales-v([^"]+)"/);
  assert.ok(m, "CACHE constant not found");
  assert.equal(m[1], N.VERSION);
  assert.match(sw, new RegExp('"core\\.js\\?v=' + N.VERSION.replace(/\./g, "\\.") + '"'));
  assert.match(read("index.html"), new RegExp('<script src="core\\.js\\?v=' + N.VERSION.replace(/\./g, "\\.") + '"></script>'));
  assert.match(sw, /ks\.filter\(k => k !== CACHE\)/, "every older copy is cleared, Scales 1's and the trial's included");
});

test("the trial address forwards home, keeping ?native=1, and its worker retires itself", () => {
  assert.match(read("next/index.html"), /location\.replace\("\.\.\/" \+ location\.search\)/);
  assert.match(read("next/sw.js"), /self\.registration\.unregister\(\)/);
  assert.ok(!fs.existsSync(path.join(root, "next", "core.js")));
});

test("the iPhone app paints pistachio (plum in Dark) while Scales loads, so nothing flashes", () => {
  const swift = read("ios/App/WebViewController.swift");
  assert.match(swift, /web\.backgroundColor = UIColor \{ traits in/);
  assert.match(swift, /\? UIColor\(red: 0x3B \/ 255, green: 0x22 \/ 255, blue: 0x40 \/ 255, alpha: 1\)/);
  assert.match(swift, /: UIColor\(red: 0xB9 \/ 255, green: 0xC9 \/ 255, blue: 0xA3 \/ 255, alpha: 1\)/);
});
test("the fixed icons keep their own colors in Dark (2.6.0)", () => {
  for (const n of ["Pistachio", "Plum", "Bone"]) {
    const j = JSON.parse(read("ios/App/AppIcon-" + n + ".icon/icon.json"));
    const bg = j["fill-specializations"], dark = bg.find((s) => s.appearance === "dark"), plain = bg.find((s) => !s.appearance);
    assert.ok(dark && dark.value.solid === plain.value.solid, n + " background");
    j.groups.forEach((g) => g.layers.forEach((l) => { const s = l["fill-specializations"]; assert.equal(s.find((x) => x.appearance === "dark").value.solid, s.find((x) => !x.appearance).value.solid, n + " " + g.name); }));
  }
});

test("the manifest points at icons that exist", () => {
  const m = JSON.parse(read("manifest.webmanifest"));
  assert.equal(m.scope, "./");
  for (const i of m.icons) assert.ok(fs.existsSync(path.join(root, i.src)), i.src);
  assert.equal(m.theme_color, "#B9C9A3");
});

test("Scales reads Scales 1's data and never writes to it", () => {
  const nx = read("index.html");
  assert.match(nx, /scales\.thoughts\.v1/);
  assert.ok(!/setItem\(\s*["']scales\.thoughts\.v1["']/.test(nx), "no write to the old key");
  assert.ok(!/removeItem\(\s*["']scales\.thoughts\.v1["']/.test(nx), "no delete of the old key");
  assert.match(nx, /scales\.next\.thoughts\.v1/);
});

test("mergeOld: adds thoughts written in the current app later, never overwrites, never revives a deleted one", () => {
  const now = at(2026, 10, 29);
  const store = N.importOld({ a: { id: "a", text: "First", status: "active" } }, now);
  store.oa.text = "Edited here";
  const old = {
    a: { id: "a", text: "First, edited there", status: "active" },
    b: { id: "b", text: "Written there later", status: "active" },
    c: { id: "c", text: "Deleted here", status: "active" },
    d: { id: "d", text: "Lived there", status: "shed", shed_at: "2026-10-28T00:00:00Z" }
  };
  const before = JSON.stringify(old);
  assert.equal(N.mergeOld(store, old, now, ["oc"]), 2);
  assert.equal(store.oa.text, "Edited here", "this app's copy wins");
  assert.equal(store.ob.due, "2026-10-29", "a new one is due today");
  assert.equal(store.oc, undefined, "a deleted one stays deleted");
  assert.ok(store.od.away, "a lived one arrives put away");
  assert.equal(JSON.stringify(old), before, "the old data is never changed");
  assert.equal(N.mergeOld(store, old, now, ["oc"]), 0, "running it again adds nothing");
});

test("Scales saves daily through the iPhone app and quiets Scales 1's reminders", () => {
  const nx = read("index.html");
  assert.match(nx, /post\(\{ type: "save", json: JSON\.stringify\(backupData\(\)\), day: C\.dayKey\(now\(\)\) \}\)/);
  assert.match(nx, /post\(\{ type: "ready" \}\); post\(\{ type: "unschedule" \}\); post\(\{ type: "badge", count: 0 \}\);/);
  assert.match(nx, /"scales\.thoughts\.v1", "scales\.prefs\.v1", "scales\.activity\.v1", "scales\.quotes\.v1"/, "backups carry the current app's data as it is");
  assert.ok(!/scales\.apikey\.v1/.test(nx), "never copies the API key");
  const swift = read("ios/App/Haptics.swift");
  for (const s of ["thud", "letgo", "signature", "medium", "success"]) assert.match(swift, new RegExp('case "' + s + '"'), s);
});

test("the visit log keeps raw times and the lines in force, newest 5000 (2.0.1)", () => {
  const log = [];
  N.logVisit(log, { at: "2026-10-29T12:00:00Z", id: "a", ms: 12345.6, worked: false, idle: false, kind: "thought", how: "next", len: 40 });
  assert.deepEqual(log[0], { at: "2026-10-29T12:00:00Z", id: "a", ms: 12346, worked: false, idle: false, kind: "thought", how: "next", len: 40, lines: [N.SKIP_MAX_MS / 1000, N.THOUGHT_MIN_MS / 1000] });
  for (let i = 0; i < N.LOG_MAX + 10; i++) N.logVisit(log, { at: "x", id: "b" + i, ms: 1, kind: "skipped", how: "next" });
  assert.equal(log.length, N.LOG_MAX);
  assert.equal(log[log.length - 1].id, "b" + (N.LOG_MAX + 9), "the newest stay");
  const nx = read("index.html");
  assert.match(nx, /visits: lsGet\(KEY_LOG, \[\]\)/, "the log travels in the daily backup");
  assert.match(nx, /lg\[lg\.length - 1\]\.undone = true/, "an undone visit is marked");
});

// ---------- Restore (2.1.0) ----------
const mk2 = (id, o) => Object.assign({ id, text: "Thought " + id, note: "", created: "2026-10-01T00:00:00.000Z", due: "2026-11-01", away: null, skips: 0, thinks: 0, works: 0, seen: null, visits: [] }, o);
const NOW = at(2026, 10, 29);
const scales2File = (thoughts, extra) => Object.assign({ app: "scales", version: "2.1.0", exported_at: "2026-10-28T00:00:00Z", thoughts, gone: [] }, extra);

test("restore: a Scales 2 backup adds only what is missing and never changes what is here", () => {
  const store = { a: mk2("a", { text: "Edited here", skips: 3 }) };
  const file = scales2File({ a: mk2("a", { text: "Old wording" }), b: mk2("b"), c: mk2("c", { away: "2026-10-02T00:00:00Z" }) });
  const before = JSON.stringify(store.a);
  const r = N.restoreFrom(store, file, NOW, []);
  assert.equal(r.ok, true); assert.equal(r.kind, "scales2"); assert.equal(r.added, 2);
  assert.equal(JSON.stringify(store.a), before, "an existing thought is untouched");
  assert.ok(store.b && store.c.away, "put away stays put away");
  assert.equal(Object.keys(store).length, 3);
});

test("restore: the same file twice adds nothing the second time", () => {
  const store = {}, file = scales2File({ a: mk2("a"), b: mk2("b") });
  assert.equal(N.restoreFrom(store, file, NOW, []).added, 2);
  const snap = JSON.stringify(store);
  assert.equal(N.restoreFrom(store, file, NOW, []).added, 0);
  assert.equal(JSON.stringify(store), snap);
});

test("restore: a Scales 1 backup arrives like the first import: 5 a day, lived and let-go put away", () => {
  const thoughts = {};
  for (let i = 0; i < 7; i++) thoughts["k" + i] = { id: "k" + i, text: "Old " + i, status: "active", skip_count: 0, created_at: "2026-01-0" + (i + 1) + "T00:00:00Z" };
  thoughts.s = { id: "s", text: "Lived", status: "shed", shed_at: "2026-09-01T00:00:00Z" };
  const store = {};
  const r = N.restoreFrom(store, { app: "scales", version: 1, thoughts, activity: {}, prefs: {} }, NOW, []);
  assert.equal(r.ok, true); assert.equal(r.kind, "scales1"); assert.equal(r.added, 8);
  assert.equal(N.dueToday(store, NOW).length, 5);
  assert.ok(store.os.away);
  assert.equal(N.restoreFrom(store, { app: "scales", version: 1, thoughts, activity: {}, prefs: {} }, NOW, []).added, 0, "again adds nothing");
});

test("restore: Scales 1's thoughts inside a Scales 2 backup join too, once", () => {
  const store = {};
  const file = scales2File({ a: mk2("a") }, { scales1: { "scales.thoughts.v1": { x: { id: "x", text: "From Scales 1", status: "active" } } } });
  assert.equal(N.restoreFrom(store, file, NOW, []).added, 2);
  assert.ok(store.ox);
  assert.equal(N.restoreFrom(store, file, NOW, []).added, 0);
});

test("restore: a trial (scales-next) backup is accepted; other files are refused and change nothing", () => {
  const store = { a: mk2("a") }, snap = JSON.stringify(store);
  assert.equal(N.restoreFrom(store, { app: "scales-next", version: "2.0.0-next.2", thoughts: { b: mk2("b") } }, NOW, []).added, 1);
  const s2 = { a: mk2("a") }, snap2 = JSON.stringify(s2);
  for (const bad of [null, [], "x", 5, {}, { app: "other", thoughts: {} }, { app: "scales", version: "2.1.0" }, { app: "scales", version: "2.1.0", thoughts: [] }, { thoughts: { a: mk2("a") } }]) {
    const r = N.restoreFrom(s2, bad, NOW, ["zz"]);
    assert.equal(r.ok, false, JSON.stringify(bad)); assert.equal(r.added, 0); assert.deepEqual(r.gone, ["zz"]);
  }
  assert.equal(JSON.stringify(s2), snap2);
  assert.ok(snap);
});

test("restore: damaged thoughts are skipped or cleaned, never trusted", () => {
  const store = {};
  const file = scales2File({
    ok: mk2("ok"), noText: mk2("noText", { text: "  " }), noId: { text: "x" }, num: mk2("num", { text: 5 }), nul: null,
    odd: mk2("odd", { due: "tomorrow", skips: -3, thinks: "many", works: 2.7, away: 5, note: 7, visits: "no" })
  });
  const r = N.restoreFrom(store, file, NOW, []);
  assert.equal(r.added, 2);
  assert.equal(store.odd.due, "2026-10-29", "a bad date becomes today");
  assert.equal(store.odd.skips, 0); assert.equal(store.odd.thinks, 0); assert.equal(store.odd.works, 2);
  assert.ok(store.odd.away, "a put-away mark in an odd form still means put away"); assert.equal(store.odd.note, ""); assert.deepEqual(store.odd.visits, []);
});

test("restore: deletions travel, but a thought in the file comes back even if it was deleted here", () => {
  const store = { keep: mk2("keep") };
  const file = scales2File({ back: mk2("back"), keep: mk2("keep") }, { gone: ["ogone", "keep"] });
  const r = N.restoreFrom(store, file, NOW, ["back", "other"]);
  assert.deepEqual(r.gone.sort(), ["ogone", "other"], "back leaves the list; keep is here so it is not listed; the file's ogone joins");
  assert.ok(store.back && store.keep);
  const s2 = {};
  N.restoreFrom(s2, scales2File({ a: mk2("a"), z: mk2("z") }, { gone: ["z"] }), NOW, []);
  assert.ok(s2.a && !s2.z, "a thought the file itself lists as deleted is not added");
});

test("restore: visit-log entries merge without duplicates and stay in time order", () => {
  const e = (at, id) => ({ at, id, ms: 1000, kind: "skipped" });
  const log = [e("2026-10-29T10:00:00Z", "a"), e("2026-10-29T12:00:00Z", "b")];
  const added = N.mergeLog(log, [e("2026-10-29T12:00:00Z", "b"), e("2026-10-29T11:00:00Z", "c")]);
  assert.equal(added, 1);
  assert.deepEqual(log.map((x) => x.id), ["a", "c", "b"]);
  const r = N.restoreFrom({}, scales2File({ a: mk2("a") }, { visits: [e("2026-10-28T00:00:00Z", "a"), { bad: true }] }), NOW, []);
  assert.equal(r.visits.length, 1);
});

test("restore review (2.1.0): a backup from a later Scales is refused, not read as Scales 1", () => {
  const store = { a: mk2("a") }, snap = JSON.stringify(store);
  for (const v of ["3.0.0", "10.1", 2, null, undefined]) {
    const r = N.restoreFrom(store, { app: "scales", version: v, thoughts: { b: mk2("b") } }, NOW, []);
    assert.equal(r.ok, false, String(v)); assert.equal(r.kind, "newer");
  }
  assert.equal(JSON.stringify(store), snap, "nothing added, and no o-prefixed copies");
  assert.equal(N.restoreFrom({}, { app: "scales", version: "1", thoughts: {} }, NOW, []).kind, "scales1");
});

test("restore review (2.1.0): ids that look like built-in names are handled like any other", () => {
  const store = {};
  const file = scales2File(JSON.parse('{"a":{"id":"constructor","text":"C"},"b":{"id":"toString","text":"T"},"c":{"id":"__proto__","text":"P"}}'));
  const r = N.restoreFrom(store, file, NOW, []);
  assert.deepEqual(Object.keys(store).sort(), ["constructor", "toString"]);
  assert.equal(r.added, 2); assert.deepEqual(r.ids.sort(), ["constructor", "toString"]);
  assert.equal(Object.getPrototypeOf(store), Object.prototype, "nothing reaches the object's prototype");
  assert.equal(N.restoreFrom(store, file, NOW, []).added, 0);
});

test("restore review (2.1.0): r.ids lists exactly what was added, so the page can take it back if saving fails", () => {
  const store = { a: mk2("a") };
  const r = N.restoreFrom(store, scales2File({ a: mk2("a"), b: mk2("b"), c: mk2("c") }), NOW, []);
  assert.deepEqual(r.ids.sort(), ["b", "c"]);
  r.ids.forEach((id) => delete store[id]);
  assert.deepEqual(Object.keys(store), ["a"]);
});

test("restore review (2.1.0): restored counts stay in range and missing dates become now", () => {
  const store = {};
  N.restoreFrom(store, scales2File({ x: mk2("x", { skips: 40, created: 7 }) }), NOW, []);
  assert.equal(store.x.skips, 4); assert.equal(store.x.created, NOW.toISOString());
});

// ---------- Bookmarks and Recently added (2.2.0) ----------
test("bookmarks: newest first, in rotation or put away, and a visit never changes one", () => {
  const store = { a: mk2("a", { bookmarked: "2026-10-20T10:00:00.000Z" }), b: mk2("b"), c: mk2("c", { bookmarked: "2026-10-25T10:00:00.000Z", away: "2026-10-26T00:00:00Z" }) };
  assert.deepEqual(N.bookmarked(store).map((t) => t.id), ["c", "a"]);
  assert.equal(N.make("x", NOW).bookmarked, null);
  const t = store.a, due = t.due;
  N.recordVisit(t, 2000, false, false, NOW);
  assert.equal(t.bookmarked, "2026-10-20T10:00:00.000Z", "a visit leaves the bookmark alone");
  assert.notEqual(N.weight(mk2("w", { bookmarked: "2026-10-20T10:00:00.000Z" })), 0);
  assert.equal(N.weight(mk2("w", { bookmarked: "2026-10-20T10:00:00.000Z" })), N.weight(mk2("w")), "weight ignores bookmarks");
  assert.ok(due);
});
test("recently added: made in the last 14 days, newest first; editing does not change the date", () => {
  const store = { old: mk2("old", { created: "2026-09-01T00:00:00.000Z" }), n1: mk2("n1", { created: "2026-10-20T00:00:00.000Z" }), n2: mk2("n2", { created: "2026-10-27T00:00:00.000Z" }),
    edge: mk2("edge", { created: new Date(NOW.getTime() - 14 * 86400000).toISOString() }), bad: mk2("bad", { created: "not a date" }) };
  assert.deepEqual(N.recentlyAdded(store, NOW).map((t) => t.id), ["n2", "n1", "edge"]);
  store.old.text = "Edited just now"; store.old.seen = NOW.toISOString();
  assert.ok(!N.recentlyAdded(store, NOW).some((t) => t.id === "old"), "an edit does not make a thought new");
});
test("restore (2.2.0): bookmarks come across, bad ones are cleaned, and an existing thought keeps its own", () => {
  const store = { a: mk2("a", { bookmarked: null }) };
  const file = scales2File({ a: mk2("a", { bookmarked: "2026-10-01T00:00:00Z" }), b: mk2("b", { bookmarked: "2026-10-02T00:00:00Z" }), c: mk2("c", { bookmarked: true }), d: mk2("d", { bookmarked: 5 }), e: mk2("e") });
  N.restoreFrom(store, file, NOW, []);
  assert.equal(store.a.bookmarked, null, "a thought already here is untouched");
  assert.equal(store.b.bookmarked, "2026-10-02T00:00:00Z");
  assert.ok(typeof store.c.bookmarked === "string", "true still means bookmarked");
  assert.ok(store.d.bookmarked, "any truthy mark still means bookmarked");
  assert.equal(store.e.bookmarked, null);
});

test("restore review (2.2.0): a bookmark in an odd form is kept as now, and Scales 1 thoughts arrive unbookmarked", () => {
  const store = {};
  N.restoreFrom(store, scales2File({ a: mk2("a", { bookmarked: "yesterday" }), b: mk2("b", { bookmarked: "" }), c: mk2("c", { bookmarked: 0 }) },
    { scales1: { "scales.thoughts.v1": { x: { id: "x", text: "Old", status: "active" } } } }), NOW, []);
  assert.equal(store.a.bookmarked, NOW.toISOString());
  assert.equal(store.b.bookmarked, null); assert.equal(store.c.bookmarked, null);
  assert.ok(!store.ox.bookmarked);
  assert.deepEqual(N.bookmarked(store).map((t) => t.id), ["a"]);
});

// ---- 2.3.0: who said it, sets, starters ----
const SETS = require("../sets.js");
test("make keeps who said it; blank means your own; looksQuoted spots an opening quotation mark", () => {
  const now = at(2026, 10, 29);
  assert.equal(N.make("x", now).by, "");
  assert.equal(N.make("x", now, "  Seneca ").by, "Seneca");
  assert.equal(N.make("x", now, "a".repeat(300)).by.length, 200);
  assert.ok(N.looksQuoted('"Hello'));
  assert.ok(N.looksQuoted("“Hello"));
  assert.ok(N.looksQuoted("  'Hi"));
  assert.ok(!N.looksQuoted("Hello"));
});
test("addSet: two a day in order, never doubles, brings back a deleted line", () => {
  const now = at(2026, 10, 29), store = {};
  const set = SETS.sets.find((s) => s.id === "franklin");
  const r = N.addSet(store, set, now, ["s-fr-order", "other"]);
  assert.equal(r.added, 13);
  assert.deepEqual(r.gone, ["other"]);
  const ts = N.fromSet(store, "franklin");
  assert.equal(ts.length, 13);
  const day0 = N.dayKey(now);
  assert.equal(ts.filter((t) => t.due === day0).length, 2);
  assert.equal(store["s-fr-temperance"].due, day0);
  assert.equal(store["s-fr-order"].due, N.addDays(day0, 1));
  assert.equal(store["s-fr-pride"].due, N.addDays(day0, 6));
  assert.equal(store["s-fr-industry"].by, "Benjamin Franklin, Autobiography");
  assert.equal(store["s-fr-industry"].set, "franklin");
  assert.equal(N.addSet(store, set, now, []).added, 0);
});
test("removeSet: deletes unseen lines, puts away met ones, leaves the person's own work alone", () => {
  const now = at(2026, 10, 29), store = {};
  const set = SETS.sets.find((s) => s.id === "stoics");
  N.addSet(store, set, now, []);
  N.recordVisit(store["s-ep-power"], 40000, false, false, now);
  store["s-ep-views"].bookmarked = now.toISOString();
  store["s-ep-demand"].note = "mine";
  store["s-ep-lost"].away = "2026-10-01T00:00:00Z";
  store.mine = N.make("my own", now);
  const r = N.removeSet(store, "stoics", now, ["x"]);
  assert.equal(r.putAway, 1);
  assert.equal(r.deleted, 19 - 4);
  assert.ok(store["s-ep-power"].away);
  assert.ok(!store["s-ep-views"].away && !store["s-ep-demand"].away);
  assert.equal(store["s-ep-lost"].away, "2026-10-01T00:00:00Z");
  assert.ok(store.mine && !store["s-ma-happy"]);
  assert.ok(r.gone.includes("x") && r.gone.includes("s-ma-happy"));
});
test("addStarters: the five starter lines, all due today, from their sets", () => {
  const now = at(2026, 10, 29), store = {};
  assert.equal(N.addStarters(store, SETS.sets, SETS.starters, now), 5);
  assert.equal(N.dueToday(store, now).length, 5);
  assert.equal(store["s-q-busy"].by, "");
  assert.equal(store["s-ma-dyed"].set, "stoics");
  assert.equal(N.addStarters(store, SETS.sets, SETS.starters, now), 0);
});
test("restore keeps who said it and the set a thought came from; old files without them still load", () => {
  const now = at(2026, 10, 29), store = {};
  const t = N.make("q", now, "Pascal"); t.set = "know"; t.item = "pa-reed";
  const r = N.restoreFrom(store, { app: "scales", version: "2.3.0", thoughts: { [t.id]: t } }, now, []);
  assert.ok(r.ok);
  assert.equal(store[t.id].by, "Pascal");
  assert.equal(store[t.id].set, "know");
  assert.equal(store[t.id].item, "pa-reed");
  const s2 = {};
  N.restoreFrom(s2, { app: "scales", version: "2.2.0", thoughts: { a: { id: "a", text: "old" } } }, now, []);
  assert.equal(s2.a.by, "");
  assert.equal(s2.a.set, undefined);
});
test("every set line has text and a unique id; starters exist", () => {
  const ids = new Set();
  SETS.sets.forEach((s) => s.items.forEach((it) => { assert.ok(it.text && it.text.trim()); assert.ok(!ids.has(it.id)); ids.add(it.id); }));
  SETS.starters.forEach((s) => assert.ok(ids.has(s)));
});
test("sets.js is built from the current content/sets.json", () => {
  const fs = require("fs"), path = require("path");
  assert.equal(fs.readFileSync(path.join(__dirname, "..", "sets.js"), "utf8"), require("../scripts/build-sets.js")());
});

test("onTrial: a set line until it is met twice, noted, changed or bookmarked; never your own", () => {
  const now = at(2026, 10, 29), store = {};
  N.addSet(store, SETS.sets.find((s) => s.id === "stoics"), now, []);
  const t = store["s-ep-power"];
  assert.ok(N.onTrial(t));
  N.recordVisit(t, 5000, false, false, now); assert.ok(N.onTrial(t));
  N.recordVisit(t, 5000, false, false, now); assert.ok(!N.onTrial(t));
  const u = store["s-ep-views"]; u.note = "x"; assert.ok(!N.onTrial(u));
  const v = store["s-ep-demand"]; v.bookmarked = now.toISOString(); assert.ok(!N.onTrial(v));
  const w = store["s-ep-lost"]; w.works = 1; assert.ok(!N.onTrial(w));
  assert.ok(!N.onTrial(N.make("mine", now)));
});
test("clearPutAway deletes a set's put-away lines but keeps marked, noted or changed ones", () => {
  const now = at(2026, 10, 29), store = {};
  N.addSet(store, SETS.sets.find((s) => s.id === "franklin"), now, []);
  ["s-fr-order", "s-fr-silence", "s-fr-industry", "s-fr-justice"].forEach((id) => { store[id].away = now.toISOString(); });
  store["s-fr-silence"].bookmarked = now.toISOString();
  store["s-fr-industry"].note = "kept";
  assert.equal(N.clearable(store, "franklin"), 2);
  const r = N.clearPutAway(store, "franklin", ["x"]);
  assert.equal(r.deleted, 2);
  assert.ok(!store["s-fr-order"] && !store["s-fr-justice"] && store["s-fr-silence"] && store["s-fr-industry"] && store["s-fr-temperance"]);
  assert.deepEqual(r.gone.sort(), ["s-fr-justice", "s-fr-order", "x"]);
});

// ---- 2.6.0: Apple Intelligence test (the counting is ours; the model only writes words) ----
test("parseThemes cleans the model's list", () => {
  assert.deepEqual(N.parseThemes("1. Family\n- work \n* Faith and doubt\n\nfamily\nA very long theme name that goes on and on\nHealth."), ["Family", "Work", "Faith and doubt", "Health"]);
  assert.deepEqual(N.parseThemes("Family, Work, Money"), ["Family", "Work", "Money"]);
  assert.equal(N.parseThemes("a\nb\nc\nd\ne\nf\ng\nh\ni\nj").length, 8);
});
test("matchTheme takes an exact name, else the longest one mentioned, else none", () => {
  const th = ["Work", "Family", "Work life"];
  assert.equal(N.matchTheme("Family", th), "Family");
  assert.equal(N.matchTheme("  \"family.\" ", th), "Family");
  assert.equal(N.matchTheme("This is about Work life balance", th), "Work life");
  assert.equal(N.matchTheme("Something else", th), null);
});
test("themeSample: at most 50, spread across time, each cut short", () => {
  const now = at(2026, 10, 29), store = {};
  for (let i = 0; i < 120; i++) { const t = N.make("Thought " + i + " " + "x".repeat(200), new Date(now.getTime() - (120 - i) * 3600000)); store[t.id] = t; }
  const s = N.themeSample(store).split("\n");
  assert.equal(s.length, 50);
  assert.ok(s[0].startsWith("1. Thought 0 ") && s[49].includes("Thought 117"));
  assert.ok(s.every((l) => l.length < 160));
});
test("themeWeek and weekFacts count from the log, leave out reviews and undone visits, and only state what is true", () => {
  const now = at(2026, 10, 29), store = {}, tags = {};
  const a = N.make("a", now), b = N.make("b", now), c = N.make("c", now);
  store[a.id] = a; store[b.id] = b; store[c.id] = c; tags[a.id] = "Family"; tags[b.id] = "Work"; tags[c.id] = "Work";
  c.away = now.toISOString();
  const e = (id, kind, ms, x) => Object.assign({ at: new Date(now.getTime() - 3600000).toISOString(), id, kind, ms }, x || {});
  const log = [e(a.id, "thought", 40000), e(a.id, "thought", 50000), e(b.id, "skipped", 3000), e(b.id, "skipped", 5000), e(c.id, "skipped", 4000),
    e(a.id, "review", 90000), e(b.id, "thought", 60000, { undone: true }), { at: "2026-01-01T00:00:00Z", id: a.id, kind: "thought", ms: 1 }];
  const rows = N.themeWeek(store, log, tags, now, 7);
  const fam = rows.find((r) => r.theme === "Family"), work = rows.find((r) => r.theme === "Work");
  assert.deepEqual([fam.visits, fam.avgSec, fam.thought, fam.thoughts], [2, 45, 2, 1]);
  assert.deepEqual([work.visits, work.skipped, work.putAway, work.thoughts], [3, 3, 1, 2]);
  const f = N.weekFacts(rows, 7).join(" ");
  assert.ok(/met thoughts 5 times/.test(f) && /Work thoughts most often: 3 times/.test(f) && /longest with Family thoughts: about 45 seconds/.test(f));
  assert.ok(/moved past Work thoughts quickest: 3 of 3/.test(f) && /put away 1 Work thought\./.test(f));
  assert.deepEqual(N.weekFacts([], 7), []);
});

// ---- 2.7.0: Import ----
test("parseImport: lines, dashes and names under quotes become who said it", () => {
  const r = N.parseImport('Be kind.\nWork hard. — Ben Franklin\n"Stay hungry" - Steve Jobs\n“Know thyself.”\n– Socrates\n1. My own thought - with a hyphen\n- a bullet.');
  assert.deepEqual(r, [
    { text: "Be kind.", by: "" }, { text: "Work hard.", by: "Ben Franklin" }, { text: "Stay hungry", by: "Steve Jobs" },
    { text: "Know thyself.", by: "Socrates" }, { text: "My own thought - with a hyphen", by: "" }, { text: "a bullet.", by: "" }]);
});
test("parseImport: blank lines split into paragraphs, with a name on the last line", () => {
  const r = N.parseImport("“The obstacle is the way.”\n— Marcus Aurelius\n\nI should call my dad more.\nIt matters.\n\nSimplify, simplify. ~ Thoreau");
  assert.deepEqual(r, [{ text: "The obstacle is the way.", by: "Marcus Aurelius" }, { text: "I should call my dad more.\nIt matters.", by: "" }, { text: "Simplify, simplify.", by: "Thoreau" }]);
  assert.equal(N.parseImport("a\n\nb", "lines").length, 2);
  assert.equal(N.parseImport("a\nb", "paragraphs").length, 1);
});
test("parseImport: a CSV with a quote column, and a Kindle clippings file", () => {
  assert.deepEqual(N.parseImport('Highlight,Title,Author\n"Hello, ""world""",Book One,Jane Doe\nSecond,B2,\n'),
    [{ text: 'Hello, "world"', by: "Jane Doe, Book One" }, { text: "Second", by: "B2" }]);
  const k = "﻿Meditations (Marcus Aurelius)\r\n- Your Highlight on page 3 | Added on Monday\r\n\r\nWaste no time.\r\n==========\r\nWalden (Henry David Thoreau)\r\n- Your Note on page 9\r\n\r\nSimplify.\r\n==========\r\n";
  assert.deepEqual(N.parseImport(k), [{ text: "Waste no time.", by: "Marcus Aurelius, Meditations" }, { text: "Simplify.", by: "Henry David Thoreau, Walden" }]);
});
test("parseImport drops empty and repeated lines", () => {
  assert.deepEqual(N.parseImport("One\n\n\nOne\none \n  \nTwo", "lines").map((x) => x.text), ["One", "Two"]);
});
test("importThoughts: five a day from today, skips ones already here", () => {
  const now = at(2026, 10, 30), store = {};
  const mine = N.make("Already here", now); store[mine.id] = mine;
  const items = [{ text: "already HERE", by: "" }].concat(Array.from({ length: 12 }, (_, i) => ({ text: "Q" + i, by: i ? "" : "Seneca" })));
  const r = N.importThoughts(store, items, now);
  assert.deepEqual(r, { added: 12, skipped: 1 });
  const ts = Object.values(store).filter((t) => t.from === "import");
  const day = N.dayKey(now);
  assert.equal(ts.filter((t) => t.due === day).length, 5);
  assert.equal(ts.filter((t) => t.due === N.addDays(day, 2)).length, 2);
  assert.equal(ts.find((t) => t.text === "Q0").by, "Seneca");
  assert.equal(new Set(ts.map((t) => t.id)).size, 12);
});

// ---- 2.9.0: today's pile ----
function pileStore(due, fresh, later) {
  const now = new Date("2026-11-02T09:00:00"), st = {};
  for (let i = 0; i < due; i++) st["d" + i] = { id: "d" + i, text: "due " + i, created: "2026-10-01T00:00:00.000Z", due: "2026-11-01", away: null, skips: 0, seen: "2026-10-20T00:00:00.000Z", visits: [{ at: "x", kind: "seen", ms: 9 }] };
  for (let i = 0; i < fresh; i++) st["n" + i] = { id: "n" + i, text: "new " + i, created: "2026-10-30T00:00:00.000Z", due: "2026-11-02", away: null, skips: 0, seen: null, visits: [] };
  for (let i = 0; i < later; i++) st["l" + i] = { id: "l" + i, text: "later " + i, created: "2026-10-01T00:00:00.000Z", due: "2026-11-0" + (3 + (i % 6)), away: null, skips: 0, seen: "2026-10-20T00:00:00.000Z", visits: [{ at: "x", kind: "seen", ms: 9 }] };
  return { now, st };
}
// Walk a day: each card shown is logged and, unless a review, moved off today (as a visit would).
function walk(st, now, steps, more) {
  const log = [], order = [];
  for (let i = 0; i < steps; i++) {
    const r = N.nextCard(st, log, now, null, more);
    if (!r.card) { order.push(r.why); break; }
    order.push(r.pile + ":" + r.card.id);
    log.push({ at: now.toISOString(), id: r.card.id, pile: r.pile });
    if (!r.review) { st[r.card.id].due = "2026-11-05"; st[r.card.id].seen = now.toISOString(); st[r.card.id].visits = [{ at: "x" }]; }
  }
  return order;
}

test("the pile spreads new thoughts through the due ones, never two in a row (2.9.0)", () => {
  const { now, st } = pileStore(25, 5, 0);
  const o = walk(st, now, 30).filter((x) => /^(new|due)/.test(x));
  assert.equal(o.length, 30);
  const at = o.map((x, i) => (x.startsWith("new") ? i : -1)).filter((i) => i >= 0);
  assert.equal(at.length, 5);
  assert.ok(at[0] >= 3 && at[0] <= 7, "first new near the sixth card: " + at);
  assert.ok(at[4] <= 29 && at[4] >= 22, "last new near the end, not bunched: " + at);
  for (let i = 1; i < at.length; i++) assert.ok(at[i] - at[i - 1] >= 3, "spread out: " + at);
});

test("a light day tops up to 30 with reviews, then stops (2.9.0)", () => {
  const { now, st } = pileStore(4, 2, 40);
  const o = walk(st, now, 40);
  assert.equal(o.slice(0, 6).filter((x) => /^(due|new)/.test(x)).length, 6, "real cards first: " + o.slice(0, 6));
  assert.ok(o.slice(6, 30).every((x) => x.startsWith("extra:")), "then reviews");
  assert.equal(o[30], "limit");
  assert.equal(st.l0.due, "2026-11-03", "a review never moves a schedule");
});

test("Keep going: real cards first, then reviews, until everything is seen once today (2.9.0)", () => {
  const { now, st } = pileStore(35, 0, 3);
  const log = [];
  for (let i = 0; i < 30; i++) { const r = N.nextCard(st, log, now); log.push({ at: now.toISOString(), id: r.card.id, pile: r.pile }); st[r.card.id].due = "2026-11-05"; }
  assert.equal(N.nextCard(st, log, now).why, "limit");
  const order = [];
  for (let i = 0; i < 20; i++) {
    const r = N.nextCard(st, log, now, null, true);
    if (!r.card) { order.push(r.why); break; }
    order.push(r.pile); log.push({ at: now.toISOString(), id: r.card.id, pile: r.pile });
    if (!r.review) st[r.card.id].due = "2026-11-05";
  }
  assert.deepEqual(order, ["due", "due", "due", "due", "due", "more", "more", "more", "done"]);
});

test("undone visits don't count toward the day (2.9.0)", () => {
  const { now, st } = pileStore(0, 0, 40);
  const log = Array.from({ length: 30 }, (_, i) => ({ at: now.toISOString(), id: "l" + i, pile: "extra", undone: i === 0 }));
  assert.ok(N.nextCard(st, log, now).card, "29 counted, so one more fits");
});

test("session position: a gap over 5 minutes starts a new session (2.9.0)", () => {
  const t0 = Date.parse("2026-11-02T09:00:00Z");
  const log = [{ at: new Date(t0).toISOString(), n: 7 }];
  assert.equal(N.sessionPos(log, t0 + 40000, 30000), 8);
  assert.equal(N.sessionPos(log, t0 + 6 * 60000 + 30000, 30000), 1);
  assert.equal(N.sessionPos([], t0, 0), 1);
});

test("waiting counts never-met thoughts not yet arrived (2.9.0)", () => {
  const { now, st } = pileStore(1, 2, 0);
  st.w = { id: "w", text: "w", created: "x", due: "2026-11-09", away: null, seen: null, visits: [] };
  assert.equal(N.waiting(st, now), 1);
});

test("the log keeps pile, position, size and class (2.9.0)", () => {
  const lg = N.logVisit([], { at: "2026-11-02T09:00:00Z", id: "a", ms: 4000, kind: "review", how: "next", pile: "extra", n: 3, size: 30, cls: "skipped" });
  assert.equal(lg[0].pile, "extra"); assert.equal(lg[0].n, 3); assert.equal(lg[0].size, 30); assert.equal(lg[0].cls, "skipped");
});

// ---- 2.10.0: telemetry ----
test("the event log keeps the newest EVENTS_MAX (2.10.0)", () => {
  const ev = [];
  for (let i = 0; i < N.EVENTS_MAX + 5; i++) N.track(ev, { t: String(i), e: "tap" });
  assert.equal(ev.length, N.EVENTS_MAX); assert.equal(ev[0].t, "5");
});
test("merging events adds only the ones not already there, in time order (2.10.0)", () => {
  const ev = [{ t: "2026-11-01T00:00:00Z", e: "tap", id: "a" }];
  const n = N.mergeEvents(ev, [{ t: "2026-11-01T00:00:00Z", e: "tap", id: "a" }, { t: "2026-10-31T00:00:00Z", e: "boot" }, { bad: 1 }]);
  assert.equal(n, 1); assert.equal(ev[0].e, "boot"); assert.equal(ev.length, 2);
});
test("the daily snapshot counts the collection without any thought text (2.10.0)", () => {
  const now = new Date("2026-11-02T09:00:00");
  const st = { a: { id: "a", text: "secret words", created: "2026-11-01T00:00:00.000Z", due: "2026-11-02", away: null, from: "import", by: "X", seen: null, visits: [] },
    b: { id: "b", text: "more", created: "2026-01-01T00:00:00.000Z", due: "2026-11-09", away: "2026-10-01", note: "n", seen: "x", visits: [{}] } };
  const s = N.snapshot(st, now);
  assert.equal(s.total, 2); assert.equal(s.away, 1); assert.equal(s.due, 1); assert.equal(s.src.import, 1); assert.equal(s.src.own, 1);
  assert.equal(s.withBy, 1); assert.equal(s.withNote, 1); assert.equal(s.added7, 1);
  assert.ok(!JSON.stringify(s).includes("secret"));
});
test("a backup's events come back on restore (2.10.0)", () => {
  const r = N.restoreFrom({}, { app: "scales", version: "2.10.0", thoughts: {}, events: [{ t: "2026-11-01T00:00:00Z", e: "boot" }, { nope: 1 }] }, new Date(), []);
  assert.ok(r.ok); assert.equal(r.events.length, 1);
});

// ---- 2.11.0: a "- Name" line names the line above, with or without quotation marks ----
test("import, each line: a dash-name line under an unquoted line becomes who said it (2.11.0)", () => {
  const r = N.parseImport("The obstacle is the way.\nWaste no more time arguing what a good man should be. Be one.\n- Marcus Aurelius\nWell done is better than well said.", "lines");
  assert.strictEqual(r.length, 3);
  assert.strictEqual(r[1].text, "Waste no more time arguing what a good man should be. Be one.");
  assert.strictEqual(r[1].by, "Marcus Aurelius");
  assert.strictEqual(r[0].by, ""); assert.strictEqual(r[2].by, "");
});
test("import, each line: a bulleted list of short thoughts stays a list (2.11.0)", () => {
  const r = N.parseImport("- Rest is part of the work.\n- Be kind\n- Say less", "lines");
  assert.deepStrictEqual(r.map((x) => x.text), ["Rest is part of the work.", "Be kind", "Say less"]);
  assert.ok(r.every((x) => !x.by));
});
test("import, each line: a quoted line with a dash-name under it still works (2.11.0)", () => {
  const r = N.parseImport("“Well done is better than well said.”\n- Benjamin Franklin", "lines");
  assert.strictEqual(r.length, 1); assert.strictEqual(r[0].text, "Well done is better than well said."); assert.strictEqual(r[0].by, "Benjamin Franklin");
});
