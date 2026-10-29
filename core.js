// Scales: the logic, kept apart from the page so it can be tested in Node.
// One rule runs everything: the person only ever moves on (swipe up) or puts a thought away (pull down).
// What a visit meant is read from how long it lasted and whether they wrote anything.
(function (root) {
  "use strict";
  var VERSION = "2.3.0";

  // How a visit is read. Time counts only while the app is open and the thought is on screen.
  var SKIP_MAX_MS = 20000;     // 20 s or less: skipped (2.1.0; was 7 s)
  var THOUGHT_MIN_MS = 30000;  // 30 s or more: thought about (2.1.0; was 11 s)
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

  // Type weight from avoidance: 600 for a fresh thought, 50 heavier with each skip, up to 800.
  // (Feel review: 900 in Geist at 32 px read as shouting.)
  function weight(t) { return Math.min(800, 600 + 50 * (t.skips || 0)); }

  // by (2.3.0): who said it, when the thought is a quote. Blank means it is the person's own.
  function make(text, now, by) {
    var today = dayKey(now);
    return { id: uid(), text: String(text).trim(), note: "", by: cleanBy(by), created: now.toISOString(), due: addDays(today, 1),
      away: null, bookmarked: null, skips: 0, thinks: 0, works: 0, seen: null, visits: [] };
  }
  function cleanBy(by) { return typeof by === "string" ? by.trim().slice(0, 200) : ""; }
  // A thought typed with an opening quotation mark is probably a quote, so the "Who said it?" line opens by itself.
  function looksQuoted(text) { return /^\s*["\u201C\u2018\u201E\u00AB']/.test(String(text || "")); }

  function list(store) { return Object.keys(store).map(function (k) { return store[k]; }); }
  function inRotation(store) { return list(store).filter(function (t) { return !t.away; }); }
  function putAway(store) { return list(store).filter(function (t) { return !!t.away; }); }

  // Bookmarks (2.2.0): the person's own mark on a thought, a timestamp of when they set it. It changes nothing about
  // when a thought comes back, how heavy it is or whether it is in rotation. Newest bookmark first.
  var NEW_DAYS = 14;
  function bookmarked(store) {
    return list(store).filter(function (t) { return !!t.bookmarked; }).sort(function (a, b) { return a.bookmarked < b.bookmarked ? 1 : a.bookmarked > b.bookmarked ? -1 : 0; });
  }
  // Recently added: made in the last NEW_DAYS days, newest first. Editing never changes the date a thought was made.
  function recentlyAdded(store, now, days) {
    var cut = now.getTime() - (days || NEW_DAYS) * 86400000;
    return list(store).filter(function (t) { var c = Date.parse(t.created); return isFinite(c) && c >= cut && c <= now.getTime() + 86400000; })
      .sort(function (a, b) { return a.created < b.created ? 1 : a.created > b.created ? -1 : 0; });
  }

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

  // The one that would come back soonest, for "Meet one early" once today is done. Ties go to the more avoided one.
  function soonest(store, notId) {
    var r = inRotation(store).filter(function (t) { return t.id !== notId; }).sort(function (a, b) {
      return a.due < b.due ? -1 : a.due > b.due ? 1 : (b.skips || 0) - (a.skips || 0) || (a.created < b.created ? -1 : 1);
    });
    return r[0] || null;
  }

  // The earliest day anything comes back, for "Next one back ..." when nothing is due.
  function nextDue(store) {
    var r = inRotation(store).map(function (t) { return t.due; }).sort();
    return r[0] || null;
  }

  // Your thoughts from Scales 1, copied once. Its data is never written to.
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

  // ---- Sets (2.3.0) ----
  // A set is a list of lines from content/sets.json (built into sets.js). A line becomes an ordinary thought with the
  // id "s-" + its line id, so adding a set twice never makes doubles, and it records which set it came from.
  // Set thoughts arrive SET_PER_DAY a day, in the set's order, so a set never floods the day. Once here, a set
  // thought is treated exactly like one the person wrote: the same visits, the same schedule.
  var SET_PER_DAY = 2;
  function setThought(item, setId, now, due) {
    return { id: "s-" + item.id, text: String(item.text).trim(), note: "", by: cleanBy(item.by), created: now.toISOString(), due: due,
      away: null, bookmarked: null, skips: 0, thinks: 0, works: 0, seen: null, visits: [], from: "set", set: setId, item: item.id };
  }
  // Adds the lines of a set that are not already here. Choosing a set is asking for it, so a line deleted earlier
  // comes back and leaves the deleted list. Returns { added, gone }.
  function addSet(store, set, now, gone) {
    var today = dayKey(now), added = 0, g = (gone || []).slice();
    (set.items || []).forEach(function (it) {
      var id = "s-" + it.id;
      if (own(store, id) || !it.text) return;
      store[id] = setThought(it, set.id, now, addDays(today, Math.floor(added / SET_PER_DAY)));
      added++;
      var k = g.indexOf(id); if (k >= 0) g.splice(k, 1);
    });
    return { added: added, gone: g };
  }
  // Thoughts from a set: all of them, and how many are still in rotation.
  function fromSet(store, setId) { return list(store).filter(function (t) { return t.set === setId; }); }
  // Removing a set takes back what the person has not made their own. A line never yet shown is deleted (and
  // remembered as deleted). A line they have met is put away, not deleted, so its history stays. One they have
  // bookmarked, written a note on or changed is left exactly where it is. Returns { deleted, putAway, gone }.
  function removeSet(store, setId, now, gone) {
    var res = { deleted: 0, putAway: 0, gone: (gone || []).slice() };
    fromSet(store, setId).forEach(function (t) {
      if (t.bookmarked || t.note || (t.works || 0) > 0 || t.away) return;
      if (!(t.visits || []).length && !t.seen) { delete store[t.id]; res.deleted++; if (res.gone.indexOf(t.id) < 0) res.gone.push(t.id); }
      else { t.away = now.toISOString(); res.putAway++; }
    });
    return res;
  }
  // First open with nothing here: the five starter lines, all due today, so there is something to meet at once.
  function addStarters(store, sets, starterIds, now) {
    var today = dayKey(now), n = 0, byId = {};
    (sets || []).forEach(function (s) { (s.items || []).forEach(function (it) { byId[it.id] = { it: it, set: s.id }; }); });
    (starterIds || []).forEach(function (sid) {
      var x = byId[sid]; if (!x || own(store, "s-" + sid)) return;
      store["s-" + sid] = setThought(x.it, x.set, now, today); n++;
    });
    return n;
  }

  // The visit log (2.0.1): every visit with its raw time, kept so the skip and thought lines can be judged from real
  // use and every past visit re-read under different lines. The newest 5000 are kept; it travels in the daily backup.
  var LOG_MAX = 5000;
  function logVisit(log, e) {
    log.push({ at: e.at, id: e.id, ms: Math.round(e.ms), worked: !!e.worked, idle: !!e.idle, kind: e.kind, how: e.how,
      len: e.len || 0, lines: [SKIP_MAX_MS / 1000, THOUGHT_MIN_MS / 1000] });
    if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
    return log;
  }

  // Catch-up: thoughts in Scales 1 that are not here yet join on the next open.
  // Matched by id; a thought already here is never overwritten, and one deleted here (in gone) never comes back.
  // Returns how many were added.
  function mergeOld(store, old, now, gone) {
    var fresh = importOld(old, now), added = 0, skip = {};
    (gone || []).forEach(function (id) { skip[id] = true; });
    Object.keys(fresh).forEach(function (id) {
      if (store[id] || skip[id]) return;
      var t = fresh[id];
      if (!t.away) t.due = dayKey(now);
      store[id] = t; added++;
    });
    return added;
  }

  // ---- Restore (2.1.0) ----
  // Adds what a backup file holds that this phone does not. It merges and never overwrites: a thought whose id is
  // already here is left exactly as it is, and nothing is removed. Reads a Scales 2 backup, a trial ("scales-next")
  // backup, or a Scales 1 backup. Anything else is refused. Returns
  //   { ok, kind, added, gone, visits }  where gone is the phone's deleted-ids list to keep and visits are log entries
  // from the file to merge with mergeLog. A thought the person deleted on this phone comes back if the file has it,
  // because choosing a backup is asking for it.
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  function num(v, d) { return typeof v === "number" && isFinite(v) && v >= 0 ? Math.floor(v) : d; }
  var own = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  function cleanThought(t, today, nowIso) {
    if (!t || typeof t !== "object" || typeof t.id !== "string" || !t.id || typeof t.text !== "string" || !t.text.trim()) return null;
    var visits = Array.isArray(t.visits) ? t.visits.filter(function (v) { return v && typeof v === "object"; }).slice(-30) : [];
    return { id: t.id, text: t.text.trim().slice(0, 1500), note: typeof t.note === "string" ? t.note.slice(0, 1500) : "",
      created: typeof t.created === "string" && t.created ? t.created : nowIso,
      due: typeof t.due === "string" && DAY_RE.test(t.due) ? t.due : today,
      // A put-away thought stays put away, whatever form the date took.
      away: typeof t.away === "string" && t.away ? t.away : t.away ? nowIso : null,
      // Kept as a time so the Bookmarked list can sort by it; a mark in any other form still means bookmarked, as of now.
      bookmarked: t.bookmarked ? (typeof t.bookmarked === "string" && isFinite(Date.parse(t.bookmarked)) ? t.bookmarked : nowIso) : null,
      skips: Math.min(4, num(t.skips, 0)), thinks: num(t.thinks, 0), works: num(t.works, 0),
      seen: typeof t.seen === "string" ? t.seen : null, visits: visits, from: typeof t.from === "string" ? t.from : undefined,
      by: cleanBy(t.by), set: typeof t.set === "string" && t.set ? t.set.slice(0, 40) : undefined,
      item: typeof t.item === "string" && t.item ? t.item.slice(0, 60) : undefined };
  }
  function restoreFrom(store, data, now, gone) {
    var res = { ok: false, kind: null, added: 0, ids: [], gone: (gone || []).slice(), visits: [] };
    if (!data || typeof data !== "object" || Array.isArray(data) || !data.thoughts || typeof data.thoughts !== "object" || Array.isArray(data.thoughts)) return res;
    var today = dayKey(now), nowIso = now.toISOString(), incoming = Object.create(null);
    var fileGone = Array.isArray(data.gone) ? data.gone.filter(function (x) { return typeof x === "string"; }) : [];
    // Scales 1 wrote version 1 (a number). Scales 2 and the trial write "2.x.y". Anything else is a file from a Scales
    // this one does not know (a later one, most likely) and is refused rather than guessed at.
    var ver = data.version;
    var v2 = data.app === "scales-next" || (data.app === "scales" && typeof ver === "string" && /^2\./.test(ver));
    var v1 = data.app === "scales" && (ver === 1 || ver === "1" || (typeof ver === "string" && /^1\./.test(ver)));
    if (!v2 && !v1) { if (data.app === "scales" || data.app === "scales-next") res.kind = "newer"; return res; }
    res.kind = v2 ? "scales2" : "scales1";
    if (v2) {
      Object.keys(data.thoughts).forEach(function (k) { var t = cleanThought(data.thoughts[k], today, nowIso); if (t) incoming[t.id] = t; });
      // Scales 1's own thoughts carried inside a Scales 2 backup join too, spread over the coming days as on first open.
      var old = data.scales1 && typeof data.scales1 === "object" ? data.scales1["scales.thoughts.v1"] : null;
      if (old && typeof old === "object" && !Array.isArray(old)) {
        var fresh = importOld(old, now);
        Object.keys(fresh).forEach(function (id) { if (!(id in incoming)) incoming[id] = fresh[id]; });
      }
    } else {
      var f1 = importOld(data.thoughts, now);
      Object.keys(f1).forEach(function (id) { incoming[id] = f1[id]; });
    }
    var goneSet = Object.create(null); res.gone.forEach(function (id) { goneSet[id] = true; });
    var skipFile = Object.create(null); fileGone.forEach(function (id) { skipFile[id] = true; });
    Object.keys(incoming).forEach(function (id) {
      // "__proto__" can't be stored as a key of a plain object without changing the object itself, so it is skipped.
      if (id === "__proto__" || own(store, id) || skipFile[id]) return;
      store[id] = incoming[id]; res.added++; res.ids.push(id);
      delete goneSet[id];
    });
    fileGone.forEach(function (id) { if (!own(store, id)) goneSet[id] = true; });
    res.gone = Object.keys(goneSet);
    res.ok = true;
    if (v2 && Array.isArray(data.visits)) res.visits = data.visits.filter(function (e) { return e && typeof e === "object" && typeof e.at === "string" && typeof e.id === "string" && typeof e.ms === "number"; });
    return res;
  }
  // Adds visit-log entries a log does not have (matched by time and thought), oldest first, newest LOG_MAX kept.
  function mergeLog(log, incoming) {
    var seen = {}; log.forEach(function (e) { seen[e.at + "|" + e.id] = true; });
    var add = incoming.filter(function (e) { return !seen[e.at + "|" + e.id]; });
    var all = log.concat(add).sort(function (a, b) { return a.at < b.at ? -1 : a.at > b.at ? 1 : 0; });
    if (all.length > LOG_MAX) all = all.slice(all.length - LOG_MAX);
    log.length = 0; all.forEach(function (e) { log.push(e); });
    return add.length;
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
    make: make, looksQuoted: looksQuoted, SET_PER_DAY: SET_PER_DAY, addSet: addSet, removeSet: removeSet, fromSet: fromSet, addStarters: addStarters, bookmarked: bookmarked, recentlyAdded: recentlyAdded, NEW_DAYS: NEW_DAYS, list: list, inRotation: inRotation, putAway: putAway, dueToday: dueToday, pickNext: pickNext, soonest: soonest,
    nextDue: nextDue, importOld: importOld, logVisit: logVisit, LOG_MAX: LOG_MAX, restoreFrom: restoreFrom, mergeLog: mergeLog, mergeOld: mergeOld, whenLabel: whenLabel };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.ScalesNext = api;
})(this);
