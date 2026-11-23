// Browser check for Breathing words (2.38.0, 1.2 item 1): Off, Gentle or Box breathing.
// Run: node tests/e2e/breathe.e2e.js   (a stand-in plays the iPhone app and records the haptic styles the page asks for)
// The page's own timers run on a paused clock, so every moment is exact: P is the last touch, in-breath starts at P + 20 s.
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const root = path.join(__dirname, "..", "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".png": "image/png", ".woff2": "font/woff2" };
const server = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); s.end(fs.readFileSync(f));
});
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };
const ago = (d) => new Date(Date.now() - d * 86400000).toISOString();
const day = new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 10);
const texts = ["Decide to do what you should, then do what you decided.", "Don't waste time. Always be doing something useful.", "Very little is needed to live a happy life.", "Rest is part of the work.", "Speak only what may be heard twice.", "Begin before you are ready."];
const thoughts = {}; texts.forEach((t, i) => { thoughts["k" + i] = { id: "k" + i, text: t, by: "", note: "", created: ago(10), due: day, away: null, skips: 0, thinks: 0, works: 0, seen: ago(2), visits: [] }; });

// opts.ui: stored ui fields; opts.rm: Reduce Motion; opts.native: the iPhone stand-in; opts.paused: freeze the page's clock.
async function open(browser, base, opts) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: opts.rm ? "reduce" : "no-preference" });
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
  if (opts.paused) await page.clock.install({ time: new Date("2026-11-24T12:00:00Z") });
  await page.addInitScript((o) => {
    window.__h = [];
    if (o.native) window.webkit = { messageHandlers: { scales: { postMessage: (m) => { if (m.type === "haptic") window.__h.push(m.style); } } } };
    if (o.native) window.scalesNative = { build: "70" };
    if (!sessionStorage.getItem("s")) { localStorage.clear(); localStorage.setItem("scales.next.thoughts.v1", JSON.stringify(o.st)); localStorage.setItem("scales.next.ui.v1", JSON.stringify(Object.assign({ nudged: true, cur: "k0" }, o.ui))); sessionStorage.setItem("s", "1"); }
  }, { st: thoughts, ui: opts.ui || {}, native: opts.native !== false });
  await page.goto(base + "/" + (opts.native !== false ? "?native=1" : "")); await page.waitForSelector("#words:not(:empty)");
  if (opts.paused) {
    const now = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(new Date(now + 500));
    await touch(page);   // P: the last touch, so the 20 seconds start from a known moment
  }
  return { page, errs, ctx };
}
const touch = (page) => page.evaluate(() => document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
const state = (page) => page.evaluate(() => { const w = document.getElementById("words"); return { gentle: w.classList.contains("breathe"), box: w.classList.contains("boxing"), big: w.classList.contains("big"), h: window.__h.slice(), tf: getComputedStyle(w).transform }; });
const scaleOf = (tf) => { const m = /matrix\(([-\d.e]+),/.exec(tf); return m ? parseFloat(m[1]) : 1; };
const run = (page, ms) => page.clock.runFor(ms);

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch();

  // 1. Box breathing: starts after 20 s untouched; 4 s in, hold, out, hold; haptics on the in and the out only.
  {
    const { page, errs, ctx } = await open(browser, base, { ui: { breathe: "box" }, paused: true });
    await run(page, 19900); let s = await state(page);
    ok(!s.box && !s.big && !s.gentle && s.h.length === 0, "box: nothing moves before 20 seconds, and no haptic is sent");
    await run(page, 200); s = await state(page);
    ok(s.box && s.big && !s.gentle && s.h.join() === "breathIn", "box: after 20 s untouched the words grow and one breathIn is sent (" + s.h.join() + ")");
    await page.waitForTimeout(4400); s = await state(page);   // the transition runs on the browser's own clock
    ok(Math.abs(scaleOf(s.tf) - 1.018) < 0.0006, "box: the words end 1.8% larger (scale " + scaleOf(s.tf).toFixed(4) + ")");
    await run(page, 4000); s = await state(page);
    ok(s.big && s.h.join() === "breathIn", "box: the hold after the in-breath is silent and the words stay");
    await run(page, 4000); s = await state(page);
    ok(!s.big && s.h.join() === "breathIn,breathOut", "box: the out-breath shrinks the words and sends breathOut (" + s.h.join() + ")");
    await run(page, 4000); s = await state(page);
    ok(!s.big && s.h.length === 2, "box: the hold after the out-breath is silent");
    await run(page, 4000); s = await state(page);
    ok(s.big && s.h.join() === "breathIn,breathOut,breathIn", "box: the rhythm repeats (" + s.h.join() + ")");
    ok(errs.length === 0, "box: no page errors " + errs.join("|"));
    await ctx.close();
  }

  // 2. Stop on touch, and start again 20 s after it.
  {
    const { page, ctx } = await open(browser, base, { ui: { breathe: "box" }, paused: true });
    await run(page, 21000); await run(page, 0);
    let s = await state(page); ok(s.box && s.big, "touch: breathing is running");
    await touch(page); s = await state(page);
    ok(!s.box && !s.big && s.h[s.h.length - 1] === "breathStop", "touch: a touch stops the words and sends breathStop at once (" + s.h.join() + ")");
    await run(page, 19900); s = await state(page); ok(!s.box, "touch: it does not start before 20 seconds after the touch");
    await run(page, 200); s = await state(page); ok(s.box && s.big, "touch: it starts again 20 seconds after the touch");
    await ctx.close();
  }

  // 3. Stop when the app goes to the background, and when the reading screen is left.
  {
    const { page, ctx } = await open(browser, base, { ui: { breathe: "box" }, paused: true });
    await run(page, 21000);
    await page.evaluate(() => { Object.defineProperty(document, "hidden", { value: true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
    let s = await state(page);
    ok(!s.box && !s.big && s.h[s.h.length - 1] === "breathStop", "background: visibilitychange hidden stops the words and sends breathStop (" + s.h.join() + ")");
    await ctx.close();
  }
  {
    const { page, ctx } = await open(browser, base, { ui: { breathe: "box" }, paused: true });
    await run(page, 21000);
    await page.evaluate(() => document.getElementById("stripOpen").click());   // no touch event: only the screen changes
    await run(page, 100);
    const s = await state(page);
    ok(!s.box && !s.big && s.h[s.h.length - 1] === "breathStop", "leaving: opening the list stops the words and sends breathStop (" + s.h.join() + ")");
    await run(page, 30000);
    ok(!(await state(page)).box, "leaving: nothing starts while another screen is open");
    await ctx.close();
  }

  // 4. Reduce Motion: no scale; the haptics still run.
  {
    const { page, ctx } = await open(browser, base, { ui: { breathe: "box" }, paused: true, rm: true });
    await run(page, 20100); let s = await state(page);
    ok(!s.big && scaleOf(s.tf) === 1 && s.h.join() === "breathIn", "Reduce Motion: the words stay still and breathIn is still sent (" + s.h.join() + ")");
    await run(page, 8000); s = await state(page);
    ok(!s.big && s.h.join() === "breathIn,breathOut", "Reduce Motion: breathOut is still sent");
    await ctx.close();
  }

  // 5. The browser app shows the words only: no iPhone, no haptic messages, the words still move.
  {
    const { page, ctx } = await open(browser, base, { ui: { breathe: "box" }, paused: true, native: false });
    await run(page, 20100); const s = await state(page);
    ok(s.box && s.big && s.h.length === 0, "browser: the words move and nothing is sent");
    await ctx.close();
  }

  // 6. Gentle is today's behavior; Off does nothing. An old true is Gentle, an old false is Off.
  for (const [val, gentle, name] of [["gentle", true, "Gentle"], [true, true, "an old on"], [undefined, true, "nothing stored"], ["off", false, "Off"], [false, false, "an old off"]]) {
    const { page, ctx } = await open(browser, base, { ui: val === undefined ? {} : { breathe: val }, paused: true });
    await run(page, 20100); const s = await state(page);
    ok(s.gentle === gentle && !s.box && s.h.length === 0, name + ": " + (gentle ? "the Gentle animation runs, no box, no haptic" : "nothing moves"));
    await ctx.close();
  }

  // 7. A visit records breath: 1 only if at least one full in-breath played.
  {
    const { page, ctx } = await open(browser, base, { ui: { breathe: "box" }, paused: true });
    await run(page, 23000);   // in-breath started at 20 s and has 1 s to go
    await page.keyboard.press("ArrowUp"); await run(page, 1000);
    await touch(page); await run(page, 24500);   // the next thought: 20 s, then a full 4 s in-breath
    await page.keyboard.press("ArrowUp"); await run(page, 1000);
    const r = await page.evaluate(() => ({ log: JSON.parse(localStorage.getItem("scales.next.log.v1") || "[]"), st: JSON.parse(localStorage.getItem("scales.next.thoughts.v1")) }));
    ok(r.log.length === 2, "visit: two visits were logged (" + r.log.length + ")");
    ok(r.log[0] && r.log[0].breath === undefined, "visit: a visit left before the first in-breath ended has no breath flag");
    ok(r.log[1] && r.log[1].breath === 1, "visit: a visit with a full in-breath carries breath: 1");
    const flagged = Object.values(r.st).flatMap((t) => t.visits || []).filter((v) => v.breath === 1).length;
    ok(flagged === 1, "visit: the thought's own visit list carries it too (" + flagged + ")");
    await ctx.close();
  }

  // 8. Settings: Off, Gentle, Box breathing as the Look pattern; 44 pt; old values carry over and nothing else is rewritten.
  for (const [val, want] of [[true, "gentle"], [false, "off"], [undefined, "gentle"], ["box", "box"]]) {
    const { page, ctx } = await open(browser, base, { ui: val === undefined ? {} : { breathe: val } });
    await page.evaluate(() => document.getElementById("stripOpen").click()); await page.waitForTimeout(400);
    await page.evaluate(() => document.getElementById("libGear").click()); await page.waitForTimeout(500);
    const marks = await page.$$eval("#breatheSeg [role=radio]", (bs) => bs.map((b) => b.dataset.breathe + ":" + b.getAttribute("aria-checked")));
    ok(marks.join() === ["off", "gentle", "box"].map((k) => k + ":" + (k === want)).join(), "settings: stored " + JSON.stringify(val) + " shows " + want + " chosen (" + marks.join(" ") + ")");
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("scales.next.ui.v1")));
    ok(val === undefined ? stored.breathe === undefined : stored.breathe === val, "settings: reading an old value does not rewrite it (" + JSON.stringify(stored.breathe) + ")");
    if (val === true) {
      ok(await page.locator("#breatheSeg").getAttribute("role") === "radiogroup" && /Breathing words/.test(await page.locator("#breatheSeg").getAttribute("aria-label")), "settings: a labelled radio group, as Look is");
      const hs = await page.$$eval("#breatheSeg [role=radio]", (bs) => bs.map((b) => { const r = b.getBoundingClientRect(), s = getComputedStyle(b, "::before"); return Math.max(r.height, parseFloat(s.height) || 0); }));
      ok(hs.every((h) => h >= 44), "settings: each word is at least 44 pt tall (" + hs.map((h) => Math.round(h)).join(", ") + ")");
      const before = stored;
      await page.evaluate(() => document.querySelector('#breatheSeg [data-breathe="box"]').click()); await page.waitForTimeout(200);
      const after = await page.evaluate(() => JSON.parse(localStorage.getItem("scales.next.ui.v1")));
      ok(after.breathe === "box", "settings: choosing Box breathing stores \"box\"");
      const other = Object.keys(before).filter((k) => k !== "breathe" && k !== "ms" && JSON.stringify(before[k]) !== JSON.stringify(after[k]));
      ok(other.length === 0, "settings: no other ui field changed (" + other.join(",") + ")");
      ok(await page.getAttribute('#breatheSeg [data-breathe="box"]', "aria-checked") === "true" && await page.getAttribute('#breatheSeg [data-breathe="gentle"]', "aria-checked") === "false", "settings: the chosen word is marked");
    }
    await ctx.close();
  }

  await browser.close(); server.close();
  console.log(fails ? fails + " FAILED" : "all passed");
  process.exit(fails ? 1 : 0);
})();
