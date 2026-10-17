// Scales core logic.
// Pure functions with no DOM or storage access, shared by the app (loaded with a
// <script> tag before the main script) and by the tests (loaded with require()).

var ScalesCore = (function () {
  "use strict";

  // Release number shown in Settings, as MAJOR.MINOR.PATCH:
  //   MAJOR  breaking changes, such as a stored-data change that needs migration
  //   MINOR  new features and enhancements (PATCH resets to 0)
  //   PATCH  defect fixes only
  // Must match the service worker cache name ("scales-v" + VERSION) so a phone that
  // shows this number is running this code. The tests fail if the two drift apart.
  var VERSION = "1.29.0";
  var BUILT = "2026-10-17";

  // CAP        highest weight a principle can reach (4x as likely as a fresh one)
  // MAX_WORDS  longest consideration the app will show. Long enough for one complete
  //            thought, short enough to read at a glance on the card.
  // MAX_TEXT   longest principle that can be captured or edited. Covers long imported
  //            entries such as short poems; the card shrinks its type for long text.
  var CAP = 4, MAX_WORDS = 25, MAX_TEXT = 1500;
  // Limits for a principle's details, and the fixed origin choices.
  var LIMITS = { collection: 40, title: 120, author: 80 };
  var ORIGINS = ["Handed to me", "Chosen", "Not sure"];

  // Maps a not today (skip) count to a prompt and built-in line tier: 0, 1 or 3.
  function tier(s) { return s >= 3 ? 3 : (s >= 1 ? 1 : 0); }

  // How likely a principle is to be picked: 1 + 0.5 per skip, capped at CAP.
  function weight(t) { return Math.min(1 + 0.5 * t.skip_count, CAP); }

  function words(s) { return s.trim().split(/\s+/).filter(Boolean).length; }

  // Weighted random pick from the active pool. Items in the last few turns of
  // history are left out first (1 turn for a pool of 3 or fewer, 3 otherwise);
  // if that empties the pool, everything is eligible again. rand is injectable
  // so tests can make the draw deterministic.
  function pickFrom(pool, history, rand) {
    if (!pool.length) return null;
    rand = rand || Math.random;
    var cd = pool.length <= 3 ? 1 : 3;
    var recent = history.slice(-cd);
    var eligible = pool.filter(function (t) { return recent.indexOf(t.id) < 0; });
    if (!eligible.length) eligible = pool;
    var sum = eligible.reduce(function (a, t) { return a + weight(t); }, 0);
    var r = rand() * sum;
    for (var i = 0; i < eligible.length; i++) { r -= weight(eligible[i]); if (r <= 0) return eligible[i]; }
    return eligible[eligible.length - 1];
  }

  // Normalize a model answer: first non-empty line only, no leading label,
  // no quotes, dashes turned into sentence breaks, spaces collapsed.
  function clean(s) {
    var first = (s || "").split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean)[0] || "";
    return first.replace(/^(line|answer|consideration|response)\s*:\s*/i, "")
      .replace(/["“”]/g, "").replace(/\s*[—–]\s*/g, ". ").replace(/\s+/g, " ").trim();
  }

  // Bring an over-long answer within MAX_WORDS by keeping whole sentences from the start.
  // Returns "" when no complete sentence fits.
  function fit(s) {
    if (words(s) <= MAX_WORDS) return s;
    var parts = s.match(/[^.?]+[.?]+/g) || [], out = "";
    for (var i = 0; i < parts.length; i++) {
      var next = (out + " " + parts[i]).trim();
      if (words(next) > MAX_WORDS) break;
      out = next;
    }
    return out;
  }

  // Phrases that grant grace instead of holding the standard. The prompt forbids
  // them; this catches the model drifting back to a gentle tone anyway.
  var SOFT = /\b(be (gentle|kind|easy) (with|on|to) yourself|give yourself (grace|permission|a break|time)|self[- ]compassion|it'?s (ok|okay|alright|fine)\b|no shame|you deserve (rest|a break)|that'?s (ok|okay)|allow yourself|it is (ok|okay|fine))/i;

  // Check a model answer. Returns { line } when usable, or { reason } when not.
  // The echo check only applies to longer principles: a short one ("Discipline is
  // freedom") is naturally named inside a good line, so containing it is not a sign
  // of a lazy answer.
  function vet(raw, t) {
    var s = fit(clean(raw));
    if (!s) return { reason: words(clean(raw)) ? "too long" : "empty" };
    if (s.indexOf("!") >= 0) return { reason: "cheerful tone" };
    if (SOFT.test(s)) return { reason: "softened" };
    var body = t.text.trim().toLowerCase(), low = s.toLowerCase();
    if (low === body || (body.length >= 60 && low.indexOf(body.slice(0, 60)) >= 0)) return { reason: "echoed the thought" };
    return { line: s };
  }

  // Principle texts are compared ignoring case, surrounding spaces and runs of spaces.
  function normText(s) { return String(s || "").trim().replace(/\s+/g, " ").toLowerCase(); }

  // Collections in use across list, most used first, then by name. Each entry is
  // { name, count }. Matching ignores capitalization; the first spelling seen wins.
  function collections(list) {
    var by = {}, order = [];
    list.forEach(function (t) {
      var n = String(t.collection || "").trim(); if (!n) return;
      var k = n.toLowerCase();
      if (!by[k]) { by[k] = { name: n, count: 0 }; order.push(k); }
      by[k].count++;
    });
    return order.map(function (k) { return by[k]; })
      .sort(function (a, b) { return b.count - a.count || a.name.localeCompare(b.name); });
  }

  // A typed collection name, trimmed, spaces collapsed, cut to the limit, and spelled
  // like an existing collection when it matches one apart from capitalization.
  function canonCollection(list, name) {
    var s = String(name || "").trim().replace(/\s+/g, " ").slice(0, LIMITS.collection);
    if (!s) return "";
    var hit = collections(list).filter(function (x) { return x.name.toLowerCase() === s.toLowerCase(); })[0];
    return hit ? hit.name : s;
  }

  // Turn an edit (a string for wording only, or an object with any of text, collection,
  // title, author, origin) into the full set of values it would save for principle t.
  function editValues(list, t, edit) {
    if (typeof edit === "string") edit = { text: edit };
    edit = edit || {};
    var pick = function (k, d) { return Object.prototype.hasOwnProperty.call(edit, k) ? edit[k] : d; };
    var origin = String(pick("origin", t.origin || "") || "").trim();
    return {
      text: String(pick("text", t.text) || "").trim(),
      collection: canonCollection(list, pick("collection", t.collection || "")),
      title: String(pick("title", t.title || "") || "").trim().slice(0, LIMITS.title),
      author: String(pick("author", t.author || "") || "").trim().slice(0, LIMITS.author),
      origin: ORIGINS.indexOf(origin) >= 0 ? origin : ""
    };
  }

  // Check an edit to principle t against every principle in list.
  // Returns { ok: true, values } or { reason, conflict } where conflict is the other principle.
  function checkEdit(list, t, edit) {
    var v = editValues(list, t, edit);
    if (!v.text) return { reason: "empty" };
    if (v.text.length > MAX_TEXT) return { reason: "too long" };
    var same = v.text === t.text.trim() && v.collection === String(t.collection || "").trim() &&
      v.title === String(t.title || "").trim() && v.author === String(t.author || "").trim() && v.origin === (t.origin || "");
    if (same) return { reason: "unchanged" };
    var key = normText(v.text);
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== t.id && normText(list[i].text) === key) return { reason: "duplicate", conflict: list[i] };
    }
    return { ok: true, values: v };
  }

  // Apply a checked edit. Counts, dates, weight, status and evidence are kept.
  // Only a change of wording on a principle still in the deck drops its saved model
  // lines, so the next line is written for the new wording. Detail-only edits keep them,
  // and a lived principle always keeps them: its last line is part of the record.
  function applyEdit(t, edit, list) {
    var v = editValues(list || [], t, edit);
    var reworded = v.text !== t.text.trim();
    t.text = v.text; t.collection = v.collection; t.title = v.title; t.author = v.author; t.origin = v.origin;
    if (reworded && t.status === "active") t.recent_lines = [];
    t.edited_at = new Date().toISOString();
    return t;
  }

  // The two lines at the top of a card: the collection (or "Principle") and the origin.
  function label(t) {
    return { line1: String(t.collection || "").trim() || "Principle", line2: t.origin || "" };
  }

  // Check renaming the collection named from to the name to. Returns
  // { ok, merge, target, moving, total } or { reason }.
  function checkRename(list, from, to) {
    var all = collections(list);
    var src = all.filter(function (x) { return x.name.toLowerCase() === String(from).toLowerCase(); })[0];
    if (!src) return { reason: "missing" };
    var s = String(to || "").trim().replace(/\s+/g, " ");
    if (!s) return { reason: "empty" };
    if (s.length > LIMITS.collection) return { reason: "too long" };
    if (s === src.name) return { reason: "unchanged" };
    var hit = all.filter(function (x) { return x !== src && x.name.toLowerCase() === s.toLowerCase(); })[0];
    if (hit) return { ok: true, merge: true, target: hit.name, moving: src.count, total: hit.count + src.count };
    return { ok: true, merge: false, target: s, moving: src.count, total: src.count };
  }

  // Rename or merge: every principle in collection from moves to the checked target.
  // Returns the number moved. Nothing else on a principle changes.
  function renameCollection(list, from, to) {
    var r = checkRename(list, from, to); if (!r.ok) return 0;
    var k = String(from).toLowerCase(), n = 0;
    list.forEach(function (t) { if (String(t.collection || "").trim().toLowerCase() === k) { t.collection = r.target; n++; } });
    return n;
  }

  // Clear collection name from every principle in it. Returns the number cleared.
  function removeCollection(list, name) {
    var k = String(name).trim().toLowerCase(), n = 0;
    list.forEach(function (t) { if (String(t.collection || "").trim().toLowerCase() === k) { t.collection = ""; n++; } });
    return n;
  }

  // Fields every starter principle carries, as a worked example of each.
  var STARTER_FIELDS = ["text", "title", "author", "origin", "tags", "link", "citation"];

  // Merge one starter deck into list. Returns { add, updated }: add is the new principles
  // to save (without ids), updated is how many existing ones changed. Rules:
  //   - A starter line already in the deck is never added twice.
  //   - An older wording listed in an item's "replaces" is updated in place to the new
  //     wording, keeping counts, dates and status; a principle still in the deck drops its
  //     saved AI lines, as with any change of wording.
  //   - On a principle that matches a starter line, empty fields are filled from the deck;
  //     values the user set are never overwritten. The collection is filled the same way.
  function loadStarter(list, deckName, items, base) {
    var byText = {}; list.forEach(function (t) { byText[normText(t.text)] = t; });
    var add = [], updated = 0;
    items.forEach(function (it, i) {
      var t = byText[normText(it.text)];
      if (!t) (it.replaces || []).some(function (old) { t = byText[normText(old)]; return !!t; });
      if (t) {
        var changed = false;
        if (normText(t.text) !== normText(it.text)) {
          t.text = it.text; changed = true;
          if (t.status === "active") t.recent_lines = [];
        }
        var fill = { collection: deckName };
        STARTER_FIELDS.forEach(function (k) { if (k !== "text") fill[k] = it[k]; });
        Object.keys(fill).forEach(function (k) {
          if (fill[k] && !String(t[k] || "").trim()) { t[k] = fill[k]; changed = true; }
        });
        if (changed) updated++;
        return;
      }
      var n = { text: it.text, collection: deckName, created_at: new Date(base + i).toISOString(), status: "active",
        skip_count: 0, lifetime_skips: 0, reflect_count: 0, consecutive_reflects: 0, recent_lines: [] };
      STARTER_FIELDS.forEach(function (k) { if (k !== "text") n[k] = it[k] || ""; });
      add.push(n);
      byText[normText(it.text)] = n;
    });
    return { add: add, updated: updated };
  }

  // ---------- days, rest and the front of the stack ----------
  // DAY_START_HOUR  a Scales day runs from 4:00 AM to 4:00 AM local time, so a late-night
  //                 session still belongs to the day it started in.
  // REST_DAYS       how long Not today sets a principle aside. Four days, so a reflex skip
  //                 each morning cannot turn into a daily habit (1.25.0; was one day in 1.24.0).
  var DAY_START_HOUR = 4, REST_DAYS = 4;

  // The Scales day for a moment, as local YYYY-MM-DD. Shifting the clock back by the start
  // hour with calendar arithmetic keeps daylight saving changes on the right day.
  function dayOf(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() - DAY_START_HOUR, d.getMinutes(), d.getSeconds());
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
  }
  // A day key n days later.
  function addDays(key, n) {
    var p = key.split("-"), x = new Date(+p[0], +p[1] - 1, +p[2] + n, 12);
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
  }
  // Resting: set aside with Not today and not yet back. rest_until is the first day it may return.
  function isResting(t, today) { return !!t.rest_until && today < t.rest_until; }

  // Not today: count it, rest it, and give it one turn at the front once it returns.
  function applySkip(t, today) {
    t.skip_count = (t.skip_count || 0) + 1;
    t.lifetime_skips = (t.lifetime_skips || 0) + 1;
    t.consecutive_reflects = 0;
    t.rest_until = addDays(today, REST_DAYS);
    t.lead_due = true;
    return t;
  }

  // Principles waiting for their turn at the front: set aside since they last led, and no
  // longer resting. Most avoided first; ties go to the one waiting longest since last shown.
  function frontQueue(list, today, excludeId) {
    return list.filter(function (t) { return t.lead_due && !isResting(t, today) && t.id !== excludeId; })
      .sort(function (a, b) {
        return (b.skip_count || 0) - (a.skip_count || 0) || String(a.last_shown_at || "").localeCompare(String(b.last_shown_at || ""));
      });
  }

  // Choose the next card. Returns { card, lead, resting } where lead says it is taking its
  // turn at the front and resting counts principles set aside today. card is null when the
  // deck is empty, or when everything is resting and showAnyway is off.
  function nextCard(list, history, today, showAnyway, rand) {
    var current = history.length ? history[history.length - 1] : null;
    var front = frontQueue(list, today, current);
    var resting = list.filter(function (t) { return isResting(t, today); }).length;
    if (front.length) return { card: front[0], lead: true, resting: resting };
    var pool = showAnyway ? list : list.filter(function (t) { return !isResting(t, today); });
    return { card: pickFrom(pool, history, rand), lead: false, resting: resting };
  }

  // The earliest day a resting principle returns, or "" when none is resting.
  function nextReturn(list, today) {
    return list.filter(function (t) { return isResting(t, today); })
      .map(function (t) { return t.rest_until; }).sort()[0] || "";
  }

  // Record that t is on screen. A turn at the front is used up when it is shown.
  function markShown(t, now, lead) {
    t.last_shown_at = now.toISOString();
    if (lead || t.lead_due && !isResting(t, dayOf(now))) { t.lead_due = false; t.led_on = dayOf(now); }
    return t;
  }

  // Undo (1.26.0). undoPoint copies everything a move or a delete can change: every principle
  // (the move itself, plus the next card's turn at the front being used up when it is shown),
  // the activity grid, the card history and the card on screen. applyUndo hands back fresh
  // copies, so the same point can be applied again and later changes never leak into it.
  function copy(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function undoPoint(thoughts, activity, history, current) {
    return { thoughts: copy(thoughts || {}), activity: copy(activity || {}), history: copy(history || []), current: current || null };
  }
  function applyUndo(point) {
    return { thoughts: copy(point.thoughts), activity: copy(point.activity), history: copy(point.history), current: point.current };
  }

  // Collection chips on the deck (1.27.0). A chip filters the deck to one collection; "" means all.
  // Matching ignores capitalization and spacing, like collections() and canonCollection().
  function collKey(n) { return String(n || "").trim().replace(/\s+/g, " ").toLowerCase(); }
  function inCollection(t, name) { return !collKey(name) || collKey(t && t.collection) === collKey(name); }
  // Chips for the deck: the collections that still have principles in the deck, most used first.
  // Empty when no deck principle has a collection, so the row is not drawn at all.
  function deckCollections(list) {
    return collections(list.filter(function (t) { return t.status === "active"; }));
  }
  // The saved filter, spelled as the collection is now, or "" when that collection is gone from the
  // deck (renamed, removed, or every principle in it lived), so the deck falls back to all.
  function deckFilter(list, name) {
    if (!collKey(name)) return "";
    var hit = deckCollections(list).filter(function (c) { return collKey(c.name) === collKey(name); })[0];
    return hit ? hit.name : "";
  }

  // Swipe reading (1.27.0), from the drag offset in pixels (dy is negative going up). The commit
  // rules are the ones the deck has always used: past SWIPE left = skip, right = shed, up = keep
  // while staying within 60px sideways. While dragging, kind is the move the card is heading for
  // (sideways unless the drag is mostly upward), strength (0 to 1) drives the glow and stamps, and
  // tilt is the card's rotation in degrees, capped so a long drag never spins it.
  var SWIPE = 90;
  function swipeIntent(dx, dy) {
    dx = +dx || 0; dy = +dy || 0;
    var commit = dx < -SWIPE ? "skip" : dx > SWIPE ? "shed" : (dy < -SWIPE && Math.abs(dx) < 60) ? "keep" : "";
    var kind = commit, strength = 0;
    if (!kind) {
      if (Math.abs(dx) >= 60 || Math.abs(dx) > -dy) kind = dx < -8 ? "skip" : dx > 8 ? "shed" : "";
      else kind = "keep";
    }
    if (kind === "keep") strength = Math.min(1, Math.max(0, -dy / SWIPE));
    else if (kind) strength = Math.min(1, Math.abs(dx) / SWIPE);
    var tilt = Math.max(-14, Math.min(14, dx / 20));
    return { kind: kind, strength: Math.round(strength * 1000) / 1000, commit: !!commit, tilt: Math.round(tilt * 100) / 100 };
  }

  // Ledger bars (1.27.0): every principle counted once. Living it = lived; Not today = still in the
  // deck and currently set aside more than worked through (skip_count above 0); Still working = the
  // rest of the deck. Percentages are whole numbers that add up to 100 (largest remainder), or all 0
  // for an empty deck.
  function outcomeMix(list) {
    var n = { live: 0, work: 0, skip: 0 };
    list.forEach(function (t) {
      if (t.status === "shed") n.live++;
      else if (t.status === "active") { if ((t.skip_count || 0) > 0) n.skip++; else n.work++; }
    });
    var total = n.live + n.work + n.skip, keys = ["live", "work", "skip"], pct = { live: 0, work: 0, skip: 0 };
    if (total) {
      var raw = keys.map(function (k) { return { k: k, v: n[k] * 100 / total }; });
      raw.forEach(function (r) { pct[r.k] = Math.floor(r.v); });
      var left = 100 - keys.reduce(function (a, k) { return a + pct[k]; }, 0);
      raw.sort(function (a, b) { return (b.v - Math.floor(b.v)) - (a.v - Math.floor(a.v)) || keys.indexOf(a.k) - keys.indexOf(b.k); });
      for (var i = 0; i < left; i++) pct[raw[i].k]++;
    }
    return { live: n.live, work: n.work, skip: n.skip, total: total, pct: pct };
  }

  return { VERSION: VERSION, BUILT: BUILT, CAP: CAP, MAX_WORDS: MAX_WORDS, MAX_TEXT: MAX_TEXT,
    tier: tier, weight: weight, words: words, pickFrom: pickFrom, clean: clean, fit: fit, vet: vet,
    LIMITS: LIMITS, ORIGINS: ORIGINS, normText: normText, collections: collections, canonCollection: canonCollection,
    editValues: editValues, checkEdit: checkEdit, applyEdit: applyEdit, label: label,
    checkRename: checkRename, renameCollection: renameCollection, removeCollection: removeCollection,
    STARTER_FIELDS: STARTER_FIELDS, loadStarter: loadStarter,
    DAY_START_HOUR: DAY_START_HOUR, REST_DAYS: REST_DAYS, dayOf: dayOf, addDays: addDays, isResting: isResting,
    applySkip: applySkip, nextReturn: nextReturn, frontQueue: frontQueue, nextCard: nextCard, markShown: markShown,
    undoPoint: undoPoint, applyUndo: applyUndo,
    inCollection: inCollection, deckCollections: deckCollections, deckFilter: deckFilter, outcomeMix: outcomeMix,
    SWIPE: SWIPE, swipeIntent: swipeIntent };
})();

if (typeof module !== "undefined" && module.exports) module.exports = ScalesCore;
