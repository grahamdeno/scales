// Makes the website's screenshots from the real app: node scripts/site-shots.js   (needs Playwright)
// Writes site/img/shot-meet.png, shot-pull.png and shot-library.png at 390 x 844, scale 3.
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
// A Scales day starts at 4 AM.
const dk = (d) => { const x = new Date(d.getTime() - 4 * 3600000); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
const plus = (n) => { const d = new Date(Date.now() - 4 * 3600000); d.setDate(d.getDate() + n); return dk(new Date(d.getTime() + 4 * 3600000)); };
const mk = (id, text, o) => Object.assign({ id, text, note: "", created: "2026-10-01T09:00:00.000Z", due: plus(0), away: null, skips: 0, thinks: 0, works: 0, seen: null, visits: [] }, o);
const store = {};
[
  mk("a", "Most problems are smaller than the dread before them.", { skips: 3, due: plus(0) }),
  mk("b", "I am not my first reaction.", { due: plus(0) }),
  mk("c", "Rest is part of the work.", { due: plus(1) }),
  mk("d", "Say the hard thing early, while it is still small.", { skips: 2, due: plus(1) }),
  mk("e", "Finish the day before starting the next one.", { due: plus(3) }),
  mk("f", "Be present, need little.", { away: "2026-10-20T09:00:00.000Z" }),
  mk("g", "Ask one more question than feels polite.", { away: "2026-10-18T09:00:00.000Z" })
].forEach((t) => { store[t.id] = t; });

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript((s) => { localStorage.setItem("scales.next.thoughts.v1", JSON.stringify(s)); localStorage.setItem("scales.next.ui.v1", JSON.stringify({ cur: "a", ms: 0, worked: false, nudged: true, view: "all" })); }, store);
  await page.goto(base + "/");
  await page.waitForSelector("#words:not(:empty)"); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(900);
  const out = path.join(root, "site", "img");
  await page.screenshot({ path: path.join(out, "shot-meet.png") });
  // mid pull-down, the "Put away" hint showing
  const x = 195, y = 380;
  await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(x, y + 12 * i);
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(out, "shot-pull.png") });
  await page.mouse.up(); await page.waitForTimeout(700);
  // the library, open
  await page.evaluate(() => document.getElementById("strip").click()); await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, "shot-library.png") });
  await browser.close(); server.close();
  console.log("wrote shot-meet.png, shot-pull.png, shot-library.png");
})();
