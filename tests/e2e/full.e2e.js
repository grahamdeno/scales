// Browser check for Scales Full (2.36.0): 14 days of everything, then making new Argue, Tensions, Themes and Your week
// is Scales Full ($6.99, once); what is already made stays readable; unknown never locks; buying and restoring.
// Run: node tests/e2e/full.e2e.js   (a stand-in plays the iPhone app's Apple Intelligence and StoreKit answers)
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

// full: what the stand-in tells the page about Scales Full. reply: what a buy or restore answers.
async function open(browser, base, full, opts) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
  await page.addInitScript((o) => {
    window.scalesNative = { build: "70" }; window.__ai = []; window.__sent = [];
    window.webkit = { messageHandlers: { scales: { postMessage: (m) => {
      window.__sent.push(m.type);
      if (m.type === "aiStatus") setTimeout(() => window.scalesAI("available"), 20);
      if (m.type === "full" && o.full) setTimeout(() => window.scalesFull(JSON.stringify(o.full)), 20);
      if ((m.type === "fullBuy" || m.type === "fullRestore") && o.reply) setTimeout(() => window.scalesFull(JSON.stringify(o.reply[m.type])), 40);
      if (m.type === "ai") { window.__ai.push(m.instructions.slice(0, 30));
        const ans = /^You compare two thoughts/.test(m.instructions) ? "C" : /test a thought/.test(m.instructions) ? "AGAINST: Holding to every decision can be stubbornness, not resolve.\nASSUMES: that what you decided then is still true." : "2 | 4 | work against rest";
        setTimeout(() => window.scalesAIResult(m.id, ans, ""), 40); }
    } } } };
    if (!sessionStorage.getItem("s")) { localStorage.clear(); localStorage.setItem("scales.next.thoughts.v1", JSON.stringify(o.st)); localStorage.setItem("scales.next.ui.v1", JSON.stringify({ nudged: true, fullNoted: o.noted ? 1 : 0, cur: "k0" })); sessionStorage.setItem("s", "1"); }
  }, { st: thoughts, full, reply: opts && opts.reply, noted: !(opts && opts.notice) });
  await page.goto(base + "/?native=1"); await page.waitForTimeout(300);
  return { page, errs, ctx };
}

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch();

  // 1. Day 30, not owned: locked. Nothing new is made; the card opens instead.
  {
    const { page, errs, ctx } = await open(browser, base, { owned: false, since: ago(30), price: "$6.99", found: true });
    await page.waitForTimeout(5200);
    ok((await page.evaluate(() => window.__ai.length)) === 0, "locked: Tensions makes no request to the model");
    await page.click("#words"); await page.waitForTimeout(600);
    await page.click("#argBtn"); await page.waitForTimeout(500);
    ok(await page.locator("#fullPage.open").count() === 1 && (await page.evaluate(() => window.__ai.length)) === 0, "locked: Argue with it opens the Scales Full card and asks the model nothing");
    ok(/14 free days are over/.test(await page.textContent("#fullLead")) && /still here/.test(await page.textContent("#fullLead")) && /\$6\.99, once/.test(await page.textContent("#fullLead")), "locked: the card says the days are over, nothing is lost, and $6.99 once");
    ok(/Unlock Scales Full/.test(await page.textContent("#fullBuyL")) && /\$6\.99/.test(await page.textContent("#fullBuyV")), "the buy row shows the price Apple gave");
    await page.click("#fullBack"); await page.waitForTimeout(400);
    ok(await page.locator("#fullPage.open").count() === 0 && await page.locator("#argBtn").isVisible(), "Back returns to Edit");
    // an argument already made stays readable
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("scales.next.thoughts.v1")); const t = s.k0; t.arg = { text: t.text, against: "Holding to every decision can be stubbornness.", assumes: "That you decided well.", free: "change your mind", at: new Date().toISOString() }; localStorage.setItem("scales.next.thoughts.v1", JSON.stringify(s)); });
    await page.reload(); await page.waitForTimeout(500); await page.click("#words"); await page.waitForTimeout(600); await page.click("#argBtn"); await page.waitForTimeout(500);
    ok(await page.locator("#argPage.open").count() === 1 && /stubbornness/.test(await page.textContent("#apAgainst")), "locked: a kept argument still opens and reads");
    ok(/part of Scales Full/.test(await page.textContent("#apFor")), "locked: the case for, not yet made, says it is part of Scales Full");
    await page.click("#argBack"); await page.waitForTimeout(300); await page.click("#editCancel").catch(() => {}); await page.waitForTimeout(300);
    // themes and the week
    await page.evaluate(() => { document.querySelectorAll(".page.open").forEach((p) => p.classList.remove("open")); });
    await page.goto(base + "/?native=1"); await page.waitForTimeout(500);
    await page.evaluate(() => { document.getElementById("setAI").click(); });
    await page.waitForTimeout(400);
    await page.evaluate(() => document.getElementById("aiRun").click()); await page.waitForTimeout(400);
    ok(await page.locator("#fullPage.open").count() === 1 && (await page.evaluate(() => window.__ai.length)) === 0, "locked: Find themes opens the card and asks the model nothing");
    await page.click("#fullBack"); await page.waitForTimeout(300);
    ok(/Trial ended/.test(await page.textContent("#setFullV")), "Settings says the trial ended");
    ok(errs.length === 0, "locked: no page errors" + (errs[0] ? ": " + errs[0] : "")); await ctx.close();
  }

  // 2. Day 3: everything works, and nothing is shown that asks for money
  {
    const { page, errs, ctx } = await open(browser, base, { owned: false, since: ago(3), price: "$6.99", found: true });
    await page.waitForTimeout(5200);
    ok((await page.evaluate(() => window.__ai.length)) > 0, "trial: Tensions runs");
    await page.click("#words"); await page.waitForTimeout(600); await page.click("#argBtn"); await page.waitForTimeout(700);
    ok(await page.locator("#argPage.open").count() === 1 && /stubbornness/.test(await page.textContent("#apAgainst")), "trial: Argue with it works");
    ok(await page.locator("#fullPage.open").count() === 0, "trial: no card in the way");
    ok(errs.length === 0, "trial: no page errors"); await ctx.close();
  }

  // 3. Nothing answered, or no date: never locked
  {
    const { page, errs, ctx } = await open(browser, base, null);
    await page.waitForTimeout(5200);
    ok((await page.evaluate(() => window.__ai.length)) > 0, "unknown: Tensions still runs when Apple has not answered");
    await page.click("#words"); await page.waitForTimeout(600); await page.click("#argBtn"); await page.waitForTimeout(700);
    ok(await page.locator("#argPage.open").count() === 1, "unknown: Argue with it still works");
    ok(errs.length === 0, "unknown: no page errors"); await ctx.close();
  }

  // 4. Buy and restore
  {
    const { page, errs, ctx } = await open(browser, base, { owned: false, since: ago(30), price: "$6.99", found: true },
      { reply: { fullBuy: { owned: true, since: ago(30), price: "$6.99", found: true }, fullRestore: { owned: false, since: ago(30), price: "$6.99", found: true, note: "No purchase of Scales Full was found on this Apple Account." } } });
    await page.waitForTimeout(400);
    await page.evaluate(() => document.getElementById("libGear") && 0);
    await page.click("#strip").catch(() => {}); await page.waitForTimeout(300);
    await page.evaluate(() => { const l = document.getElementById("lib"); });
    // reach Settings the way a person does
    await page.evaluate(() => document.getElementById("setFull").click()); await page.waitForTimeout(300);
    await page.click("#fullRestore"); await page.waitForTimeout(500);
    ok(/No purchase of Scales Full was found/.test(await page.textContent("#fullNote")) && !(await page.evaluate(() => document.getElementById("fullBuy").hidden)), "restore with no purchase says so and leaves the card as it was");
    await page.click("#fullBuy"); await page.waitForTimeout(500);
    ok((await page.evaluate(() => window.__sent)).includes("fullBuy"), "Unlock sends one buy request to the app");
    ok(/yours, for good/.test(await page.textContent("#fullLead")) && await page.evaluate(() => document.getElementById("fullBuy").hidden), "after buying, the card says it is yours and the buy row goes");
    await page.click("#fullBack"); await page.waitForTimeout(300);
    ok(/Yours for good/.test(await page.textContent("#setFullV")), "Settings says Yours for good");
    await page.waitForTimeout(1800);
    const ev = await page.evaluate(() => JSON.parse(localStorage.getItem("scales.next.events.v1") || "[]").filter((e) => e.e === "full"));
    ok(ev.length >= 3 && ev.every((e) => Object.keys(e).every((k) => ["t", "e", "s", "at", "st", "did"].includes(k))), "the event log holds only names and states for Scales Full: " + JSON.stringify(ev.slice(0, 3)));
    ok(errs.length === 0, "buy: no page errors" + (errs[0] ? ": " + errs[0] : "")); await ctx.close();
  }

  // 5. Two days left: the card opens once, by itself
  {
    const { page, errs, ctx } = await open(browser, base, { owned: false, since: ago(12.5), price: "$6.99", found: true }, { notice: true });
    await page.waitForTimeout(3500);
    ok(await page.locator("#fullPage.open").count() === 1 && /days? of everything/.test(await page.textContent("#fullLead")) && /Nothing renews/.test(await page.textContent("#fullLead")), "two days left: the card opens once and says nothing renews");
    await page.click("#fullBack"); await page.waitForTimeout(300); await page.reload(); await page.waitForTimeout(3500);
    ok(await page.locator("#fullPage.open").count() === 0, "and not again on the next open");
    ok(errs.length === 0, "notice: no page errors"); await ctx.close();
  }

  // 6. The browser app has none of it
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage();
    await page.goto(base + "/"); await page.waitForTimeout(500);
    ok(await page.evaluate(() => document.getElementById("fullSec").hidden), "browser: no Scales Full row (the browser app is a free demo)");
    await ctx.close();
  }

  await browser.close(); server.close();
  console.log(fails ? fails + " failed" : "all passed"); process.exit(fails ? 1 : 0);
})();
