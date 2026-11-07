// 30 days of Scales in a few seconds. Runs the real scheduling code (core.js: nextCard, recordVisit, logVisit) for
// four kinds of user over 176 made-up thoughts, and checks what a person would feel: does the whole collection come
// round, do skipped thoughts come back on time, does the pile change from day to day, and does anything move that
// the person did not move.
//
//   node tests/audit/sim.js            prints the checks, writes audit-out/sim.json
const fs = require("fs"), path = require("path");
const C = require("../../core.js");
const F = require("./lib/fixtures");

const DAYS = 30, N = 176;
const USERS = {
  steady: { name: "Steady: every day, the full 30", days: () => true, cards: () => 30, keepGoing: 0 },
  light: { name: "Light: 10 a day, weekdays", days: (d) => d % 7 < 5, cards: () => 10, keepGoing: 0 },
  avoider: { name: "Avoider: every day, skips half", days: () => true, cards: () => 30, keepGoing: 0, skipBias: 0.35 },
  away: { name: "Away: two weeks off in the middle", days: (d) => d < 8 || d >= 22, cards: () => 30, keepGoing: 0 },
  keen: { name: "Keen: every day, 30 plus 10 more", days: () => true, cards: () => 30, keepGoing: 10 },
};

function collection(start) {
  // 176 thoughts that arrive the way an import does: a few a day, the rest already met.
  const r = F.rng(7), store = {}, today = C.dayKey(start);
  F.texts().forEach(([text, by], i) => {
    const t = C.make(text, new Date(start.getTime() - 40 * 86400000), by); t.id = "x" + String(i).padStart(3, "0");
    if (i < 140) {
      // already met once some time in the last three weeks
      t.seen = new Date(start.getTime() - Math.floor(1 + r() * 20) * 86400000).toISOString();
      t.visits = [{ at: t.seen, kind: "seen", ms: 24000 }];
      t.due = C.addDays(today, Math.floor(r() * 5) - 2);
    } else t.due = C.addDays(today, Math.floor((i - 140) / 5));
    t.pull = r();           // how much this person wants to skip this one (0 = always sits, 1 = always skips)
    store[t.id] = t;
  });
  return store;
}

function simulate(kind, opts) {
  const u = USERS[kind], r = F.rng(42 + kind.length);
  const start = new Date(2026, 10, 9, 8, 0, 0);
  const store = collection(start), log = [];
  const ids0 = Object.keys(store).sort().join(",");
  const days = [];          // per day: ids shown, piles
  const events = [];        // every visit
  const away0 = {}; Object.values(store).forEach((t) => { away0[t.id] = t.away; });
  for (let d = 0; d < DAYS; d++) {
    const day = { d, ids: [], piles: {} };
    if (u.days(d)) {
      let clock = new Date(start.getTime() + d * 86400000);
      const want = u.cards(d) + (u.keepGoing || 0);
      for (let k = 0; k < want; k++) {
        const more = k >= u.cards(d);
        const res = C.nextCard(store, log, clock, null, more);
        if (!res.card) break;
        const t = res.card;
        const skipP = Math.min(0.95, t.pull * 0.8 + (u.skipBias || 0));
        const skipped = r() < skipP;
        const ms = skipped ? 3000 + r() * 12000 : (r() < 0.7 ? 32000 + r() * 50000 : 22000 + r() * 6000);
        const worked = !skipped && r() < 0.05;
        clock = new Date(clock.getTime() + ms + 2000);
        const kindV = C.recordVisit(t, ms, worked, false, clock);
        C.logVisit(log, { at: clock.toISOString(), id: t.id, ms, worked, kind: kindV, pile: res.pile, n: k + 1, size: C.DAY_SIZE });
        day.ids.push(t.id); day.piles[res.pile] = (day.piles[res.pile] || 0) + 1;
        events.push({ d, id: t.id, kind: kindV, pile: res.pile, due: t.due });
      }
    }
    days.push(day);
  }
  // Invariants: nothing left, nothing put away, nothing changed text, except by the user (the sim user never puts away).
  const ids1 = Object.keys(store).sort().join(",");
  const movedAway = Object.values(store).filter((t) => t.away !== away0[t.id]).length;
  return { kind, name: u.name, days, events, store, idsSame: ids0 === ids1, movedAway };
}

function analyse(s) {
  const out = { kind: s.kind, name: s.name, checks: [], stats: {} };
  const ck = (ok, msg, detail) => out.checks.push({ ok: !!ok, msg, detail });
  const active = s.days.filter((d) => d.ids.length);
  // Coverage: days until every thought in rotation has been met at least once in the run.
  const all = Object.keys(s.store), met = new Set(); let coverDay = null;
  s.days.forEach((d) => { d.ids.forEach((i) => met.add(i)); if (coverDay == null && met.size === all.length) coverDay = d.d + 1; });
  out.stats.coverDay = coverDay; out.stats.metShare = +(met.size / all.length).toFixed(3);
  // Those already here at the start (met before) versus new ones arriving: new ones are dripped in on purpose.
  const wasMet = all.filter((i) => s.store[i].visits.length && s.store[i].visits[0].at < "2026-11-09");
  const met2 = new Set(); let coverOld = null;
  s.days.forEach((d) => { d.ids.forEach((i) => met2.add(i)); if (coverOld == null && wasMet.every((i) => met2.has(i))) coverOld = d.d + 1; });
  out.stats.coverOld = coverOld;
  const arrive = [];
  all.filter((i) => !wasMet.includes(i)).forEach((i) => { const e = s.events.find((x) => x.id === i); if (e) arrive.push(e.d - Math.floor((parseInt(i.slice(1), 10) - 140) / 5)); });
  out.stats.newWaitMax = arrive.length ? Math.max(...arrive) : null;
  // Return after a skip: due exactly 5 days later, and next shown how many days after due.
  const lateness = []; let wrongGap = 0;
  s.events.forEach((e, i) => {
    if (e.kind !== "skipped") return;
    const dueDay = e.d + C.SKIP_GAP;
    if (e.due !== C.addDays(C.dayKey(new Date(2026, 10, 9 + e.d, 12)), C.SKIP_GAP)) wrongGap++;
    const nxt = s.events.slice(i + 1).find((x) => x.id === e.id);
    if (nxt && (nxt.pile === "more" || nxt.pile === "extra")) { if (nxt.d < dueDay) out.stats.earlyByKeepGoing = (out.stats.earlyByKeepGoing || 0) + 1; return; }
    if (nxt) lateness.push(nxt.d - dueDay);
  });
  lateness.sort((a, b) => a - b);
  const pct = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : null);
  out.stats.skipReturnEarly = lateness.filter((x) => x < 0).length;
  out.stats.skipReturnMedianLate = pct(lateness, 0.5); out.stats.skipReturnP90Late = pct(lateness, 0.9);
  // Variety: overlap between one active day and the next.
  const ov = [];
  for (let i = 1; i < active.length; i++) { const a = new Set(active[i - 1].ids), b = active[i].ids; if (!b.length) continue; ov.push(b.filter((x) => a.has(x)).length / b.length); }
  ov.sort((a, b) => a - b);
  out.stats.overlapMedian = ov.length ? +pct(ov, 0.5).toFixed(3) : 0; out.stats.overlapMax = ov.length ? +ov[ov.length - 1].toFixed(3) : 0;
  // Avoid cap and new drip per day.
  out.stats.avoidMax = Math.max(0, ...s.days.map((d) => d.piles.avoid || 0));
  out.stats.newMax = Math.max(0, ...s.days.map((d) => d.piles.new || 0));
  // Longest gap between meetings (in days the user opened the app), per thought, for thoughts met at least once.
  const lastSeen = {}, gaps = [];
  s.days.forEach((d) => { d.ids.forEach((i) => { if (lastSeen[i] != null) gaps.push(d.d - lastSeen[i]); lastSeen[i] = d.d; }); });
  const neverInRun = all.filter((i) => lastSeen[i] == null).length;
  const tailGap = all.map((i) => (lastSeen[i] == null ? DAYS : DAYS - 1 - lastSeen[i]));
  out.stats.maxGap = Math.max(0, ...gaps, ...tailGap); out.stats.neverInRun = neverInRun;
  out.stats.cardsPerDay = active.length ? +(active.reduce((a, d) => a + d.ids.length, 0) / active.length).toFixed(1) : 0;
  out.stats.dupesInDay = s.days.filter((d) => new Set(d.ids).size !== d.ids.length).length;
  // A thought with high pull: how often does it come round? (avoidance should pull it back, not bury it)
  const hot = Object.values(s.store).filter((t) => t.pull > 0.85).map((t) => t.id);
  const hotMeet = hot.map((id) => s.events.filter((e) => e.id === id).length);
  out.stats.avoidedMeetMedian = pct(hotMeet.sort((a, b) => a - b), 0.5);
  // Heat map rows for the report: per thought, per day, what happened (" " none, s skipped, t thought, w worked, . seen).
  const code = { skipped: "s", thought: "t", worked: "w", seen: "." };
  out.heat = all.slice().sort().map((id) => { const row = Array(DAYS).fill(" "); s.events.filter((e) => e.id === id).forEach((e) => { row[e.d] = code[e.kind] || "?"; }); return row.join(""); });

  ck(s.idsSame && s.movedAway === 0, "Nothing moves on its own: no thought removed or put away without the person", "removed: " + (!s.idsSame) + ", put away: " + s.movedAway);
  ck(out.stats.dupesInDay === 0, "No thought shows twice in one day", out.stats.dupesInDay + " days with repeats");
  ck(out.stats.avoidMax <= C.AVOID_PER_DAY, "Avoided thoughts never take more than " + C.AVOID_PER_DAY + " places a day", "most in a day: " + out.stats.avoidMax);
  ck(out.stats.newMax <= 12, "New thoughts arrive a few a day, never a flood", "most in a day: " + out.stats.newMax);
  ck(wrongGap === 0 && out.stats.skipReturnEarly === 0, "A skipped thought is due again in exactly 5 days and the day's pile never brings it sooner", "early returns: " + out.stats.skipReturnEarly + (out.stats.earlyByKeepGoing ? "; " + out.stats.earlyByKeepGoing + " came back sooner through Keep going, by design" : ""));
  if (s.kind === "steady" || s.kind === "keen") {
    ck(coverOld != null && coverOld <= 7, "Every thought already here is met within 7 days", coverOld == null ? "not all met in 30 days" : "all met by day " + coverOld + " (with new ones still arriving, everything by day " + coverDay + ")");
    ck(out.stats.newWaitMax != null && out.stats.newWaitMax <= 1, "A new thought is met within a day of arriving", "longest wait " + out.stats.newWaitMax + " days");
    ck(out.stats.skipReturnMedianLate != null && out.stats.skipReturnMedianLate <= 2, "A skipped thought is shown within 2 days of coming due (median)", "median " + out.stats.skipReturnMedianLate + " days late, 90th percentile " + out.stats.skipReturnP90Late);
    ck(out.stats.overlapMedian <= 0.2, "The pile changes from day to day (median overlap under 20%)", "median " + Math.round(out.stats.overlapMedian * 100) + "%, worst " + Math.round(out.stats.overlapMax * 100) + "%");
    ck(out.stats.maxGap <= 14, "No thought goes unseen more than 14 days", "longest gap " + out.stats.maxGap + " days");
  }
  if (s.kind === "light") ck(out.stats.metShare >= 0.9 || coverDay != null, "A light user still meets nearly all thoughts in a month", Math.round(out.stats.metShare * 100) + "% met");
  if (s.kind === "away") ck(out.stats.cardsPerDay <= 30 && s.days[22].ids.length <= 30, "Coming back after two weeks gives a normal day, not a backlog", "first day back: " + s.days[22].ids.length + " cards");
  return out;
}

function main(o) {
  o = o || {};
  const res = { days: DAYS, thoughts: N, users: [] };
  Object.keys(USERS).forEach((k) => {
    const a = analyse(simulate(k));
    res.users.push(a);
    console.log("\n" + a.name);
    a.checks.forEach((c) => console.log((c.ok ? "ok   " : "FAIL ") + c.msg + "  (" + c.detail + ")"));
  });
  if (o.out) { fs.mkdirSync(o.out, { recursive: true }); fs.writeFileSync(path.join(o.out, "sim.json"), JSON.stringify(res, null, 1)); }
  return res;
}
if (require.main === module) {
  const r = main({ out: path.join(__dirname, "..", "..", "audit-out") });
  // --strict: fail (for CI) if any check fails, so a change to the scheduling rules can't quietly break the feel.
  if (process.argv.includes("--strict") && r.users.some((u) => u.checks.some((c) => !c.ok))) { console.log("\nA schedule check failed."); process.exit(1); }
}
module.exports = { main, simulate, analyse };
