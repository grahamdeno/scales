// The 12 November evaluation (and any later one): reads a Scales backup and prints the numbers the plan asks for.
// Usage: node scripts/evaluate.js "Scales backup.json" [--since 2026-10-30]
// Plan and decisions: docs/evaluation-plan.md. Nothing here changes the backup.
"use strict";
const fs = require("fs");
const file = process.argv[2];
if (!file) { console.error('Give the backup file: node scripts/evaluate.js "Scales backup.json"'); process.exit(2); }
const sinceArg = (process.argv.indexOf("--since") > 0) ? process.argv[process.argv.indexOf("--since") + 1] : null;
const bk = JSON.parse(fs.readFileSync(file, "utf8"));
const thoughts = Object.values(bk.thoughts || {});
const visits = (bk.visits || []).filter((v) => !v.undone && (!sinceArg || v.at >= sinceArg));
const events = (bk.events || []).filter((e) => !sinceArg || e.t >= sinceArg);

// Local time from the phone's own offset (boot events carry it), else this machine's.
const tz = (events.find((e) => e.e === "boot" && typeof e.tz === "number") || {}).tz;
const local = (iso) => { const d = new Date(iso); return tz == null ? d : new Date(d.getTime() - tz * 60000); };
const dayOf = (iso) => local(iso).toISOString().slice(0, 10);
const hourOf = (iso) => local(iso).getUTCHours();
const sec = (ms) => Math.round(ms / 100) / 10;
const pct = (a, p) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const median = (a) => pct(a, 0.5);
const count = (a, f) => a.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m; }, {});
const h = (t) => console.log("\n## " + t);
const row = (...c) => console.log("  " + c.map((x, i) => String(x).padEnd(i ? 13 : 30)).join(" "));

console.log("# Scales evaluation: " + (bk.exported_at || "").slice(0, 10) + ", version " + bk.version);
const vd = visits.map((v) => v.at).sort(), ed = events.map((e) => e.t).sort();
console.log("Visits " + visits.length + (vd.length ? " (" + vd[0].slice(0, 10) + " to " + vd[vd.length - 1].slice(0, 10) + ")" : "") +
  ", events " + events.length + (ed.length ? " (" + ed[0].slice(0, 10) + " to " + ed[ed.length - 1].slice(0, 10) + ")" : "") + ", thoughts " + thoughts.length);

// 1. Timing lines: real visits only (reviews never moved a schedule, so they never set the rule, but are shown beside).
h("1. Time on a card (20 s skip line, 30 s thought line)");
const real = visits.filter((v) => v.kind !== "review" && !v.idle && !v.worked);
const rev = visits.filter((v) => v.kind === "review" && !v.idle && !v.worked);
const ms = real.map((v) => v.ms);
row("", "count", "p10", "p25", "median", "p75", "p90");
row("real visits", ms.length, ...[0.1, 0.25, 0.5, 0.75, 0.9].map((p) => sec(pct(ms, p)) + "s"));
row("reviews (top-up, Keep going)", rev.length, ...[0.1, 0.25, 0.5, 0.75, 0.9].map((p) => sec(pct(rev.map((v) => v.ms), p)) + "s"));
const buckets = [5, 10, 15, 20, 25, 30, 45, 60, 120, Infinity];
console.log("  Spread of real visits:");
let lo = 0; buckets.forEach((b) => { const n = ms.filter((x) => x >= lo * 1000 && x < b * 1000).length; console.log("    " + (lo + "-" + (b === Infinity ? "" : b) + "s").padEnd(10) + String(n).padStart(5) + "  " + "#".repeat(Math.round(60 * n / Math.max(1, ms.length)))); lo = b; });
console.log("  What other lines would call skipped / seen / thought:");
[[10, 20], [15, 25], [20, 30], [20, 40], [30, 45]].forEach(([a, b]) => {
  const sk = ms.filter((x) => x <= a * 1000).length, th = ms.filter((x) => x >= b * 1000).length;
  row("  " + a + "s / " + b + "s" + (a === 20 && b === 30 ? " (now)" : ""), "skip " + Math.round(100 * sk / Math.max(1, ms.length)) + "%", "seen " + Math.round(100 * (ms.length - sk - th) / Math.max(1, ms.length)) + "%", "thought " + Math.round(100 * th / Math.max(1, ms.length)) + "%");
});
console.log("  Time by length of thought (median):");
[[0, 60], [60, 140], [140, 300], [300, 1e9]].forEach(([a, b]) => { const g = real.filter((v) => v.len >= a && v.len < b).map((v) => v.ms); row("    " + a + "-" + (b > 1e8 ? "" : b) + " letters", g.length, sec(median(g)) + "s"); });

// 2. Day size and attention by position in the session.
h("2. Day size (30) and attention through a session");
const sized = visits.filter((v) => v.size);
if (!sized.length) console.log("  No visits logged under the day size yet.");
else {
  console.log("  Measured from " + sized[0].at.slice(0, 10) + " (first visit under day size " + sized[0].size + ").");
  const perDay = Object.values(count(sized, (v) => dayOf(v.at)));
  row("cards per day", "days " + perDay.length, "median " + median(perDay), "max " + Math.max(...perDay), "hit 30: " + perDay.filter((n) => n >= 30).length);
  const bySess = {}; sized.forEach((v) => { if (v.s) (bySess[v.s] = bySess[v.s] || []).push(v); });
  const lens = Object.values(bySess).map((a) => a.length);
  if (lens.length) row("cards per session", "sessions " + lens.length, "median " + median(lens), "p90 " + pct(lens, 0.9), "max " + Math.max(...lens));
  console.log("  By place in the session (median time, share read as thought):");
  [[1, 5], [6, 10], [11, 20], [21, 30], [31, 45], [46, 1e9]].forEach(([a, b]) => {
    const g = sized.filter((v) => v.n >= a && v.n <= b && !v.idle);
    const th = g.filter((v) => (v.cls || v.kind) === "thought" || (v.cls || v.kind) === "worked").length;
    row("    cards " + a + "-" + (b > 1e8 ? "" : b), g.length, sec(median(g.map((v) => v.ms))) + "s", Math.round(100 * th / Math.max(1, g.length)) + "% thought");
  });
  console.log("  By pile (due, new, extra = top-up, more = Keep going, review, picked):");
  Object.entries(count(sized, (v) => v.pile || "?")).forEach(([p, n]) => {
    const g = sized.filter((v) => (v.pile || "?") === p && !v.idle);
    const th = g.filter((v) => ["thought", "worked"].includes(v.cls || v.kind)).length;
    row("    " + p, n, sec(median(g.map((v) => v.ms))) + "s", Math.round(100 * th / Math.max(1, g.length)) + "% thought");
  });
  const kg = events.filter((e) => e.e === "tap" && e.id === "earlyBtn").length, cl = count(events.filter((e) => e.e === "closing"), (e) => e.why);
  row("closing screen", "limit " + (cl.limit || 0), "done " + (cl.done || 0), "Keep going " + kg);
}

// 3. Arrivals: how much is written, and whether 5 new a day keeps up.
h("3. New thoughts: written per day and the line waiting");
const created = count(thoughts.filter((t) => t.created && (!sinceArg || t.created >= sinceArg)), (t) => (t.from || (t.set ? "set" : "own")));
row("added in the window", ...Object.entries(created).map(([k, n]) => k + " " + n));
const own = thoughts.filter((t) => !t.from && !t.set && t.created && (!sinceArg || t.created >= sinceArg));
const ownDays = Object.values(count(own, (t) => dayOf(t.created)));
row("written by you", "days " + ownDays.length, "median/day " + median(ownDays), "max " + (ownDays.length ? Math.max(...ownDays) : 0));
const snaps = events.filter((e) => e.e === "snapshot");
if (snaps.length) { console.log("  The line waiting to arrive, by day:"); snaps.forEach((s) => console.log("    " + dayOf(s.t) + "  waiting " + String(s.waiting).padStart(4) + "   due " + String(s.due).padStart(3) + "   in rotation " + s.rotation + "   put away " + s.away)); }

// 4. Use: what is used, when and how often.
h("4. Use: sessions, times, screens and taps");
const sess = events.filter((e) => e.e === "session"), ends = {};
events.filter((e) => e.e === "session_end").forEach((e) => { ends[e.s] = e; });
row("sessions", sess.length, "launch " + sess.filter((e) => e.src === "launch").length, "return " + sess.filter((e) => e.src === "return").length);
const durs = Object.values(ends).map((e) => e.ms);
if (durs.length) row("session length", "median " + sec(median(durs)) + "s", "p90 " + sec(pct(durs, 0.9)) + "s");
const sd = Object.values(count(sess, (e) => dayOf(e.t)));
if (sd.length) row("sessions per day", "median " + median(sd), "max " + Math.max(...sd));
console.log("  By hour (local):");
const byHour = count(sess, (e) => hourOf(e.t));
for (let i = 0; i < 24; i++) if (byHour[i]) console.log("    " + String(i).padStart(2, "0") + ":00  " + "#".repeat(byHour[i]) + " " + byHour[i]);
const dn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], byDow = count(sess, (e) => local(e.t).getUTCDay());
console.log("  By weekday: " + dn.map((d, i) => d + " " + (byDow[i] || 0)).join(", "));
console.log("  Screens opened:");
Object.entries(count(events.filter((e) => e.e === "screen"), (e) => e.to)).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => row("    " + k, n));
console.log("  Taps:");
Object.entries(count(events.filter((e) => e.e === "tap"), (e) => e.id)).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => row("    " + k, n));
const known = ["setSets", "setImport", "setIcon", "look:light", "look:dark", "look:auto", "setBackup", "setRestore", "setHelp", "setFeedback", "setSupport", "setPrivacy", "setAI", "earlyBtn", "earlyWrite", "earlyMarked", "libNew", "view:new", "view:marked", "toastUndo", "toastDel"];
const tapped = new Set(events.filter((e) => e.e === "tap").map((e) => e.id));
console.log("  Never used in the window: " + (known.filter((k) => !tapped.has(k)).join(", ") || "none"));
console.log("  How cards were left: " + Object.entries(count(visits, (v) => v.how || "?")).map(([k, n]) => k + " " + n).join(", ") +
  "; swipes that sprang back " + events.filter((e) => e.e === "swipe_back").length + "; undos " + events.filter((e) => e.e === "undo").length);
const w = events.filter((e) => e.e === "write"), ed2 = events.filter((e) => e.e === "edit");
row("writes", w.length, "median length " + median(w.map((e) => e.len)), "with who said it " + w.filter((e) => e.by).length, "quoted " + w.filter((e) => e.quoted).length);
row("edits", ed2.length, "text " + ed2.filter((e) => e.text).length, "note " + ed2.filter((e) => e.note).length, "by " + ed2.filter((e) => e.by).length, "bookmark " + ed2.filter((e) => e.mark).length);
row("deletes", events.filter((e) => e.e === "delete").length, "imports " + events.filter((e) => e.e === "import").length, "restores " + events.filter((e) => e.e === "restore").length);

// 5. Outcomes: where thoughts go.
h("5. Outcomes: how thoughts move");
const away = thoughts.filter((t) => t.away);
const toAway = away.filter((t) => t.created).map((t) => (Date.parse(t.away) - Date.parse(t.created)) / 86400000).filter((d) => d >= 0);
row("put away", away.length, "median days to put away " + Math.round(median(toAway)));
row("thought about (thinks)", "0: " + thoughts.filter((t) => !t.thinks).length, "1-2: " + thoughts.filter((t) => t.thinks >= 1 && t.thinks <= 2).length, "3+: " + thoughts.filter((t) => t.thinks >= 3).length);
row("worked on (works)", thoughts.filter((t) => t.works).length, "skipped 3+ times " + thoughts.filter((t) => (t.skips || 0) >= 3).length, "with a note " + thoughts.filter((t) => t.note).length);

// 6. Health.
h("6. Health: errors, storage, load time, versions");
const errs = events.filter((e) => e.e === "error");
row("page errors", errs.length); Object.entries(count(errs, (e) => e.msg + " @ " + e.at)).slice(0, 10).forEach(([k, n]) => console.log("    " + n + "x " + k));
row("storage failures", events.filter((e) => e.e === "storage_fail").length, "native failures " + events.filter((e) => e.e === "native_fail").length);
const boots = events.filter((e) => e.e === "boot");
if (boots.length) row("load to first card", "median " + median(boots.map((e) => e.ms)) + "ms", "p90 " + pct(boots.map((e) => e.ms), 0.9) + "ms");
console.log("  Versions and builds: " + Object.entries(count(boots, (e) => e.v + (e.build ? " (" + e.build + ")" : ""))).map(([k, n]) => k + " x" + n).join(", "));
console.log("  Appearance: " + Object.entries(count(boots, (e) => (e.look || "auto") + (e.dark ? "/phone dark" : "/phone light"))).map(([k, n]) => k + " x" + n).join(", "));
console.log("  Visit log " + (bk.visits || []).length + " of 5000 kept; event log " + (bk.events || []).length + " of 8000 kept.");
