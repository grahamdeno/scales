// Made-up collections for the audit. Never the owner's real thoughts: these are written to be the same shape and size
// (176 thoughts, a mix of his own lines and quotes, short and long, some avoided, some put away, some bookmarked).
const C = require("../../../core.js");

// A small seeded random, so every run builds the same collection.
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const OWN = [
  "Most things go better when I slow down.", "Say the hard thing early.", "Train when I don't feel like it.",
  "Listen until the other person is finished.", "Write the plan down before the meeting.", "Sleep is part of the work.",
  "Ask what would make this easy.", "Do the boring part first.", "Praise in public, correct in private.",
  "I owe my family my best hours, not my leftover ones.", "Decide once, then stop re-deciding.", "Walk before screens.",
  "Leave the campsite better than I found it.", "My mood is not the weather; I can change it.", "Keep promises small and keep them.",
  "Nobody remembers the excuse.", "Read the room, then lead it.", "A clear no beats a vague yes.",
  "Finish one thing before starting the next.", "The work I avoid is usually the work that matters.",
  "Be the calmest person in the room.", "Spend money on experiences, not things.", "Call my mother on Sundays.",
  "Write it so a tired person can follow it.", "Admit the mistake before anyone finds it.", "Rest is not a reward, it is a requirement.",
  "If it takes two minutes, do it now.", "Know the standard and hold it even when no one checks.",
  "Ask the quiet person first.", "My kids learn from what I do, not what I say.",
];
const QUOTES = [
  ["You have power over your mind, not outside events. Realize this, and you will find strength.", "Marcus Aurelius"],
  ["We suffer more often in imagination than in reality.", "Seneca"],
  ["Well done is better than well said.", "Benjamin Franklin"],
  ["Lost time is never found again.", "Benjamin Franklin"],
  ["It is not that we have a short time to live, but that we waste a lot of it.", "Seneca"],
  ["First say to yourself what you would be; and then do what you have to do.", "Epictetus"],
  ["No man is free who is not master of himself.", "Epictetus"],
  ["The happiness of your life depends upon the quality of your thoughts.", "Marcus Aurelius"],
  ["Energy and persistence conquer all things.", "Benjamin Franklin"],
  ["He who has a why to live can bear almost any how.", "After Friedrich Nietzsche"],
  ["Waste no more time arguing what a good man should be. Be one.", "Marcus Aurelius"],
  ["Difficulties strengthen the mind, as labor does the body.", "Seneca"],
];
const STEMS = ["When I'm tired,", "At work,", "With the kids,", "Before I react,", "On hard days,", "In meetings,", "With money,", "When I'm wrong,"];
const ENDS = ["I pause and breathe once.", "I choose the harder right.", "I ask one more question.", "I keep my word.", "I go slower than I want to.",
  "I say less and mean it.", "I look for what I can control.", "I do the next small thing."];
const LONG = "I keep telling myself that I will get to the important things once the urgent ones are handled, but the urgent ones never run out, so the honest version is that I am choosing the urgent ones because they feel like progress and the important ones feel like risk. The fix is to put one important thing first, every morning, before anything with a deadline gets a say.";

function texts() {
  const out = [];
  OWN.forEach((t) => out.push([t, ""]));
  QUOTES.forEach((q) => out.push(q));
  STEMS.forEach((s) => ENDS.forEach((e) => out.push([s + " " + (/^I /.test(e) ? e : e.charAt(0).toLowerCase() + e.slice(1)), ""])));
  out.push([LONG, ""]);
  out.push(["Is ambition just fear wearing a nicer coat?", ""]);
  out.push(["Gratitude first 🙏 then the to-do list.", ""]);
  // 30 + 12 + 64 + 3 = 109; fill to 176 with numbered practice lines so the size matches the real collection.
  let i = 1;
  while (out.length < 176) { out.push(["Practice line " + i + ": " + ENDS[i % ENDS.length], ""]); i++; }
  return out;
}

// A regular user: 176 thoughts over the last 9 weeks, a history of visits, some avoided, 12 put away, 4 bookmarked.
// Returns { store, log } ready for localStorage (scales.next.thoughts.v1 and scales.next.log.v1).
function regular(now) {
  const r = rng(176), store = {}, log = [], DAY = 86400000, today = C.dayKey(now);
  texts().forEach(([text, by], i) => {
    const created = new Date(now.getTime() - (63 - Math.floor(i / 3)) * DAY - 3600000 * (i % 7));
    const t = C.make(text, created, by);
    t.id = "f" + String(i).padStart(3, "0");
    const met = i < 160;           // the last 16 have never been met (new ones still arriving)
    if (met) {
      const n = 1 + Math.floor(r() * 6), pull = r();
      for (let k = 0; k < n; k++) {
        const at = new Date(now.getTime() - Math.floor(1 + r() * 20) * DAY - Math.floor(r() * 12) * 3600000);
        const kind = pull > 0.75 ? "skipped" : r() < 0.4 ? "skipped" : r() < 0.7 ? "thought" : "seen";
        const ms = kind === "skipped" ? 3000 + r() * 12000 : kind === "thought" ? 32000 + r() * 60000 : 22000 + r() * 6000;
        t.visits.push({ at: at.toISOString(), kind, ms: Math.round(ms) });
        log.push({ at: at.toISOString(), id: t.id, ms: Math.round(ms), worked: false, idle: false, kind, pile: "due", n: 1 + (k % 10) });
      }
      t.visits.sort((a, b) => (a.at < b.at ? -1 : 1));
      t.skips = Math.min(4, t.visits.filter((v) => v.kind === "skipped").length - t.visits.filter((v) => v.kind === "thought").length);
      if (t.skips < 0) t.skips = 0;
      t.thinks = t.visits.filter((v) => v.kind === "thought").length;
      t.seen = t.visits[t.visits.length - 1].at;
      // About half are due today or earlier, the rest over the next 10 days.
      t.due = r() < 0.5 ? C.addDays(today, -Math.floor(r() * 4)) : C.addDays(today, 1 + Math.floor(r() * 10));
    } else {
      t.due = C.addDays(today, Math.floor((i - 160) / 5));
    }
    if (i % 13 === 5 && met) t.away = new Date(now.getTime() - (i % 9 + 1) * DAY).toISOString();
    if (i % 41 === 3) t.bookmarked = new Date(now.getTime() - i * 60000).toISOString();
    if (i === 7) t.note = "Came up again after the Tuesday stand-up.";
    store[t.id] = t;
  });
  log.sort((a, b) => (a.at < b.at ? -1 : 1));
  return { store, log };
}

// A small collection for quick journeys: 12 thoughts, all due today.
function small(now) {
  const store = {}, today = C.dayKey(now);
  texts().slice(0, 12).forEach(([text, by], i) => {
    const t = C.make(text, new Date(now.getTime() - (20 - i) * 86400000), by);
    t.id = "s" + String(i).padStart(2, "0"); t.due = today;
    if (i < 6) { t.seen = new Date(now.getTime() - (3 + i) * 86400000).toISOString(); t.visits = [{ at: t.seen, kind: "seen", ms: 24000 }]; }
    store[t.id] = t;
  });
  return { store, log: [] };
}

function seedScript(data) {
  // Runs before the page on the first load of a context only, so reloads keep what the walk changed.
  return { fn: (d) => {
    if (sessionStorage.getItem("audit-seeded")) return;
    sessionStorage.setItem("audit-seeded", "1");
    localStorage.clear();
    if (d.store) localStorage.setItem("scales.next.thoughts.v1", JSON.stringify(d.store));
    if (d.log) localStorage.setItem("scales.next.log.v1", JSON.stringify(d.log));
    if (d.ui) localStorage.setItem("scales.next.ui.v1", JSON.stringify(d.ui));
  }, arg: data };
}

module.exports = { regular, small, texts, seedScript, rng, LONG };
