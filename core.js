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
  var VERSION = "1.21.0";
  var BUILT = "2026-10-12";

  // CAP        highest weight a principle can reach (4x as likely as a fresh one)
  // MAX_WORDS  longest consideration the app will show. Long enough for one complete
  //            thought, short enough to read at a glance on the card.
  // MAX_TEXT   longest principle that can be captured or edited. Covers long imported
  //            entries such as short poems; the card shrinks its type for long text.
  var CAP = 4, MAX_WORDS = 25, MAX_TEXT = 1500;

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

  // Check a proposed new wording for principle t against every principle in list.
  // Returns { ok: true } or { reason, conflict } where conflict is the other principle.
  function checkEdit(list, t, text) {
    var s = String(text || "").trim();
    if (!s) return { reason: "empty" };
    if (s === t.text.trim()) return { reason: "unchanged" };
    if (s.length > MAX_TEXT) return { reason: "too long" };
    var key = normText(s);
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== t.id && normText(list[i].text) === key) return { reason: "duplicate", conflict: list[i] };
    }
    return { ok: true };
  }

  // Apply a checked new wording. Counts, dates, weight, status and evidence are kept.
  // A principle still in the deck drops its saved model lines so the next line is written
  // for the new wording. A lived principle keeps them: its last line is part of the record.
  function applyEdit(t, text) {
    t.text = String(text).trim();
    if (t.status === "active") t.recent_lines = [];
    t.edited_at = new Date().toISOString();
    return t;
  }

  return { VERSION: VERSION, BUILT: BUILT, CAP: CAP, MAX_WORDS: MAX_WORDS, MAX_TEXT: MAX_TEXT,
    tier: tier, weight: weight, words: words, pickFrom: pickFrom, clean: clean, fit: fit, vet: vet,
    normText: normText, checkEdit: checkEdit, applyEdit: applyEdit };
})();

if (typeof module !== "undefined" && module.exports) module.exports = ScalesCore;
