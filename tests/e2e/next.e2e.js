// Browser check for the new Scales (next/): Playwright, Chromium, phone sizes.
// Run: node tests/e2e/next.e2e.js   (serves the repo on a local port; screenshots go to $SHOTS or ./next-shots)
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const root = path.join(__dirname, "..", "..");
const shots = process.env.SHOTS || path.join(root, "next-shots");
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
    await page.goto(base + "/next/");
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
    // pull down = put away + Undo
    await drag(220);
    const third = (await page.textContent("#words")).trim();
    ok(third !== second, tag + "pull down puts it away");
    ok(await page.locator("#toast.on").count() === 1, tag + "toast with Undo shows");
    await page.screenshot({ path: path.join(shots, w + "-2-putaway-toast.png") });
    await page.click("#toastUndo"); await page.waitForTimeout(500);
    ok((await page.textContent("#words")).trim() === second, tag + "Undo brings it back");
    // tap = edit
    await page.mouse.click(w / 2, 400); await page.waitForTimeout(700);
    ok(await page.locator("#vEdit").isVisible(), tag + "tap opens edit");
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
    // library
    await page.click("#strip"); await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(shots, w + "-6-library.png") });
    const lib = await page.textContent("#lib");
    ok(/brand new thought/.test(lib) && /A thought I lived/.test(lib), tag + "library lists new thought and put-away ones");
    await page.fill("#q", "lived"); await page.waitForTimeout(300);
    ok(!/Active thought number 1/.test(await page.textContent("#lib")) && /A thought I lived/.test(await page.textContent("#lib")), tag + "search filters");
    await page.click("#lib [data-back]"); await page.waitForTimeout(300);
    ok(!(await page.locator('#lib .lrow.away .back').count()), tag + "Bring back moves it into rotation");
    await page.screenshot({ path: path.join(shots, w + "-7-library-search.png") });
    const link = await page.getAttribute('#lib a[href^="../"]', "href");
    ok(link === "../", tag + "back link goes to ../ (" + link + ")");
    // old data untouched
    const after = await page.evaluate(() => localStorage.getItem("scales.thoughts.v1"));
    ok(JSON.stringify(JSON.parse(after)) === JSON.stringify(old), tag + "current app's data unchanged");
    ok(errs.length === 0, tag + "no console errors" + (errs.length ? ": " + errs.join(" | ") : ""));
    await ctx.close();
  }
  // native link keeps ?native=1 both ways
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(base + "/next/?native=1"); await page.waitForTimeout(500);
  const jf = await page.evaluate(() => localStorage.length);
  await page.evaluate(() => { localStorage.setItem("scales.next.thoughts.v1", JSON.stringify({ x: { id: "x", text: "hi", note: "", created: new Date().toISOString(), due: "2000-01-01", away: null, skips: 0, thinks: 0, works: 0, visits: [] } })); });
  await page.reload(); await page.waitForTimeout(500);
  await page.click("#strip"); await page.waitForTimeout(600);
  ok((await page.getAttribute('#lib a[href^="../"]', "href")) === "../?native=1", "native: back link keeps ?native=1");
  await page.goto(base + "/index.html"); await page.waitForTimeout(800);
  const h = await page.evaluate(() => document.getElementById("tryNext").getAttribute("href"));
  ok(h === "next/", "old app: web link is next/ (" + h + ")");
  await browser.close(); server.close();
  console.log(fails ? fails + " FAILED" : "ALL PASSED");
  process.exit(fails ? 1 : 0);
})();
