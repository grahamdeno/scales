// Scales: the logic, kept apart from the page so it can be tested in Node.
// One rule runs everything: the person only ever moves on (swipe up) or puts a thought away (pull down).
// What a visit meant is read from how long it lasted and whether they wrote anything.
(function (root) {
  "use strict";
  var VERSION = "2.13.0";

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

  // When it comes back. A skip brings it back in 5 days (2.12.0; was 1, which let yesterday's skips fill every day);
  // thinking about it or working on it pushes it further out each time, so a thought you have clearly absorbed fades
  // in how often it shows. It never leaves on its own. Being due only makes a thought eligible: the day's pile decides
  // the order (see nextCard).
  var SKIP_GAP = 5;
  function nextGap(t, kind) {
    if (kind === "skipped") return SKIP_GAP;
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

  // ---- Today's pile (2.12.0; first built 2.9.0) ----
  // Up to DAY_SIZE cards a day, chosen so the whole collection comes round instead of the same cards every day:
  // - "avoid": up to AVOID_PER_DAY of the most-skipped thoughts that are due, kept on purpose so avoidance still pulls
  //   a thought back, but can never crowd out the rest;
  // - "new": never-met thoughts (imports, sets, Scales 1, new ones you wrote), still arriving a few a day;
  // - "due": everything else that is due, the one you have gone longest without seeing first.
  // Avoided and new cards are spread evenly through the day, never two of a kind in a row. Ties are broken by a shuffle
  // seeded with the day, so the order holds all day and changes from one day to the next.
  // If what is due runs out first, the day tops up with the longest unseen of the rest ("extra"). At DAY_SIZE the day
  // stops; Keep going carries on the same way ("more") until everything has been seen once today.
  // Every card here is a real visit and moves its schedule (2.12.0; top-up and Keep going used to be reviews that moved
  // nothing, so the same cards waited at the front the next day). Only a thought opened from the library is a review.
  // Every visit is logged with its pile and its place in the session, so the size can be judged from use (12 November).
  var DAY_SIZE = 30, AVOID_PER_DAY = 5, SESSION_GAP_MS = 5 * 60000;
  function isNew(t) { return !t.seen && !(t.visits && t.visits.length) && !t.skips; }
  function todayLog(log, now) {
    var today = dayKey(now);
    return (log || []).filter(function (e) { return !e.undone && e.at && dayKey(new Date(e.at)) === today; });
  }
  // A number from the thought's id and the day (FNV-1a): the same all day, different the next.
  function shuffleKey(id, day) {
    var h = 2166136261, s = day + "|" + String(id);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    // Final mix (MurmurHash3 fmix32) so a one-letter change in the day reorders everything, not just the low bits.
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return h >>> 0;
  }
  // The day it was last seen, or "" (longest ago) if never or unreadable. By day, not by the minute, so thoughts met
  // in one sitting don't come back in the order they were met.
  function seenDay(t) { var ms = t.seen ? Date.parse(t.seen) : NaN; return isFinite(ms) ? dayKey(new Date(ms)) : ""; }
  function byUnseen(day) {
    return function (a, b) {
      var x = seenDay(a), y = seenDay(b);
      return x < y ? -1 : x > y ? 1 : shuffleKey(a.id, day) - shuffleKey(b.id, day);
    };
  }
  function byAvoided(day) {
    var u = byUnseen(day);
    return function (a, b) { return (b.skips || 0) - (a.skips || 0) || u(a, b); };
  }
  // Arriving order for never-met thoughts: by the day they were due, then as they were added (a set keeps its order).
  function byArrival(a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : a.created < b.created ? -1 : a.created > b.created ? 1 : 0; }
  function nextCard(store, log, now, notId, more) {
    var tl = todayLog(log, now), seen = {}, today = dayKey(now);
    tl.forEach(function (e) { seen[e.id] = true; });
    if (notId) seen[notId] = true;
    if (tl.length >= DAY_SIZE && !more) return { card: null, why: "limit", shown: tl.length };
    var due = inRotation(store).filter(function (t) { return t.due <= today && !seen[t.id]; });
    var fresh = due.filter(isNew).sort(byArrival);
    var old = due.filter(function (t) { return !isNew(t); });
    if (fresh.length || old.length) {
      var real = tl.filter(function (e) { return e.pile === "due" || e.pile === "new" || e.pile === "avoid"; });
      var newShown = real.filter(function (e) { return e.pile === "new"; }).length;
      var avShown = real.filter(function (e) { return e.pile === "avoid"; }).length;
      var avoid = old.filter(function (t) { return (t.skips || 0) > 0; }).sort(byAvoided(today)).slice(0, Math.max(0, AVOID_PER_DAY - avShown));
      var inAvoid = {}; avoid.forEach(function (t) { inAvoid[t.id] = true; });
      var rest = old.filter(function (t) { return !inAvoid[t.id]; }).sort(byUnseen(today));
      var last = tl[tl.length - 1], lastPile = last && last.pile;
      // Spread evenly over what is left of today: with N of a kind in a day of T real cards, the k-th sits at about k*(T+1)/(N+1).
      var left = fresh.length + avoid.length + rest.length;
      var room = more ? left : Math.min(left, DAY_SIZE - tl.length);
      var T = real.length + room, at = real.length + 1;
      function owed(shown, waiting) { var N = shown + Math.min(waiting, room); return Math.floor(at * (N + 1) / (T + 1)) - shown; }
      var oweNew = fresh.length && lastPile !== "new" ? owed(newShown, fresh.length) : 0;
      var oweAv = avoid.length && lastPile !== "avoid" ? owed(avShown, avoid.length) : 0;
      var pile;
      if (oweNew > 0 || oweAv > 0) pile = oweAv > oweNew ? "avoid" : "new";
      else if (rest.length) pile = "due";
      else if (fresh.length && (lastPile !== "new" || !avoid.length)) pile = "new";
      else pile = avoid.length ? "avoid" : "new";
      var card = pile === "new" ? fresh[0] : pile === "avoid" ? avoid[0] : rest[0];
      return { card: card, pile: pile, review: false, shown: tl.length };
    }
    var pool = inRotation(store).filter(function (t) { return !seen[t.id]; }).sort(byUnseen(today));
    if (!pool.length) return { card: null, why: "done", shown: tl.length };
    return { card: pool[0], pile: more ? "more" : "extra", review: false, shown: tl.length };
  }
  // Which card of the session this is: a gap of more than 5 minutes since the last visit ended starts a new session.
  function sessionPos(log, nowMs, ms) {
    var last = (log || [])[(log || []).length - 1];
    if (!last || !last.at) return 1;
    var gap = (nowMs - (ms || 0)) - Date.parse(last.at);
    return gap <= SESSION_GAP_MS ? (last.n || 1) + 1 : 1;
  }
  // Never-met thoughts that are not due yet: the line still waiting to arrive.
  function waiting(store, now) {
    var today = dayKey(now);
    return inRotation(store).filter(function (t) { return isNew(t) && t.due > today; }).length;
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
  // A set line is still on trial until the person keeps it: met twice or more, or noted, changed or bookmarked.
  // While on trial, putting it away offers Delete too, so a line that isn't for them never sits in the archive.
  function onTrial(t) {
    return !!(t && t.set && !t.bookmarked && !t.note && !(t.works > 0) && (t.visits || []).length < 2);
  }
  // Deletes the put-away lines of a set, except any the person bookmarked, noted or changed. Returns { deleted, gone }.
  function clearPutAway(store, setId, gone) {
    var res = { deleted: 0, gone: (gone || []).slice() };
    fromSet(store, setId).forEach(function (t) {
      if (!t.away || t.bookmarked || t.note || (t.works || 0) > 0) return;
      delete store[t.id]; res.deleted++; if (res.gone.indexOf(t.id) < 0) res.gone.push(t.id);
    });
    return res;
  }
  function clearable(store, setId) {
    return fromSet(store, setId).filter(function (t) { return t.away && !t.bookmarked && !t.note && !((t.works || 0) > 0); }).length;
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

  // ---- Import (2.7.0) ----
  // Pasted text or a file from another app becomes thoughts. Plain text splits at each line, or at each blank line
  // when the text has them. A name after a dash, or under a quote, becomes who said it. A CSV with a quote column
  // (Readwise, Goodreads and the like) and a Kindle "My Clippings.txt" are read by their columns and markers.
  var IMPORT_PER_DAY = 5, IMPORT_MAX = 3000;
  var QUOTES = /^["\u201C\u201E\u00AB'\u2018]+|["\u201D\u00BB'\u2019]+$/g;
  function looksLikeName(s) {
    s = s.trim();
    if (!s || s.length > 60 || /[.!?]$/.test(s) && !/\.$/.test(s.replace(/\b[A-Z]\.$/, ""))) return false;
    var w = s.replace(/,.*$/, "").split(/\s+/);
    return w.length <= 5 && /^[A-Z\u00C0-\u024F]/.test(w[0]) && !/[.!?]$/.test(s);
  }
  // One piece of text: split off a trailing attribution, if there is one, and the quotation marks around the quote.
  function splitBy(raw) {
    var s = String(raw).replace(/\r/g, "").trim(), by = "";
    var m = s.match(/^([\s\S]*?\S)\s*(?:\n\s*)?[\u2014\u2013~]\s*([^\n\u2014\u2013]+)$/) || s.match(/^([\s\S]*?["\u201D\u2019])\s+-\s+([^\n]+)$/) || s.match(/^([\s\S]*?[.!?"\u201D])\s+-\s+([^\n-]+)$/);
    if (m && looksLikeName(m[2])) { s = m[1].trim(); by = m[2].trim(); }
    else {
      var lines = s.split("\n"), last = lines[lines.length - 1].trim();
      var q = lines.slice(0, -1).join("\n").trim();
      if (lines.length > 1 && looksLikeName(last.replace(/^[-\u2014\u2013~]\s*/, "")) && /["\u201D\u2019]$/.test(q)) { s = q; by = last.replace(/^[-\u2014\u2013~]\s*/, ""); }
    }
    if (by) s = s.replace(QUOTES, "").trim();
    return { text: s.slice(0, 1500), by: by.slice(0, 200) };
  }
  function parseCSV(text) {
    var rows = [], row = [], f = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
      else if (ch === '"') q = true;
      else if (ch === ",") { row.push(f); f = ""; }
      else if (ch === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
      else if (ch !== "\r") f += ch;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows;
  }
  function fromCSV(text) {
    var rows = parseCSV(text); if (rows.length < 2) return null;
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    var ti = head.findIndex(function (h) { return /^(highlight|quote|quotes|text|content|note)$/.test(h); });
    if (ti < 0) return null;
    var ai = head.findIndex(function (h) { return /^(book author|author|by|source author)$/.test(h); });
    var bi = head.findIndex(function (h) { return /^(book title|title|book|source)$/.test(h); });
    return rows.slice(1).map(function (r) {
      var by = ai >= 0 ? (r[ai] || "").trim() : "", bk = bi >= 0 ? (r[bi] || "").trim() : "";
      return { text: (r[ti] || "").trim().slice(0, 1500), by: (by && bk ? by + ", " + bk : by || bk).slice(0, 200) };
    });
  }
  function fromClippings(text) {
    if (!/==========/.test(text)) return null;
    return text.split(/\r?\n?==========\r?\n?/).map(function (blk) {
      var l = blk.replace(/\r/g, "").split("\n").filter(function (x) { return x.trim(); });
      if (l.length < 3 || !/^- /.test(l[1])) return null;
      var t = l[0].replace(/^\uFEFF/, "").trim(), m = t.match(/^(.*)\(([^()]*)\)\s*$/);
      return { text: l.slice(2).join("\n").trim().slice(0, 1500), by: (m ? m[2].trim() + ", " + m[1].trim() : t).slice(0, 200) };
    }).filter(Boolean);
  }
  // mode: "auto" (blank lines if there are any, else each line), "lines" or "paragraphs".
  function parseImport(text, mode) {
    text = String(text || "").replace(/^\uFEFF/, "");
    var out = fromClippings(text) || (/^[^\n]*,/.test(text) && fromCSV(text));
    if (!out) {
      var paras = mode === "paragraphs" || (mode !== "lines" && /\n\s*\n/.test(text));
      out = [];
      var prevRaw = "";
      text.replace(/\r/g, "").split(paras ? /\n\s*\n/ : /\n/).forEach(function (raw) {
        // A line that is only "- Name" under a quote says who said the line above it. With or without quotation marks,
        // as long as the line above was not itself a bullet (in a bulleted list, "- Be kind" is a thought, not a name).
        var nm = raw.match(/^\s*[-\u2014\u2013~]\s*(.+)$/), prev = out[out.length - 1];
        var aboveIsBullet = /^\s*(?:[-*\u2022\u2014\u2013~]|\d+[.)])\s+/.test(prevRaw);
        if (raw.trim()) prevRaw = raw;
        if (nm && prev && !prev.by && looksLikeName(nm[1]) && (/["\u201D\u2019]$/.test(prev.text) || !aboveIsBullet)) { prev.by = nm[1].trim().slice(0, 200); prev.text = prev.text.replace(QUOTES, "").trim(); return; }
        out.push(splitBy(raw.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s+/, "")));
      });
    }
    var seen = {};
    return out.filter(function (x) {
      if (!x || !x.text || !x.text.trim()) return false;
      var k = x.text.toLowerCase().replace(/\s+/g, " ").trim(); if (seen[k]) return false; seen[k] = true; return true;
    }).slice(0, IMPORT_MAX);
  }
  // Adds them as thoughts, five a day from today, leaving out any already here word for word. Returns { added, skipped }.
  function importThoughts(store, items, now) {
    var today = dayKey(now), have = {}, added = 0, skipped = 0;
    list(store).forEach(function (t) { have[t.text.toLowerCase().replace(/\s+/g, " ").trim()] = true; });
    items.forEach(function (x, i) {
      var k = x.text.toLowerCase().replace(/\s+/g, " ").trim();
      if (have[k]) { skipped++; return; }
      have[k] = true;
      var t = make(x.text, now, x.by); t.id = uid() + i; t.from = "import"; t.due = addDays(today, Math.floor(added / IMPORT_PER_DAY));
      store[t.id] = t; added++;
    });
    return { added: added, skipped: skipped };
  }

  // ---- Apple Intelligence test (2.6.0) ----
  // The on-device model only writes words: theme names, one theme per thought, and a few sentences from facts
  // this code has already counted. Every number comes from here, never from the model.
  var AI_SAMPLE = 50, AI_CHARS = 140;
  // A spread of thoughts to name themes from: newest and oldest alike, each cut short, so the prompt stays small.
  function themeSample(store) {
    var all = list(store).filter(function (t) { return t.text && t.text.trim(); }).sort(function (a, b) { return a.created < b.created ? -1 : 1; });
    var step = Math.max(1, all.length / AI_SAMPLE), out = [];
    for (var i = 0; i < all.length && out.length < AI_SAMPLE; i += step) out.push(all[Math.floor(i)]);
    return out.map(function (t, i) { var s = t.text.replace(/\s+/g, " ").trim(); return (i + 1) + ". " + (s.length > AI_CHARS ? s.slice(0, AI_CHARS) + "..." : s); }).join("\n");
  }
  // The model's list of themes, cleaned: one per line, no numbers or bullets, short, no repeats; 4 to 8 of them.
  function parseThemes(text) {
    var seen = {}, out = [];
    String(text || "").split(/\n|,/).forEach(function (l) {
      var s = l.replace(/^[\s*\-\u2022\d.):]+/, "").replace(/["*_]/g, "").replace(/[.:]+$/, "").trim();
      if (!s || s.length > 28 || s.split(/\s+/).length > 3) return;
      s = s.charAt(0).toUpperCase() + s.slice(1);
      var k = s.toLowerCase(); if (seen[k]) return; seen[k] = true; out.push(s);
    });
    return out.slice(0, 8);
  }
  // Which theme the model picked for one thought: an exact name if it gave one, else a name it mentioned, else none.
  function matchTheme(answer, themes) {
    var a = String(answer || "").toLowerCase().replace(/["*_.]/g, "").trim();
    for (var i = 0; i < themes.length; i++) if (a === themes[i].toLowerCase()) return themes[i];
    var best = null;
    themes.forEach(function (t) { if (a.indexOf(t.toLowerCase()) !== -1 && (!best || t.length > best.length)) best = t; });
    return best;
  }
  // The week (or a longer window), counted per theme from the visit log. Reviews and undone visits are left out.
  function themeWeek(store, log, tags, now, days) {
    var since = new Date(now.getTime() - days * 86400000).toISOString(), by = {};
    function row(th) { return by[th] || (by[th] = { theme: th, visits: 0, skipped: 0, thought: 0, ms: 0, thoughts: {}, putAway: 0 }); }
    (log || []).forEach(function (e) {
      if (!e || e.at < since || e.kind === "review" || e.undone || !own(store, e.id)) return;
      var r = row(tags[e.id] || "Unsorted");
      r.visits++; r.ms += e.ms || 0; r.thoughts[e.id] = true;
      if (e.kind === "skipped") r.skipped++;
      if (e.kind === "thought" || e.kind === "worked") r.thought++;
    });
    list(store).forEach(function (t) { if (t.away && t.away >= since) row(tags[t.id] || "Unsorted").putAway++; });
    return Object.keys(by).map(function (k) {
      var r = by[k]; r.thoughts = Object.keys(r.thoughts).length; r.avgSec = r.visits ? Math.round(r.ms / r.visits / 1000) : 0; delete r.ms; return r;
    }).sort(function (a, b) { return b.visits - a.visits; });
  }
  // Plain facts from those counts, already true, for the model to put into a few sentences.
  function weekFacts(rows, days) {
    var f = [], seen = rows.filter(function (r) { return r.visits && r.theme !== "Unsorted"; });
    if (!seen.length) return f;
    var total = rows.reduce(function (n, r) { return n + r.visits; }, 0);
    f.push("In the last " + days + " days you met thoughts " + total + " times.");
    var most = seen.slice().sort(function (a, b) { return b.visits - a.visits; })[0];
    f.push("You met " + most.theme + " thoughts most often: " + most.visits + " times.");
    var stay = seen.filter(function (r) { return r.visits >= 2; }).sort(function (a, b) { return b.avgSec - a.avgSec; })[0];
    if (stay) f.push("You stayed longest with " + stay.theme + " thoughts: about " + stay.avgSec + " seconds each time.");
    var skip = seen.filter(function (r) { return r.skipped >= 2; }).sort(function (a, b) { return b.skipped / b.visits - a.skipped / a.visits; })[0];
    if (skip && (!stay || skip.theme !== stay.theme)) f.push("You moved past " + skip.theme + " thoughts quickest: " + skip.skipped + " of " + skip.visits + " times in under 20 seconds.");
    var away = seen.filter(function (r) { return r.putAway; }).sort(function (a, b) { return b.putAway - a.putAway; })[0];
    if (away) f.push("You put away " + away.putAway + " " + away.theme + (away.putAway === 1 ? " thought." : " thoughts."));
    return f;
  }

  // The visit log (2.0.1): every visit with its raw time, kept so the skip and thought lines can be judged from real
  // use and every past visit re-read under different lines. The newest 5000 are kept; it travels in the daily backup.
  var LOG_MAX = 5000;
  function logVisit(log, e) {
    log.push({ at: e.at, id: e.id, ms: Math.round(e.ms), worked: !!e.worked, idle: !!e.idle, kind: e.kind, how: e.how,
      len: e.len || 0, lines: [SKIP_MAX_MS / 1000, THOUGHT_MIN_MS / 1000] });
    // 2.9.0: which pile it came from, its place in the session, the day size in force, and how the time reads even
    // for a review (so reviews can be compared with real visits without ever moving a schedule).
    var x = log[log.length - 1];
    if (e.pile) x.pile = e.pile;
    if (e.n) x.n = e.n;
    if (e.size) x.size = e.size;
    if (e.cls) x.cls = e.cls;
    if (e.s) x.s = e.s;
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
    var res = { ok: false, kind: null, added: 0, ids: [], gone: (gone || []).slice(), visits: [], events: [] };
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
    if (v2 && Array.isArray(data.events)) res.events = data.events.filter(function (e) { return e && typeof e === "object" && typeof e.t === "string" && typeof e.e === "string"; });
    if (v2 && Array.isArray(data.visits)) res.visits = data.visits.filter(function (e) { return e && typeof e === "object" && typeof e.at === "string" && typeof e.id === "string" && typeof e.ms === "number"; });
    return res;
  }
  // ---- Telemetry (2.10.0) ----
  // An event log kept only on this phone, alongside the visit log, and carried in backups so it can be studied.
  // Nothing leaves the phone on its own. No thought text goes in: only ids, lengths, counts, screens and taps.
  var EVENTS_MAX = 8000;
  function track(events, e) {
    events.push(e);
    if (events.length > EVENTS_MAX) events.splice(0, events.length - EVENTS_MAX);
    return events;
  }
  function mergeEvents(events, incoming) {
    var key = function (e) { return e.t + "|" + e.e + "|" + (e.id || "") + "|" + (e.s || ""); };
    var seen = {}; events.forEach(function (e) { seen[key(e)] = true; });
    var add = (incoming || []).filter(function (e) { return e && typeof e === "object" && typeof e.t === "string" && typeof e.e === "string" && !seen[key(e)]; });
    var all = events.concat(add).sort(function (a, b) { return a.t < b.t ? -1 : a.t > b.t ? 1 : 0; });
    if (all.length > EVENTS_MAX) all = all.slice(all.length - EVENTS_MAX);
    events.length = 0; all.forEach(function (e) { events.push(e); });
    return add.length;
  }
  // The shape of the collection once a day: how big, where thoughts came from, what state they are in.
  function snapshot(store, now) {
    var today = dayKey(now), all = list(store), src = {}, len = 0;
    all.forEach(function (t) { var k = t.from || (t.set ? "set" : "own"); src[k] = (src[k] || 0) + 1; len += t.text.length; });
    return {
      total: all.length, rotation: inRotation(store).length, away: putAway(store).length, bookmarked: bookmarked(store).length,
      due: dueToday(store, now).length, waiting: waiting(store, now), src: src,
      withBy: all.filter(function (t) { return t.by; }).length, withNote: all.filter(function (t) { return t.note; }).length,
      avgLen: all.length ? Math.round(len / all.length) : 0,
      added7: all.filter(function (t) { return t.created && dayKey(new Date(t.created)) > addDays(today, -7); }).length
    };
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

  // ---- The library and the thought's history (2.13.0) ----
  // Whole days since it was added, by Scales days (a day starts at 4 AM). Unknown or future: 0.
  function ageDays(created, now) {
    var ms = Date.parse(created); if (!isFinite(ms)) return 0;
    var a = dayKey(new Date(ms)).split("-"), b = dayKey(now).split("-");
    var d = Math.round((Date.UTC(+b[0], +b[1] - 1, +b[2]) - Date.UTC(+a[0], +a[1] - 1, +a[2])) / 86400000);
    return Math.max(0, d);
  }
  // Short age for a list row: Today, 3d, 5w, 4mo, 2y.
  function ageLabel(created, now) {
    var d = ageDays(created, now);
    if (d < 1) return "Today";
    if (d < 14) return d + "d";
    if (d < 60) return Math.floor(d / 7) + "w";
    if (d < 365) return Math.floor(d / 30) + "mo";
    return Math.floor(d / 365) + "y";
  }
  // Which group a thought sits in, by when it was added: the order people remember their own notes in.
  var ADDED_GROUPS = ["This week", "This month", "Earlier"];
  function addedGroup(created, now) { var d = ageDays(created, now); return d < 7 ? ADDED_GROUPS[0] : d < 30 ? ADDED_GROUPS[1] : ADDED_GROUPS[2]; }
  // Newest first, split into the groups above; empty groups left out. Returns [{ name, items }].
  function groupByAdded(thoughts, now) {
    var by = {};
    thoughts.slice().sort(function (a, b) { return a.created < b.created ? 1 : a.created > b.created ? -1 : 0; })
      .forEach(function (t) { var g = addedGroup(t.created, now); (by[g] = by[g] || []).push(t); });
    return ADDED_GROUPS.filter(function (g) { return by[g]; }).map(function (g) { return { name: g, items: by[g] }; });
  }
  // One quiet line for Edit: how old it is and how it has gone lately.
  // "Added 41 days ago · skipped 6 of the last 8 times". Lately is the last 10 real visits.
  function historyLine(t, now) {
    var d = ageDays(t.created, now);
    var added = d < 1 ? "Added today" : d === 1 ? "Added yesterday" : "Added " + d + " days ago";
    var real = (t.visits || []).filter(function (v) { return v && (v.kind === "skipped" || v.kind === "seen" || v.kind === "thought" || v.kind === "worked"); }).slice(-10);
    if (!real.length) return added + " \u00b7 not met yet";
    var sk = real.filter(function (v) { return v.kind === "skipped"; }).length;
    var times = real.length === 1 ? "time" : "times";
    if (!sk) return added + " \u00b7 " + (real.length === 1 ? "met once" : "met " + real.length + " times") + ", never skipped";
    return added + " \u00b7 skipped " + (real.length === 1 ? "the last time" : sk + " of the last " + real.length + " " + times);
  }

  var api = { VERSION: VERSION, ageDays: ageDays, ageLabel: ageLabel, addedGroup: addedGroup, groupByAdded: groupByAdded, historyLine: historyLine, SKIP_MAX_MS: SKIP_MAX_MS, THOUGHT_MIN_MS: THOUGHT_MIN_MS, IDLE_MS: IDLE_MS, SKIP_GAP: SKIP_GAP, AVOID_PER_DAY: AVOID_PER_DAY, shuffleKey: shuffleKey,
    dayKey: dayKey, addDays: addDays, classify: classify, nextGap: nextGap, recordVisit: recordVisit, weight: weight,
    make: make, looksQuoted: looksQuoted, SET_PER_DAY: SET_PER_DAY, addSet: addSet, removeSet: removeSet, fromSet: fromSet, addStarters: addStarters, splitBy: splitBy, parseImport: parseImport, importThoughts: importThoughts, IMPORT_PER_DAY: IMPORT_PER_DAY, themeSample: themeSample, parseThemes: parseThemes, matchTheme: matchTheme, themeWeek: themeWeek, weekFacts: weekFacts, onTrial: onTrial, clearPutAway: clearPutAway, clearable: clearable, bookmarked: bookmarked, recentlyAdded: recentlyAdded, NEW_DAYS: NEW_DAYS, list: list, inRotation: inRotation, putAway: putAway, dueToday: dueToday, pickNext: pickNext, DAY_SIZE: DAY_SIZE, isNew: isNew, todayLog: todayLog, nextCard: nextCard, sessionPos: sessionPos, waiting: waiting, EVENTS_MAX: EVENTS_MAX, track: track, mergeEvents: mergeEvents, snapshot: snapshot, soonest: soonest,
    nextDue: nextDue, importOld: importOld, logVisit: logVisit, LOG_MAX: LOG_MAX, restoreFrom: restoreFrom, mergeLog: mergeLog, mergeOld: mergeOld, whenLabel: whenLabel };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.ScalesNext = api;
})(this);
