// Every screen state Scales can be in, photographed in both color themes, light and dark, on three iPhone sizes,
// with the rule checks run on each. Writes audit-out/contact-sheet.html (one page to review like a design board)
// and audit-out/states.json. A last pass with reduced motion on checks that nothing keeps animating.
const fs = require("fs"), path = require("path");
const pw = require("playwright");
const { bridgeInit } = require("./lib/bridge");
const { pageRules } = require("./lib/rules");
const F = require("./lib/fixtures");
const C = require("../../core.js");

const DEVICES = [{ id: "17", width: 402, height: 874 }, { id: "se", width: 375, height: 667 }, { id: "promax", width: 440, height: 956 }];
const LONG_ID = "f" + String(F.texts().findIndex(([t]) => t === F.LONG)).padStart(3, "0");
const w8 = (p, ms) => p.waitForTimeout(ms);
const openLib = async (p) => { await p.click("#strip"); await w8(p, 900); };
const openSet = async (p) => { await openLib(p); await p.click("#libGear"); await w8(p, 700); };

const STATES = [
  { id: "first-run", name: "First run", seed: "empty", query: "tips=1", go: async () => {} },
  { id: "set-offer", name: "Set offer after the first thought", seed: "empty", query: "tips=1", go: async (p) => { await p.fill("#writeText", "Patience over speed."); await p.click("#writeKeep"); await w8(p, 3400); } },
  { id: "reading", name: "Reading a thought", go: async () => {} },
  { id: "reading-long", name: "Reading a long thought", ui: { cur: LONG_ID }, go: async () => {} },
  { id: "reading-quote", name: "Reading a quote with who said it", ui: { cur: "f030" }, go: async () => {} },
  { id: "drag-up", name: "Mid swipe up", go: async (p) => { const b = await p.locator("#stage").boundingBox(); await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down(); for (let i = 1; i <= 8; i++) await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2 - i * 14); await w8(p, 150); }, after: async (p) => { await p.mouse.up(); } },
  { id: "put-away-toast", name: "Just put away, with Undo", go: async (p) => { await p.keyboard.press("ArrowDown"); await w8(p, 700); } },
  { id: "day-end", name: "That's 30 for today", seed: "dayend", go: async () => {} },
  { id: "write", name: "Writing a new thought", go: async (p) => { await p.click("#stripNew"); await w8(p, 600); await p.fill("#writeText", "Ask for help sooner than feels comfortable."); } },
  { id: "edit", name: "Edit", go: async (p) => { await p.keyboard.press("e"); await w8(p, 800); } },
  { id: "edit-note", name: "Edit with a note open", go: async (p) => { await p.keyboard.press("e"); await w8(p, 700); await p.click("#noteBtn"); await p.fill("#editNote", "Tried this with the team on Monday."); await w8(p, 200); } },
  { id: "argue", name: "Argue with it", go: async (p) => { await w8(p, 500); await p.keyboard.press("e"); await w8(p, 700); await p.click("#argBtn"); await w8(p, 1500); } },
  { id: "library", name: "Your thoughts", go: async (p) => { await w8(p, 2500); await openLib(p); } },
  { id: "library-group", name: "Your thoughts, a group open", go: async (p) => { await openLib(p); await p.click('#libList [data-group="avoid"]'); await w8(p, 500); } },
  { id: "library-search", name: "Searching", go: async (p) => { await openLib(p); await p.fill("#q", "slow"); await w8(p, 400); } },
  { id: "library-away", name: "Put away list", go: async (p) => { await openLib(p); await p.click("#libList .arch"); await w8(p, 500); } },
  { id: "tension", name: "A tension", go: async (p) => { await w8(p, 3000); await openLib(p); await p.click('#libList [data-group="tension"]'); await w8(p, 400); await p.click("#libList [data-tension]"); await w8(p, 800); } },
  { id: "why", name: "Say why", go: async (p) => { await p.keyboard.press("ArrowDown"); await w8(p, 600); await p.click("#toastWhy"); await w8(p, 700); } },
  { id: "settings", name: "Settings", go: async (p) => { await openSet(p); } },
  { id: "insights", name: "Insights", go: async (p) => { await openSet(p); await p.click("#setIns"); await w8(p, 800); } },
  { id: "themes-week", name: "Themes and your week", go: async (p) => { await openSet(p); await p.click("#setAI"); await w8(p, 700); } },
  { id: "sets", name: "Sets", go: async (p) => { await openSet(p); await p.click("#setSets"); await w8(p, 700); } },
  { id: "import", name: "Import", go: async (p) => { await openSet(p); await p.click("#setImport"); await w8(p, 600); await p.fill("#impText", "The obstacle is the way.\n- Marcus Aurelius\n\nWell begun is half done."); await w8(p, 400); } },
  { id: "backups", name: "Backups", go: async (p) => { await openSet(p); await p.click("#setBackups"); await w8(p, 700); } },
  { id: "icon", name: "App icon", go: async (p) => { await openSet(p); await p.click("#setIcon"); await w8(p, 700); } },
  { id: "help", name: "How Scales works", go: async (p) => { await openSet(p); await p.click("#setHelp"); await w8(p, 1200); } },
];

function seedData(st, now) {
  if (st.seed === "empty") return { store: null, log: null, ui: null };
  const d = F.regular(now);
  if (st.seed === "dayend") {
    const ids = C.inRotation(d.store).map((t) => t.id).slice(0, 30);
    ids.forEach((id, i) => d.log.push({ at: new Date(now.getTime() - (30 - i) * 60000).toISOString(), id, ms: 5000, kind: "skipped", pile: "due", n: i + 1, size: 30 }));
  }
  return d;
}

async function main(o) {
  const OUT = o.out, engine = o.engine || "chromium", base = o.base;
  const dir = path.join(OUT, "states", engine); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const browser = await pw[engine].launch();
  const shots = [];
  const variants = [];
  for (const d of DEVICES) for (const theme of ["pistachio", "stone"]) for (const scheme of ["light", "dark"]) variants.push({ d, theme, scheme });
  variants.push({ d: DEVICES[0], theme: "pistachio", scheme: "light", reduced: true });
  for (const v of variants) {
    const ctx = await browser.newContext({ viewport: { width: v.d.width, height: v.d.height }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
      colorScheme: v.scheme, reducedMotion: v.reduced ? "reduce" : "no-preference" });
    await ctx.addInitScript(bridgeInit, {});
    const vid = v.d.id + "-" + v.theme + "-" + v.scheme + (v.reduced ? "-reduced" : "");
    process.stdout.write(vid + " ");
    for (const st of STATES) {
      if (v.reduced && !["reading", "put-away-toast", "write", "edit", "library", "tension", "help"].includes(st.id)) continue;
      const now = new Date(), data = seedData(st, now);
      data.ui = Object.assign({}, data.ui || {}, st.ui || {}, v.theme === "stone" ? { theme: "stone" } : {});
      const page = await ctx.newPage();
      await page.addInitScript((dd) => {
        localStorage.clear();
        if (dd.store) localStorage.setItem("scales.next.thoughts.v1", JSON.stringify(dd.store));
        if (dd.log) localStorage.setItem("scales.next.log.v1", JSON.stringify(dd.log));
        if (dd.ui && Object.keys(dd.ui).length) localStorage.setItem("scales.next.ui.v1", JSON.stringify(dd.ui));
      }, data);
      const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
      let ok = true;
      try {
        await page.goto(base + "/?native=1" + (st.query ? "&" + st.query : "")); await w8(page, 1300);
        // Stop the init script from wiping storage on any later reload of this page.
        await st.go(page);
      } catch (e) { ok = false; errs.push("could not reach: " + String(e.message || e).split("\n")[0]); }
      const r = await page.evaluate(pageRules, { reducedMotion: !!v.reduced }).catch((e) => ({ issues: [], words: 0, controls: 0, screens: [], err: String(e) }));
      const f = vid + "-" + st.id + ".png";
      await page.screenshot({ path: path.join(dir, f) }).catch(() => {});
      if (st.after) await st.after(page).catch(() => {});
      shots.push({ state: st.id, name: st.name, variant: vid, device: v.d.id, theme: v.theme, scheme: v.scheme, reduced: !!v.reduced, file: path.relative(OUT, path.join(dir, f)),
        reached: ok, errors: errs, words: r.words, controls: r.controls, screens: r.screens, issues: r.issues });
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  console.log("");
  fs.writeFileSync(path.join(OUT, "states-" + engine + ".json"), JSON.stringify(shots, null, 1));
  sheet(OUT, engine, shots);
  return shots;
}

function sheet(OUT, engine, shots) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const states = Array.from(new Set(shots.map((s) => s.state)));
  const cols = Array.from(new Set(shots.filter((s) => !s.reduced).map((s) => s.variant)));
  let h = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Scales contact sheet</title><style>' +
    "body{font:14px/1.4 -apple-system,system-ui,sans-serif;margin:0;background:#f4f4f2;color:#1d1d1b}header{padding:24px 28px;background:#fff;border-bottom:1px solid #ddd;position:sticky;top:0;z-index:2}" +
    "h1{font-size:20px;margin:0 0 4px}section{padding:18px 28px;border-bottom:1px solid #e3e3df}h2{font-size:16px;margin:0 0 10px}.row{display:flex;gap:14px;overflow-x:auto;padding-bottom:8px}" +
    "figure{margin:0;flex:0 0 auto;width:170px}figure img{width:170px;border-radius:14px;border:1px solid #ccc;background:#fff}figcaption{font-size:11px;color:#555;margin-top:4px}" +
    ".bad{color:#a3261b;font-weight:600}.filter{margin-top:8px}.filter label{margin-right:12px;font-size:13px}</style></head><body><header><h1>Scales: every screen state</h1>" +
    "<div>" + states.length + " states, " + cols.length + " variants (3 sizes x 2 colors x light/dark). Red counts are rule issues; open report.html for detail.</div>" +
    '<div class="filter"><label><input type="checkbox" id="f17" checked> iPhone 17</label><label><input type="checkbox" id="fse" checked> SE</label><label><input type="checkbox" id="fpromax" checked> Pro Max</label></div></header>';
  states.forEach((st) => {
    const row = shots.filter((s) => s.state === st && !s.reduced);
    h += "<section><h2>" + esc(row[0].name) + "</h2><div class=\"row\">";
    row.forEach((s) => {
      const n = s.issues.filter((i) => i.sev >= 2).length;
      h += '<figure data-dev="' + s.device + '"><a href="' + esc(s.file) + '" target="_blank"><img loading="lazy" src="' + esc(s.file) + '" alt="' + esc(s.name + " " + s.variant) + '"></a><figcaption>' +
        esc(s.variant) + (n ? ' <span class="bad">' + n + " issues</span>" : "") + (s.reached ? "" : ' <span class="bad">not reached</span>') + (s.errors.length ? ' <span class="bad">error</span>' : "") + "</figcaption></figure>";
    });
    h += "</div></section>";
  });
  h += "<script>['17','se','promax'].forEach(function(d){document.getElementById('f'+d).onchange=function(e){document.querySelectorAll('figure[data-dev=\"'+d+'\"]').forEach(function(f){f.style.display=e.target.checked?'':'none';});};});</script></body></html>";
  fs.writeFileSync(path.join(OUT, "contact-sheet.html"), h);
}

module.exports = { main, STATES };
