// Browser check for onboarding (2.30.0): the first screen, the set offer, and the one-time hints.
// Run: node tests/e2e/onboarding.e2e.js   (hints are off in automated browsers unless the address has ?tips=1)
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const root = path.join(__dirname, "..", "..");
const shots = process.env.SHOTS || path.join(root, "e2e-shots"); fs.mkdirSync(shots, { recursive: true });
const types = { ".html": "text/html", ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".png": "image/png", ".woff2": "font/woff2" };
const server = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); s.end(fs.readFileSync(f));
});
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    window.scalesNative = { build: "49" };
    window.webkit = { messageHandlers: { scales: { postMessage: (m) => {
      if (m.type === "aiStatus") setTimeout(() => window.scalesAI("available"), 30);
      if (m.type === "ai") setTimeout(() => window.scalesAIResult(m.id, /test a thought/.test(m.instructions) ? "AGAINST: x.\nASSUMES: y." : "NONE", ""), 40);
    } } } };
  });
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(base + "/?native=1&tips=1"); await wait(1200);

  // The first screen
  ok(await page.isVisible("#writeHead") && (await page.textContent("#writeHead")) === "What's on your mind?", "first screen: a heading says what to do");
  ok(await page.evaluate(() => document.getElementById("writeText").classList.contains("example")), "first screen: the example is the lighter hint");
  ok(await page.isVisible("#startFive") && /lines worth keeping/.test(await page.textContent("#startFive")) && /Stoics, Franklin/.test(await page.textContent("#startFive")), "first screen: the set is a clear second choice that says what it is");
  await page.screenshot({ path: path.join(shots, "onb-1-first.png") });

  // Write one: the set offer follows
  await page.fill("#writeText", "Patience over speed."); await page.click("#writeKeep"); await wait(3300);
  ok(await page.isVisible("#setOffer") && (await page.locator("#setOfferSets [data-offer]").count()) === 2, "after the first thought: two sets are offered");
  await page.screenshot({ path: path.join(shots, "onb-2-offer.png") });
  await page.click('#setOfferSets [data-offer="stoics"]'); await wait(700);
  const n = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("scales.next.thoughts.v1"))).filter((k) => k.indexOf("s-") === 0).length);
  ok(!(await page.isVisible("#setOffer")) && n >= 10, "taking a set adds its lines and the offer goes (" + n + ")");
  ok(/The Stoics: \d+ lines added/.test(await page.textContent("#toastMsg")), "and says what was added");

  // The tap-to-edit spotlight after the third card
  for (let i = 0; i < 3; i++) { await page.$eval("#srNext", (e) => e.click()); await wait(900); }
  await wait(1400);
  ok(await page.isVisible("#tip") && /Tap a thought to edit/.test(await page.textContent("#tipText")), "after the third card: the thought is spotlighted with tap to edit");
  await page.screenshot({ path: path.join(shots, "onb-3-spot-edit.png") });
  await page.click("#tip"); await wait(300);
  ok(!(await page.isVisible("#tip")), "a tap anywhere dismisses it");
  const t1 = await page.evaluate(() => JSON.parse(localStorage.getItem("scales.next.ui.v1")).tips);
  ok(t1 && t1.edit === 1, "and it is remembered, so it never shows again");

  // One at a time, chained: doing what the last spotlight pointed at (opening Edit) lets the next one show
  await page.$eval("#srEdit", (e) => e.click()); await wait(1100);
  ok(await page.isVisible("#tip") && /Argue with it/.test(await page.textContent("#tipText")), "opening Edit after the edit hint: Argue with it is spotlighted next");
  await page.screenshot({ path: path.join(shots, "onb-4-spot-argue.png") });
  await page.click("#tip"); await page.click("#editCancel"); await wait(400);
  // But never two in a row without the person acting: dismissing Argue without using it holds the next one
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem("scales.next.ui.v1")).tips.argue === 1), "Argue with it is remembered");

  // Swipe hint the first time a page slides in
  await page.click("#strip"); await wait(800); await page.click("#libGear"); await wait(400);
  ok(await page.locator("#settings .swipehint").count() === 1, "the first page that slides in says Swipe right to go back");
  await page.screenshot({ path: path.join(shots, "onb-5-swipe.png") });
  await wait(4000); await page.click("#setBack"); await wait(500); await page.click("#libGear"); await wait(400);
  ok(await page.locator("#settings .swipehint").count() === 0, "and only once");

  // Help, Show the tips again
  await page.click("#setHelp"); await wait(500); await page.click("#tipsAgain"); await wait(200);
  ok(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("scales.next.ui.v1")).tips || {}).length === 0), "Show the tips again clears every hint");
  await page.screenshot({ path: path.join(shots, "onb-6-help.png") });

  // Hints are off in automated browsers without ?tips=1
  const p2 = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await p2.goto(base + "/"); await wait(1000); await p2.fill("#writeText", "One."); await p2.click("#writeKeep"); await wait(3300);
  ok(!(await p2.isVisible("#setOffer")), "automated browsers without ?tips=1 see no offer or hints");

  ok(errs.length === 0, "no page errors" + (errs.length ? ": " + errs[0] : ""));
  await browser.close(); server.close();
  console.log(fails ? fails + " failed" : "all passed"); process.exit(fails ? 1 : 0);
})();
