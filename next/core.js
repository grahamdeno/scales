// Scales (next): the logic, kept apart from the page so it can be tested in Node.
// One rule runs everything: the person only ever moves on (swipe up) or puts a thought away (pull down).
// What a visit meant is read from how long it lasted and whether they wrote anything.
(function (root) {
  "use strict";
  var VERSION = "2.0.0-next.1";

  // How a visit is read. Time counts only while the app is open and the thought is on screen.
  var SKIP_MAX_MS = 7000;      // 7 s or less: skipped
  var THOUGHT_MIN_MS = 11000;  // 11 s or more: thought about
  var IDLE_MS = 5 * 60000;     // past 5 min with no touch, assume the phone was set down: only seen

  // A day starts at 4 AM, so a late night counts as the day it began.
  var DAY_START_HOUR = 4;
  var NEW_PER_DAY = 5;         // imported thoughts arrive this many a day, not all at once

  function dayKey(d) {
    var x = new Date(d.getTime() - DAY_START_HOUR * 3600000);
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
  }
  function addDays(key, n) {
    var p = key.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2] + n);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function uid() { return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // A visit: how long it was on screen, and whether the person changed the words or the note.
  function classify(ms, worked, idle) {
    if (worked) return "worked";
    if (idle) return "seen";
    if (ms <= SKIP_MAX_MS) return "skipped";
    if (ms >= THOUGHT_MIN_MS) return "thought";
    return "seen";
  }

  // When it comes back. Skipping brings it back sooner; thinking about it or working on it pushes it further out
  // each time, so a thought you have clearly absorbed fades in how often it shows. It never leaves on its own.
  function nextGap(t, kind) {
    if (kind === "skipped") return 1;
    if (kind === "seen") return 2;
    if (kind === "thought") return Math.min(2 + 2 * (t.thinks || 0), 21);
    if (kind === "worked") return Math.min(4 + 3 * (t.works || 0), 30);
    return 2;
  }

  function recordVisit(t, ms, worked, idle, now) {
    var kind = classify(ms, worked, idle), today = dayKey(now);
    if (kind === "skipped") t.skips = (t.skips || 0) + 1;
    if (kind === "thought") t.thinks = (t.thinks || 0) + 1;
    if (kind === "worked") t.works = (t.works || 0) + 1;
    // Engaging with a thought works off one skip, so its type lightens as the avoidance is worked off.
    if ((kind === "thought" || kind === "worked") && t.skips > 0) t.skips -= 1;
    t.due = addDays(today, nextGap(t, kind));
    t.seen = now.toISOString();
    t.visits = (t.visits || []).concat([{ at: now.toISOString(), kind: kind, ms: Math.round(ms) }]).slice(-30);
    return kind;
  }

  // Type weight from avoidance: 600 for a fresh thought, heavier with each skip, up to 900.
  function weight(t) { return Math.min(900, 600 + 75 * (t.skips || 0)); }

  function make(text, now) {
    var today = dayKey(now);
    return { id: uid(), text: String(text).trim(), note: "", created: now.toISOString(), due: addDays(today, 1),
      away: null, skips: 0, thinks: 0, works: 0, seen: null, visits: [] };
  }

  function list(store) { return Object.keys(store).map(function (k) { return store[k]; }); }
  function inRotation(store) { return list(store).filter(function (t) { return !t.away; }); }
  function putAway(store) { return list(store).filter(function (t) { return !!t.away; }); }

  // What is due today, most avoided first, then the one waiting longest.
  function dueToday(store, now) {
    var today = dayKey(now);
    return inRotation(store).filter(function (t) { return t.due <= today; }).sort(function (a, b) {
      return (b.skips || 0) - (a.skips || 0) || (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) || (a.created < b.created ? -1 : 1);
    });
  }
  function pickNext(store, now, notId) {
    var d = dueToday(store, now).filter(function (t) { return t.id !== notId; });
    return d.length ? d[0] : null;
  }

  // The earliest day anything comes back, for "Next one back ..." when nothing is due.
  function nextDue(store) {
    var r = inRotation(store).map(function (t) { return t.due; }).sort();
    return r[0] || null;
  }

  // Your thoughts from the current Scales, copied once. Its data is never written to.
  // Thoughts still in its deck join the rotation a few a day, most skipped first; lived and let-go ones arrive put away.
  function importOld(old, now) {
    var out = {}, today = dayKey(now), active = [], rest = [];
    Object.keys(old || {}).forEach(function (k) {
      var o = old[k]; if (!o || !String(o.text || "").trim()) return;
      var t = { id: "o" + String(o.id || k), text: String(o.text).trim(), note: "", created: o.created_at || now.toISOString(),
        due: today, away: null, skips: Math.min(4, o.skip_count || 0), thinks: o.reflect_count || 0, works: 0, seen: null, visits: [], from: "scales-1" };
      if (o.status === "active") active.push(t); else { t.away = o.shed_at || o.letgo_at || now.toISOString(); rest.push(t); }
    });
    active.sort(function (a, b) { return b.skips - a.skips || (a.created < b.created ? -1 : 1); });
    active.forEach(function (t, i) { t.due = addDays(today, Math.floor(i / NEW_PER_DAY)); out[t.id] = t; });
    rest.forEach(function (t) { out[t.id] = t; });
    return out;
  }

  // "Tomorrow", "Today", a weekday for the coming week, else a short date.
  function whenLabel(key, now) {
    var today = dayKey(now);
    if (!key || key <= today) return "Today";
    if (key === addDays(today, 1)) return "Tomorrow";
    var p = key.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]);
    for (var i = 2; i <= 6; i++) if (key === addDays(today, i)) return d.toLocaleDateString("en-US", { weekday: "short" });
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  var api = { VERSION: VERSION, SKIP_MAX_MS: SKIP_MAX_MS, THOUGHT_MIN_MS: THOUGHT_MIN_MS, IDLE_MS: IDLE_MS,
    dayKey: dayKey, addDays: addDays, classify: classify, nextGap: nextGap, recordVisit: recordVisit, weight: weight,
    make: make, list: list, inRotation: inRotation, putAway: putAway, dueToday: dueToday, pickNext: pickNext,
    nextDue: nextDue, importOld: importOld, whenLabel: whenLabel };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.ScalesNext = api;
})(this);
