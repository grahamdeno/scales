// Makes the App Store screenshots from the real app: node scripts/store-shots.js   (needs Playwright)
// The status bar is ink on the pistachio top and bone on plum; the Home bar sits on plum, so it is always bone.
// iPhone 6.9 inch, 1320 x 2868 (440 x 956 at scale 3), written to store/. Chromium has no notch, so the page's safe-area
// variables are set to an iPhone's (top 62, bottom 34) and a status bar is drawn on top of the screenshot only.
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const root = path.join(__dirname, "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/json" };
const server = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); s.end(fs.readFileSync(f));
});
const dk = (d) => { const x = new Date(d.getTime() - 4 * 3600000); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
const plus = (n) => { const d = new Date(Date.now() - 4 * 3600000); d.setDate(d.getDate() + n); return dk(new Date(d.getTime() + 4 * 3600000)); };
const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();
const mk = (id, text, o) => Object.assign({ id, text, note: "", created: iso(40), due: plus(0), away: null, bookmarked: null, skips: 0, thinks: 0, works: 0, seen: null, visits: [] }, o);
const store = {};
[
  mk("a", "Most problems are smaller than the dread before them.", { skips: 3, due: plus(0), created: iso(30), bookmarked: iso(2) }),
  mk("b", "I am not my first reaction.", { due: plus(0), created: iso(21), bookmarked: iso(6) }),
  mk("c", "Rest is part of the work.", { due: plus(1), created: iso(9) }),
  mk("d", "Say the hard thing early, while it is still small.", { skips: 2, due: plus(1), created: iso(3) }),
  mk("e", "Finish the day before starting the next one.", { due: plus(3), created: iso(1) }),
  mk("f", "Be present, need little.", { away: iso(10), created: iso(50) }),
  mk("g", "Ask one more question than feels polite.", { away: iso(12), created: iso(45) })
].forEach((t) => { store[t.id] = t; });

const W = 440, H = 956, out = path.join(root, "store");
const bar = (dark) => `<div id="__sb" style="position:fixed;left:0;right:0;top:0;height:62px;z-index:99999;pointer-events:none;font:600 16px -apple-system,system-ui,sans-serif;color:${dark ? "#F1E9D8" : "#2A1E2E"}">
  <span style="position:absolute;left:44px;top:20px">9:41</span>
  <span style="position:absolute;left:50%;top:11px;width:122px;height:36px;margin-left:-61px;border-radius:20px;background:#000"></span>
  <svg style="position:absolute;right:30px;top:23px" width="66" height="14" viewBox="0 0 66 14" fill="currentColor"><rect x="0" y="9" width="3" height="5" rx="1"/><rect x="5" y="6" width="3" height="8" rx="1"/><rect x="10" y="3" width="3" height="11" rx="1"/><rect x="15" y="0" width="3" height="14" rx="1"/><path d="M27 3.2c3-2.6 7.6-2.6 10.6 0l-1.5 1.7c-2.1-1.7-5.5-1.7-7.6 0zM29.4 6.8c1.7-1.4 4.1-1.4 5.8 0l-1.6 1.8c-.8-.6-1.8-.6-2.6 0zM31.3 10.2l1.9 2.1 1.9-2.1c-1-.9-2.8-.9-3.8 0z"/><rect x="44" y="1" width="21" height="12" rx="3.5" fill="none" stroke="currentColor" stroke-opacity=".4"/><rect x="46" y="3" width="14" height="8" rx="2"/></svg></div>`;
const home = () => `<div id="__hb" style="position:fixed;left:50%;bottom:8px;width:140px;height:5px;margin-left:-70px;border-radius:3px;z-index:99999;pointer-events:none;background:#F1E9D8"></div>`;

(async () => {
  fs.mkdirSync(out, { recursive: true });
  await new Promise((r) => server.listen(0, r));
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 3, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript((s) => {
    localStorage.setItem("scales.next.thoughts.v1", JSON.stringify(s));
    localStorage.setItem("scales.next.ui.v1", JSON.stringify({ cur: "a", ms: 0, worked: false, nudged: true, view: "all" }));
    document.addEventListener("DOMContentLoaded", () => { document.documentElement.style.setProperty("--top", "62px"); document.documentElement.style.setProperty("--bot", "34px"); });
  }, store);
  await page.goto(base + "/");
  await page.waitForSelector("#words:not(:empty)"); await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: ":root{--top:62px !important;--bot:34px !important}" }); await page.waitForTimeout(900);
  const decorate = (dark) => page.evaluate(([b, h]) => { document.querySelectorAll("#__sb,#__hb").forEach((e) => e.remove()); document.body.insertAdjacentHTML("beforeend", b + h); }, [bar(dark), home()]);
  const shot = async (name, dark) => { await decorate(dark); await page.waitForTimeout(150); await page.screenshot({ path: path.join(out, name) }); console.log("wrote", name); };

  await shot("1-meet.png", false);
  const x = 220, y = 440; // mid pull-down, the Put away hint showing
  await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 1; i <= 13; i++) await page.mouse.move(x, y + 12 * i);
  await page.waitForTimeout(250); await shot("2-put-away.png", false);
  await page.mouse.up(); await page.waitForTimeout(800);
  await page.evaluate(() => document.getElementById("strip").click()); await page.waitForTimeout(800);
  await shot("3-library.png", false);
  await page.evaluate(() => { const g = document.getElementById("seg"); g.scrollLeft = g.scrollWidth; }); await page.click("#segMarked"); await page.waitForTimeout(300);
  await shot("4-bookmarked.png", false);
  await page.click("#libGear"); await page.waitForTimeout(700);
  await page.evaluate(() => { document.getElementById("iconSec").hidden = false; }); await page.waitForTimeout(200);
  await shot("5-settings.png", true);
  await browser.close(); server.close();
})();
