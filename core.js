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
  var VERSION = "1.22.0";
  var BUILT = "2026-10-12";

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

  return { VERSION: VERSION, BUILT: BUILT, CAP: CAP, MAX_WORDS: MAX_WORDS, MAX_TEXT: MAX_TEXT,
    tier: tier, weight: weight, words: words, pickFrom: pickFrom, clean: clean, fit: fit, vet: vet,
    LIMITS: LIMITS, ORIGINS: ORIGINS, normText: normText, collections: collections, canonCollection: canonCollection,
    editValues: editValues, checkEdit: checkEdit, applyEdit: applyEdit, label: label,
    checkRename: checkRename, renameCollection: renameCollection, removeCollection: removeCollection };
})();

if (typeof module !== "undefined" && module.exports) module.exports = ScalesCore;
