// Scales UX audit. Walks every journey on three iPhone sizes, runs the 30-day schedule simulation, photographs every
// screen state, then writes the report.
//
//   node tests/audit/run.js                     everything, Chromium
//   node tests/audit/run.js --engine webkit     the same in WebKit (Safari's engine; needs `npx playwright install webkit`)
//   node tests/audit/run.js --only J3,J4        some journeys
//   node tests/audit/run.js --quick             one phone size, no contact sheet
//
// Output: audit-out/ (report.html, report.md, contact-sheet.html, results.json, sim.json, videos/, journeys/, states/)
const fs = require("fs"), path = require("path");
const pw = require("playwright");
const { serve, root } = require("./lib/serve");
const { bridgeInit } = require("./lib/bridge");
const F = require("./lib/fixtures");
const { Walker } = require("./lib/walker");
const JOURNEYS = require("./journeys");

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes(k);
const ENGINE = arg("--engine", "chromium");
const OUT = path.resolve(arg("--out", path.join(root, "audit-out")));
const ONLY = (arg("--only", "") || "").split(",").filter(Boolean);
const QUICK = has("--quick");

const DEVICES = [
  { id: "17", name: "iPhone 17", width: 402, height: 874, primary: true },
  { id: "se", name: "iPhone SE", width: 375, height: 667 },
  { id: "promax", name: "iPhone 17 Pro Max", width: 440, height: 956 },
];

function seedFor(j, now) {
  if (j.seed === "empty") return { store: null, log: null };
  return j.seed === "regular" ? F.regular(now) : F.small(now);
}

async function walk(browser, base, j, dev) {
  const NOW = new Date();
  const dir = path.join(OUT, "journeys", ENGINE, j.id + "-" + dev.id);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const vdir = path.join(OUT, "videos", ENGINE);
  const ctx = await browser.newContext({ viewport: { width: dev.width, height: dev.height }, deviceScaleFactor: 2, hasTouch: true,
    isMobile: ENGINE !== "firefox", recordVideo: dev.primary ? { dir: vdir, size: { width: dev.width, height: dev.height } } : undefined });
  await ctx.addInitScript(bridgeInit, { ai: j.ai !== false });
  let data = seedFor(j, NOW);
  const later = j.awayDays ? new Date(NOW.getTime() + j.awayDays * 86400000) : NOW;
  const sd = F.seedScript(data); await ctx.addInitScript(sd.fn, sd.arg);
  const page = await ctx.newPage();
  if (j.clock) await page.clock.install({ time: later });
  const w = new Walker(page, { out: dir, journey: j.id, device: dev.id });
  const x = { file: (name, body) => { const f = path.join(dir, name); fs.writeFileSync(f, body); return f; }, now: later };
  const t = Date.now();
  try {
    await page.goto(base + "/?native=1" + (j.query ? "&" + j.query : ""));
    await page.waitForTimeout(1500);
    await j.run(w, x);
  } catch (e) { w.checks.push({ ok: false, msg: "the walk stopped: " + String(e.message || e).split("\n")[0] }); }
  const r = w.result();
  r.ms = Date.now() - t;
  const video = page.video();
  await ctx.close();
  if (video) {
    const f = path.join(vdir, j.id + ".webm");
    try { fs.renameSync(await video.path(), f); r.video = path.relative(OUT, f); } catch (e) {}
  }
  r.dir = path.relative(OUT, dir);
  return r;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const browser = await pw[ENGINE].launch();
  const results = { engine: ENGINE, version: require("../../core.js").VERSION, at: new Date().toISOString(), devices: [], journeys: [] };
  const devs = QUICK ? DEVICES.filter((d) => d.primary) : DEVICES;
  results.devices = devs;
  for (const j of JOURNEYS) {
    if (ONLY.length && !ONLY.includes(j.id)) continue;
    const row = { id: j.id, name: j.name, target: j.target, runs: {} };
    for (const d of devs) {
      process.stdout.write(j.id + " " + d.id + " ... ");
      const r = await walk(browser, srv.base, j, d);
      row.runs[d.id] = r;
      console.log((r.passed ? "pass" : "FAIL") + " cost " + r.cost + (r.errors.length ? " errors " + r.errors.length : "") +
        (r.passed ? "" : "  " + r.checks.filter((c) => !c.ok).map((c) => c.msg).join(" | ")));
    }
    results.journeys.push(row);
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "results-" + ENGINE + ".json"), JSON.stringify(results, null, 1));

  if (!has("--no-sim")) { console.log("\n30-day simulation"); require("./sim").main({ out: OUT }); }
  if (!QUICK && !has("--no-states")) { console.log("\nScreen states"); await require("./states").main({ out: OUT, engine: ENGINE, base: srv.base }); }
  srv.close();
  require("./report").main({ out: OUT, engine: ENGINE });
  console.log("\nReport: " + path.join(OUT, "report.html"));
})().catch((e) => { console.error(e); process.exit(1); });
