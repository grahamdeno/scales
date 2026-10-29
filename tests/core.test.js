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

test("classify: 7 s or less is skipped, 11 s or more is thought about, between is seen", () => {
  assert.equal(N.classify(0, false, false), "skipped");
  assert.equal(N.classify(7000, false, false), "skipped");
  assert.equal(N.classify(7001, false, false), "seen");
  assert.equal(N.classify(10999, false, false), "seen");
  assert.equal(N.classify(11000, false, false), "thought");
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
  assert.equal(N.recordVisit(t, 12000, false, false, now), "thought");
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

test("the iPhone app paints pistachio while Scales loads, so nothing flashes grey", () => {
  const swift = read("ios/App/WebViewController.swift");
  assert.match(swift, /web\.backgroundColor = UIColor\(red: 0xB9 \/ 255, green: 0xC9 \/ 255, blue: 0xA3 \/ 255, alpha: 1\)/);
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
