// Browser check for Scales: Playwright, Chromium, phone sizes.
// Run: node tests/e2e/app.e2e.js   (serves the repo on a local port; screenshots go to $SHOTS or ./e2e-shots)
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const root = path.join(__dirname, "..", "..");
const shots = process.env.SHOTS || path.join(root, "e2e-shots");
fs.mkdirSync(shots, { recursive: true });
const types = { ".html": "text/html", ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json" };
const server = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); s.end(fs.readFileSync(f));
});

const old = {};
for (let i = 1; i <= 8; i++) old["a" + i] = { id: "a" + i, text: "Active thought number " + i, status: "active", skip_count: i === 3 ? 4 : 0, created_at: "2026-09-0" + i + "T00:00:00Z" };
old.s1 = { id: "s1", text: "A thought I lived", status: "shed", shed_at: "2026-09-20T00:00:00Z" };
old.l1 = { id: "l1", text: "A thought I let go", status: "letgo", letgo_at: "2026-09-21T00:00:00Z" };

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch();
  for (const w of [390, 375, 430]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    await page.addInitScript((o) => { if (!localStorage.getItem("scales.thoughts.v1") && !sessionStorage.getItem("seeded")) { localStorage.setItem("scales.thoughts.v1", JSON.stringify(o)); sessionStorage.setItem("seeded", "1"); } }, old);
    const tag = "[" + w + "] ";
    await page.goto(base + "/");
    await page.waitForSelector("#words:not(:empty)");
    const first = (await page.textContent("#words")).trim();
    ok(first === "Active thought number 3", tag + "most skipped thought comes first (" + first + ")");
    await page.screenshot({ path: path.join(shots, w + "-1-meet.png") });
    ok(/10\s*$/.test(await page.textContent("#strip")), tag + "strip shows the count of all 10 imported thoughts");

    const drag = async (dy) => {
      const b = await page.locator("#stage").boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
      await page.mouse.move(x, y); await page.mouse.down();
      for (let i = 1; i <= 12; i++) await page.mouse.move(x, y + (dy * i) / 12);
      await page.mouse.up(); await page.waitForTimeout(700);
    };
    // short pull springs back
    await drag(-50);
    ok((await page.textContent("#words")).trim() === first, tag + "short swipe springs back");
    // swipe up = next
    await drag(-160);
    const second = (await page.textContent("#words")).trim();
    ok(second !== first, tag + "swipe up moves to the next thought (" + second + ")");
    // swipe up shows Undo, and Undo brings the thought back
    ok(await page.locator("#toast.on").count() === 1 && /Moved on/.test(await page.textContent("#toast")), tag + "Moved on toast shows after swipe up");
    await page.click("#toastUndo"); await page.waitForTimeout(500);
    ok((await page.textContent("#words")).trim() === first, tag + "Undo after swipe up brings the thought back");
    await drag(-160);
    // pull down = put away + Undo
    await drag(220);
    const third = (await page.textContent("#words")).trim();
    ok(third !== second, tag + "pull down puts it away");
    ok(await page.locator("#toast.on").count() === 1, tag + "toast with Undo shows");
    await page.screenshot({ path: path.join(shots, w + "-2-putaway-toast.png") });
    await page.click("#toastUndo"); await page.waitForTimeout(500);
    ok((await page.textContent("#words")).trim() === second, tag + "Undo brings it back");
    // a near miss on + New never opens Edit
    await page.mouse.click(165, 90); await page.waitForTimeout(700);
    ok(!(await page.locator("#vEdit").isVisible()), tag + "a tap just right of + New does not open Edit");
    if (await page.locator("#vWrite").isVisible()) { await page.click("#writeCancel"); await page.waitForTimeout(500); }
    // a swipe up that starts on the Home bar does not drag the sheet
    await page.mouse.move(w / 2, 840); await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(w / 2, 840 - i * 40);
    await page.mouse.up(); await page.waitForTimeout(600);
    ok(await page.locator("#lib.open").count() === 0, tag + "a swipe from the Home bar leaves the library shut");
    // tap = edit
    await page.mouse.click(w / 2, 400); await page.waitForTimeout(700);
    ok(await page.locator("#vEdit").isVisible(), tag + "tap opens edit");
    await page.click("#editDelete");
    ok((await page.textContent("#editDelete")).trim() === "Tap again to delete", tag + "Delete asks for a second tap");
    await page.mouse.click(w / 2, 700); await page.waitForTimeout(100);
    ok((await page.textContent("#editDelete")).trim() === "Delete", tag + "tapping elsewhere takes Delete back");
    await page.fill("#editNote", "A note from the test");
    await page.screenshot({ path: path.join(shots, w + "-3-edit.png") });
    await page.click("#editDone"); await page.waitForTimeout(700);
    ok(await page.locator("#vMeet").isVisible(), tag + "Done returns to the thought");
    // write
    await page.click("#newBtn"); await page.waitForTimeout(700);
    ok(await page.locator("#vWrite").isVisible(), tag + "New opens write");
    await page.fill("#writeText", "A brand new thought from the check");
    await page.screenshot({ path: path.join(shots, w + "-4-write.png") });
    await page.click("#writeKeep"); await page.waitForTimeout(500);
    ok(await page.locator("#writeKept").isVisible(), tag + "Kept message shows");
    await page.screenshot({ path: path.join(shots, w + "-5-kept.png") });
    await page.waitForTimeout(2200);
    ok(await page.locator("#vMeet").isVisible(), tag + "back on the thought after Keep");
    // library: pull the strip up to open it, pull the header down to shut it
    const sb = await page.locator("#strip").boundingBox();
    await page.mouse.move(w / 2, sb.y + 30); await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(w / 2, sb.y + 30 - i * 40);
    await page.mouse.up(); await page.waitForTimeout(600);
    ok(await page.locator("#lib.open").count() === 1, tag + "pulling the strip up opens the library");
    const hb = await page.locator("#lib h2").boundingBox();
    await page.mouse.move(w / 2, hb.y + 5); await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(w / 2, hb.y + 5 + i * 30);
    await page.mouse.up(); await page.waitForTimeout(600);
    ok(await page.locator("#lib.open").count() === 0, tag + "pulling the sheet down shuts it");
    await page.mouse.move(w / 2, sb.y + 30); await page.mouse.down();
    for (let i = 1; i <= 3; i++) { await page.mouse.move(w / 2, sb.y + 30 - i * 15); await page.waitForTimeout(60); }
    await page.mouse.up(); await page.waitForTimeout(600);
    ok(await page.locator("#lib.open").count() === 0, tag + "a short pull springs back shut");
    await page.click("#strip"); await page.waitForTimeout(700);
    ok(await page.locator("#lib.open").count() === 1, tag + "tapping the strip opens the library");
    await page.click('#seg [data-view="away"]'); await page.waitForTimeout(200);
    ok(!/In rotation ·/.test(await page.textContent("#libList")) && /Put away ·/.test(await page.textContent("#libList")), tag + "Put away filter shows only put away");
    await page.screenshot({ path: path.join(shots, w + "-6b-library-away.png") });
    await page.click('#seg [data-view="on"]'); await page.waitForTimeout(200);
    ok(/In rotation ·/.test(await page.textContent("#libList")) && !/Put away ·/.test(await page.textContent("#libList")), tag + "In rotation filter shows only rotation");
    await page.click('#seg [data-view="all"]'); await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(shots, w + "-6-library.png") });
    const lib = await page.textContent("#lib");
    ok(/brand new thought/.test(lib) && /A thought I lived/.test(lib), tag + "library lists new thought and put-away ones");
    await page.fill("#q", "lived"); await page.waitForTimeout(300);
    ok(!/Active thought number 1/.test(await page.textContent("#lib")) && /A thought I lived/.test(await page.textContent("#lib")), tag + "search filters");
    await page.click("#lib [data-back]"); await page.waitForTimeout(300);
    ok(!(await page.locator('#lib .lrow.away .back').count()), tag + "Bring back moves it into rotation");
    await page.screenshot({ path: path.join(shots, w + "-7-library-search.png") });
    // old data untouched
    const after = await page.evaluate(() => localStorage.getItem("scales.thoughts.v1"));
    ok(JSON.stringify(JSON.parse(after)) === JSON.stringify(old), tag + "Scales 1's data unchanged");
    ok(errs.length === 0, tag + "no console errors" + (errs.length ? ": " + errs.join(" | ") : ""));
    await ctx.close();
  }
  // the iPhone app's bridge: ready, quiet reminders, daily save with the old data, and the put away buzz
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.addInitScript((o) => {
      window.__posts = [];
      window.webkit = { messageHandlers: { scales: { postMessage: (m) => window.__posts.push(m) } } };
      if (!sessionStorage.getItem("s")) { localStorage.setItem("scales.thoughts.v1", JSON.stringify(o)); sessionStorage.setItem("s", "1"); }
    }, old);
    await page.goto(base + "/?native=1"); await page.waitForTimeout(2000);
    const types = await page.evaluate(() => window.__posts.map((m) => m.type));
    ok(["ready", "unschedule", "badge", "save"].every((t) => types.includes(t)), "native: ready, unschedule, badge and save sent (" + types.join(",") + ")");
    const saved = await page.evaluate(() => JSON.parse(window.__posts.find((m) => m.type === "save").json));
    ok(saved.scales1 && saved.scales1["scales.thoughts.v1"] && Object.keys(saved.thoughts).length === 10, "native: daily save carries both apps' thoughts");
    await page.keyboard.press("ArrowUp"); await page.waitForTimeout(500);
    const lg = await page.evaluate(() => JSON.parse(localStorage.getItem("scales.next.log.v1") || "[]"));
    ok(lg.length === 1 && lg[0].how === "next" && typeof lg[0].ms === "number" && lg[0].lines.length === 2, "visit log records the move with its raw time");
    await page.evaluate(() => { window.__posts.length = 0; });
    await page.keyboard.press("ArrowDown"); await page.waitForTimeout(400);
    const hs = await page.evaluate(() => window.__posts.filter((m) => m.type === "haptic").map((m) => m.style));
    ok(hs.join(",") === "thud,letgo", "native: put away buzzes thud then letgo (" + hs.join(",") + ")");
    await ctx.close();
  }
  // the trial address forwards home and keeps ?native=1
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(base + "/next/?native=1"); await page.waitForTimeout(800);
    ok(new URL(page.url()).pathname === "/" && new URL(page.url()).search === "?native=1", "/next/ forwards to / with ?native=1 (" + page.url() + ")");
    await ctx.close();
  }
  await browser.close(); server.close();
  console.log(fails ? fails + " FAILED" : "ALL PASSED");
  process.exit(fails ? 1 : 0);
})();
