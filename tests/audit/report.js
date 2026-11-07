// Turns the raw results into the audit report: a scorecard per journey, the 30-day run, and every rule issue grouped
// by where it happens, worst first. Writes audit-out/report.md and audit-out/report.html.
const fs = require("fs"), path = require("path");

const A11Y = ["tap-target", "contrast", "no-name", "focus-zoom", "small-text"];
const COPY = ["copy-emdash", "copy-please", "copy-click", "copy-coachy", "copy-exclaim"];
const RULE_NAMES = { "tap-target": "Tap target under 44 x 44", contrast: "Low contrast", "no-name": "No accessible name", "focus-zoom": "Field zooms the page on focus",
  "small-text": "Text under 12 px", truncation: "Text cut off", clamped: "Text clamped", "h-scroll": "Sideways scroll", motion: "Motion with reduced motion on",
  "copy-emdash": "Em-dash in the app's words", "copy-please": "\"Please\"", "copy-click": "\"Click\"", "copy-coachy": "Coaching words", "copy-exclaim": "Exclamation mark on a control" };

function load(f) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return null; } }
function uniq(issues) { const m = new Map(); issues.forEach((i) => { const k = i.rule + "|" + i.sel + "|" + i.detail; if (!m.has(k)) m.set(k, i); }); return Array.from(m.values()); }

function score(row, primary) {
  const runs = Object.values(row.runs), p = row.runs[primary] || runs[0];
  const passRate = runs.filter((r) => r.passed).length / runs.length;
  const steps = runs.flatMap((r) => r.steps);
  const issues = uniq(steps.flatMap((s) => s.issues));
  const success = Math.round(40 * passRate);
  const cost = Math.max(0, 20 - 5 * Math.max(0, p.cost - row.target));
  const copy = issues.filter((i) => COPY.includes(i.rule)).length, wordy = steps.some((s) => s.words > 60);
  const clarity = Math.max(0, 15 - 3 * copy - (wordy ? 5 : 0));
  const a11y = issues.filter((i) => A11Y.includes(i.rule) && i.sev >= 2);
  const access = Math.max(0, 15 - Math.min(15, 2 * a11y.length));
  const errors = Array.from(new Set(runs.flatMap((r) => r.errors)));
  const shift = steps.some((s) => s.cls != null && s.cls > 0.1), hs = issues.some((i) => i.rule === "h-scroll"), cut = issues.filter((i) => i.rule === "truncation").length;
  const resil = Math.max(0, 10 - 5 * errors.length - (shift ? 3 : 0) - (hs ? 3 : 0) - 2 * Math.min(cut, 2));
  return { total: success + cost + clarity + access + resil, success, cost, clarity, access, resil, passRate, primaryCost: p.cost, maxWords: Math.max(0, ...steps.map((s) => s.words)),
    issues, errors, failed: runs.flatMap((r, i) => r.checks.filter((c) => !c.ok).map((c) => Object.keys(row.runs)[i] + ": " + c.msg)), video: p.video, dir: p.dir };
}

function main(o) {
  const OUT = o.out, engine = o.engine || "chromium";
  const res = load(path.join(OUT, "results-" + engine + ".json")), sim = load(path.join(OUT, "sim.json")), states = load(path.join(OUT, "states-" + engine + ".json")) || [];
  if (!res) { console.log("No results to report."); return; }
  const primary = (res.devices.find((d) => d.primary) || res.devices[0]).id;
  const rows = res.journeys.map((j) => Object.assign({ j }, score(j, primary)));
  const avg = Math.round(rows.reduce((a, r) => a + r.total, 0) / Math.max(1, rows.length));

  // Every rule issue across journeys and states, grouped by rule and element.
  const groups = new Map();
  const addIssue = (i, where, shot) => {
    const k = i.rule + "|" + i.sel;
    const g = groups.get(k) || { rule: i.rule, sel: i.sel, sev: 0, where: new Set(), details: new Set(), shot };
    g.sev = Math.max(g.sev, i.sev); g.where.add(where); g.details.add(i.detail); if (!g.shot) g.shot = shot; groups.set(k, g);
  };
  res.journeys.forEach((j) => Object.entries(j.runs).forEach(([dev, r]) => r.steps.forEach((s) => s.issues.forEach((i) => addIssue(i, j.id + " " + dev, s.shot ? path.join(r.dir, s.shot) : null)))));
  states.forEach((s) => s.issues.forEach((i) => addIssue(i, s.state + " " + s.variant, s.file)));
  const issueList = Array.from(groups.values()).map((g) => Object.assign(g, { where: Array.from(g.where), details: Array.from(g.details) }))
    .sort((a, b) => b.sev - a.sev || b.where.length - a.where.length);
  const stateErr = states.filter((s) => s.errors.length || !s.reached);

  // Markdown
  let md = "# Scales UX audit\n\n";
  md += "Version " + res.version + ", " + engine + ", " + res.at.slice(0, 16).replace("T", " ") + " UTC. Phones: " + res.devices.map((d) => d.name + " (" + d.width + "x" + d.height + ")").join(", ") + ".\n\n";
  md += "**Average journey score: " + avg + "/100.** " + rows.filter((r) => r.passRate === 1).length + " of " + rows.length + " journeys pass on every phone.\n\n";
  md += "## Journeys\n\n| | Journey | Score | Pass | Cost (target) | Most words on a screen | Issues |\n|---|---|---|---|---|---|---|\n";
  rows.forEach((r) => { md += "| " + r.j.id + " | " + r.j.name + " | " + r.total + " | " + Math.round(r.passRate * 100) + "% | " + r.primaryCost + " (" + r.j.target + ") | " + r.maxWords + " | " + r.issues.filter((i) => i.sev >= 2).length + " |\n"; });
  const fails = rows.filter((r) => r.failed.length || r.errors.length);
  if (fails.length) {
    md += "\n### What failed\n\n";
    fails.forEach((r) => { md += "- **" + r.j.id + " " + r.j.name + "**\n"; r.failed.forEach((f) => { md += "  - " + f + "\n"; }); r.errors.forEach((e) => { md += "  - Page error: `" + e.slice(0, 160) + "`\n"; }); });
  }
  if (sim) {
    md += "\n## 30 days of use (" + sim.thoughts + " thoughts)\n\n";
    sim.users.forEach((u) => {
      md += "**" + u.name + "**\n\n";
      u.checks.forEach((c) => { md += "- " + (c.ok ? "Pass" : "**Fail**") + ": " + c.msg + " (" + c.detail + ")\n"; });
      md += "- Cards a day: " + u.stats.cardsPerDay + "; longest gap between meetings: " + u.stats.maxGap + " days; most-avoided thoughts met (median): " + u.stats.avoidedMeetMedian + " times\n\n";
    });
  }
  md += "## Rule issues, worst first\n\n| Sev | Rule | Where | Seen in | Example |\n|---|---|---|---|---|\n";
  issueList.filter((g) => g.sev >= 2).forEach((g) => { md += "| " + g.sev + " | " + (RULE_NAMES[g.rule] || g.rule) + " | `" + g.sel + "` | " + g.where.length + " | " + String(g.details[0]).replace(/\|/g, "/").slice(0, 90) + " |\n"; });
  const minor = issueList.filter((g) => g.sev < 2);
  if (minor.length) { md += "\nMinor (severity 1): " + minor.length + " items, listed in report.html.\n"; }
  if (stateErr.length) { md += "\n## States with problems\n\n"; stateErr.forEach((s) => { md += "- " + s.name + " (" + s.variant + "): " + (s.reached ? "" : "not reached. ") + s.errors.join("; ").slice(0, 200) + "\n"; }); }
  md += "\n## Not scored by the machine\n\n- **Feel:** watch the videos in `videos/` at normal speed.\n- **Usability (SUS):** from people only, see docs/audit/human-round.md.\n";
  fs.writeFileSync(path.join(OUT, "report.md"), md);

  // HTML
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let h = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Scales UX audit</title><style>' +
    "body{font:15px/1.5 -apple-system,system-ui,sans-serif;max-width:1100px;margin:0 auto;padding:24px;color:#1d1d1b;background:#fafaf8}h1{font-size:26px}h2{margin-top:36px;font-size:19px}" +
    "table{border-collapse:collapse;width:100%;font-size:13px;background:#fff}th,td{border-bottom:1px solid #e6e6e2;padding:7px 8px;text-align:left;vertical-align:top}th{background:#f0f0ec}" +
    ".s4,.s3{color:#a3261b;font-weight:700}.s2{color:#9a6400;font-weight:600}.ok{color:#2f6b2f}.bad{color:#a3261b;font-weight:600}.big{font-size:34px;font-weight:700}" +
    ".heat{font:9px/9px ui-monospace,monospace;white-space:pre;background:#fff;padding:8px;overflow-x:auto;border:1px solid #ddd}.thumb{width:90px;border-radius:8px;border:1px solid #ccc}" +
    "details{margin:6px 0}summary{cursor:pointer}.bar{display:inline-block;height:9px;background:#8aa86b;border-radius:3px;vertical-align:middle}</style></head><body>";
  h += "<h1>Scales UX audit</h1><p>Version " + esc(res.version) + " &middot; " + esc(engine) + " &middot; " + esc(res.at.slice(0, 16).replace("T", " ")) + " UTC</p>";
  h += '<p><span class="big">' + avg + '</span>/100 average across ' + rows.length + " journeys. " + rows.filter((r) => r.passRate === 1).length + " pass on every phone. " +
    '<a href="contact-sheet.html">Contact sheet of every screen</a>.</p>';
  h += "<h2>Journeys</h2><table><tr><th></th><th>Journey</th><th>Score</th><th>Success /40</th><th>Cost /20</th><th>Clarity /15</th><th>Access /15</th><th>Resilience /10</th><th>Cost (target)</th><th>Video</th></tr>";
  rows.forEach((r) => {
    h += "<tr><td>" + esc(r.j.id) + "</td><td>" + esc(r.j.name) + (r.failed.length ? '<br><span class="bad">' + r.failed.map(esc).join("<br>") + "</span>" : "") + (r.errors.length ? '<br><span class="bad">Error: ' + esc(r.errors[0].slice(0, 140)) + "</span>" : "") +
      '</td><td><b>' + r.total + '</b> <span class="bar" style="width:' + r.total * 0.6 + 'px"></span></td><td>' + r.success + "</td><td>" + r.cost + "</td><td>" + r.clarity + "</td><td>" + r.access + "</td><td>" + r.resil + "</td><td>" + r.primaryCost + " (" + r.j.target + ")</td><td>" +
      (r.video ? '<a href="' + esc(r.video) + '">watch</a>' : "") + "</td></tr>";
  });
  h += "</table>";
  rows.forEach((r) => {
    const run = r.j.runs[primary] || Object.values(r.j.runs)[0];
    h += "<details><summary>" + esc(r.j.id) + " steps on " + esc(primary) + " (" + run.steps.length + ")</summary><table><tr><th>#</th><th>Step</th><th>Screen</th><th>Words</th><th>Controls</th><th>Issues</th><th>Shot</th></tr>";
    run.steps.forEach((s) => { h += "<tr><td>" + s.n + "</td><td>" + esc(s.label) + "</td><td>" + esc(s.screens.join(", ")) + "</td><td>" + s.words + "</td><td>" + s.controls + "</td><td>" + s.issues.filter((i) => i.sev >= 2).map((i) => esc(RULE_NAMES[i.rule] || i.rule) + " " + esc(i.sel)).join("<br>") + "</td><td>" + (s.shot ? '<a href="' + esc(path.join(run.dir, s.shot)) + '"><img class="thumb" loading="lazy" src="' + esc(path.join(run.dir, s.shot)) + '"></a>' : "") + "</td></tr>"; });
    h += "</table>";
    h += "<p>" + run.checks.map((c) => '<span class="' + (c.ok ? "ok" : "bad") + '">' + (c.ok ? "&#10003; " : "&#10007; ") + esc(c.msg) + "</span>").join("<br>") + "</p></details>";
  });
  if (sim) {
    h += "<h2>30 days of use</h2><p>The real scheduling code, " + sim.thoughts + " made-up thoughts, five kinds of user. Each row of the map is a thought, each column a day: <code>t</code> thought about, <code>s</code> skipped, <code>.</code> seen, <code>w</code> edited.</p>";
    sim.users.forEach((u) => {
      h += "<h3>" + esc(u.name) + "</h3><p>" + u.checks.map((c) => '<span class="' + (c.ok ? "ok" : "bad") + '">' + (c.ok ? "&#10003; " : "&#10007; ") + esc(c.msg) + "</span> <small>(" + esc(c.detail) + ")</small>").join("<br>") + "</p>";
      h += "<details><summary>Map of 30 days</summary><div class=\"heat\">" + esc(u.heat.join("\n")) + "</div></details>";
    });
  }
  h += "<h2>Rule issues, worst first</h2><table><tr><th>Sev</th><th>Rule</th><th>Element</th><th>Seen in</th><th>Examples</th><th>Shot</th></tr>";
  issueList.forEach((g) => {
    h += '<tr><td class="s' + g.sev + '">' + g.sev + "</td><td>" + esc(RULE_NAMES[g.rule] || g.rule) + "</td><td><code>" + esc(g.sel) + "</code></td><td>" + g.where.length + "<br><small>" + esc(g.where.slice(0, 6).join(", ")) + (g.where.length > 6 ? "&hellip;" : "") + "</small></td><td><small>" +
      g.details.slice(0, 3).map(esc).join("<br>") + "</small></td><td>" + (g.shot ? '<a href="' + esc(g.shot) + '"><img class="thumb" loading="lazy" src="' + esc(g.shot) + '"></a>' : "") + "</td></tr>";
  });
  h += "</table>";
  if (stateErr.length) h += "<h2>States with problems</h2><ul>" + stateErr.map((s) => "<li>" + esc(s.name) + " (" + esc(s.variant) + "): " + esc((s.reached ? "" : "not reached. ") + s.errors.join("; ").slice(0, 300)) + "</li>").join("") + "</ul>";
  h += "<h2>Not scored by the machine</h2><p><b>Feel</b>: watch the videos at normal speed. <b>Usability (SUS)</b>: from people only; see docs/audit/human-round.md.</p></body></html>";
  fs.writeFileSync(path.join(OUT, "report.html"), h);
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify({ version: res.version, engine, average: avg, journeys: rows.map((r) => ({ id: r.j.id, name: r.j.name, score: r.total, pass: r.passRate, cost: r.primaryCost, target: r.j.target, failed: r.failed, errors: r.errors })),
    issues: issueList.map((g) => ({ sev: g.sev, rule: g.rule, sel: g.sel, seenIn: g.where.length, example: g.details[0] })), sim: sim && sim.users.map((u) => ({ name: u.name, checks: u.checks, stats: u.stats })) }, null, 1));
}
if (require.main === module) main({ out: process.argv[2] || path.join(__dirname, "..", "..", "audit-out"), engine: process.argv[3] || "chromium" });
module.exports = { main };
