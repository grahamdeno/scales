// Browser check for the 18 November 2026 audit fixes (2.37.0, App Store 1.1). Each check names its finding (G-n).
// Run: node tests/e2e/audit.e2e.js   (a stand-in plays the iPhone app where a finding is about the app)
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const root = path.join(__dirname, "..", "..");
const shots = process.env.SHOTS || path.join(root, "e2e-shots");
fs.mkdirSync(shots, { recursive: true });
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
const texts = ["Decide to do what you should, then do what you decided.", "Don't waste time.", "Very little is needed to live a happy life.", "Rest is part of the work.", "Speak only what may be heard twice.", "Begin before you are ready."];
function seed(extra) {
  const t = {}; texts.forEach((x, i) => { t["k" + i] = { id: "k" + i, text: x, by: "", note: "", created: ago(3), due: day, away: null, skips: 0, thinks: 0, works: 0, seen: ago(2), visits: [] }; });
  t.p1 = { id: "p1", text: "A long put-away thought that runs well past one line so it would be cut off in the list row.", by: "", note: "", created: ago(20), due: day, away: ago(1), skips: 0, thinks: 0, works: 0, seen: ago(1), visits: [] };
  return Object.assign(t, extra || {});
}
// native: a stand-in for the iPhone app (o.vo: VoiceOver on; o.ts: text scale; o.saved: the last automatic copy).
async function open(browser, base, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: { width: o.w || 375, height: 812 }, hasTouch: true });
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
  await page.addInitScript((o) => {
    window.__sent = [];
    if (o.native) {
      window.scalesNative = { build: "63", appVersion: "1.1", textScale: o.ts || 1 };
      window.webkit = { messageHandlers: { scales: { postMessage: (m) => {
        window.__sent.push(m);
        if (m.type === "ready" && o.vo) setTimeout(() => window.scalesA11y({ voiceOver: true }), 10);
        if (m.type === "aiStatus") setTimeout(() => window.scalesAI(o.ai || "available"), 20);
        if (m.type === "full") setTimeout(() => window.scalesFull(JSON.stringify(o.full || { owned: false, since: new Date(Date.now() - 3 * 86400000).toISOString(), price: "$6.99", found: true })), 20);
      } } } };
    } else if (o.ts) { window.scalesNative = undefined; }
    if (!sessionStorage.getItem("s")) {
      localStorage.clear(); localStorage.setItem("scales.next.thoughts.v1", JSON.stringify(o.st));
      localStorage.setItem("scales.next.ui.v1", JSON.stringify(Object.assign({ nudged: true, cur: "k0", learnedUp: true, learnedDown: true, fullNoted: 1 }, o.ui || {})));
      sessionStorage.setItem("s", "1");
    }
  }, Object.assign({ st: seed(o.extra) }, o));
  await page.goto(base + (o.native ? "/?native=1" : "/")); await page.waitForTimeout(400);
  if (o.ts && !o.native) await page.evaluate((x) => window.scalesTextScale(x), o.ts);
  return { page, errs, ctx };
}
const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("scales.next.thoughts.v1")));

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch();

  // G-4: Cancel keeps typed words for a moment, with Undo
  {
    const { page, errs, ctx } = await open(browser, base);
    await page.click("#stripNew"); await page.waitForTimeout(400);
    await page.fill("#writeText", "Half a thought I meant to keep"); await page.click("#writeCancel"); await page.waitForTimeout(400);
    ok(/Not kept/.test(await page.textContent("#toastMsg")) && await page.locator("#toastUndo").isVisible(), "G-4 Write: Cancel with words says Not kept, with Undo");
    await page.click("#toastUndo"); await page.waitForTimeout(500);
    ok(await page.locator("#vWrite").isVisible() && (await page.inputValue("#writeText")) === "Half a thought I meant to keep", "G-4 Write: Undo brings the words back");
    await page.fill("#writeText", ""); await page.click("#writeCancel"); await page.waitForTimeout(400);
    ok(!(await page.locator("#toast.on").count()), "G-4 Write: an empty Cancel says nothing");
    await page.click("#words"); await page.waitForTimeout(600);
    const was = await page.inputValue("#editText");
    await page.fill("#editText", was + " And more."); await page.click("#editCancel"); await page.waitForTimeout(500);
    ok(/Not kept/.test(await page.textContent("#toastMsg")) && (await store(page)).k0.text === was, "G-4 Edit: Cancel with changes keeps nothing yet, and offers Undo");
    await page.click("#toastUndo"); await page.waitForTimeout(600);
    ok(await page.locator("#vEdit.up").count() === 1 && (await page.inputValue("#editText")) === was + " And more.", "G-4 Edit: Undo reopens Edit with the changes");
    // G-15: the bookmark's word says its state
    await page.click("#editMark"); await page.waitForTimeout(100);
    ok((await page.textContent("#editMark span")) === "Bookmarked" && (await page.getAttribute("#editMark", "aria-pressed")) === "true", "G-15 Bookmark says Bookmarked, with aria-pressed");
    await page.click("#editMark"); await page.click("#editCancel"); await page.waitForTimeout(400);
    ok(errs.length === 0, "cancel: no page errors" + (errs[0] ? ": " + errs[0] : "")); await ctx.close();
  }

  // G-5: VoiceOver keeps Undo until the next move; pages take the focus and make what is under them inert
  {
    const { page, errs, ctx } = await open(browser, base, { native: true, vo: true });
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById("srNext").click()); await page.waitForTimeout(6000);
    ok(await page.locator("#toast.on").count() === 1, "G-5 VoiceOver on: Undo is still there after 5 seconds");
    await page.evaluate(() => document.getElementById("srNext").click()); await page.waitForTimeout(500);
    ok(/Moved on/.test(await page.textContent("#toastMsg")), "G-5 and the next move replaces it");
    await page.click("#stripOpen"); await page.waitForTimeout(600);
    ok(await page.evaluate(() => document.getElementById("vMeet").inert), "G-5 Your thoughts open: the reading screen behind is inert");
    await page.click("#libGear"); await page.waitForTimeout(500);
    ok(await page.evaluate(() => document.activeElement && document.activeElement.tagName === "H1" && document.getElementById("settings").contains(document.activeElement)), "G-5 Settings opens with the focus on its heading");
    ok(await page.evaluate(() => document.getElementById("lib").inert && !document.getElementById("settings").inert), "G-5 the list under Settings is inert");
    // G-38: Settings opens at the top; Scales Full sits under Look
    await page.evaluate(() => { document.querySelector("#settings .body").scrollTop = 500; });
    await page.click("#setBack"); await page.waitForTimeout(400); await page.click("#libGear"); await page.waitForTimeout(400);
    ok((await page.evaluate(() => document.querySelector("#settings .body").scrollTop)) === 0, "G-38 Settings opens at the top");
    const order = await page.evaluate(() => [...document.querySelectorAll("#settings .sh")].filter((x) => x.offsetParent).map((x) => x.textContent).join("|"));
    ok(/^Look\|Scales Full\|/.test(order), "G-38 Scales Full sits under Look: " + order);
    // G-34: the App Store version first
    ok((await page.textContent("#setVersion")) === "1.1 (2.37.0, build 63)", "G-34 Version reads " + (await page.textContent("#setVersion")));
    // G-6: the status bar follows the ground at the top
    const bars = await page.evaluate(() => window.__sent.filter((m) => m.type === "bar").map((m) => m.style));
    ok(bars[0] === "dark" && bars.includes("light"), "G-6 status bar: dark words on pistachio, light on the plum pages (" + bars.join(",") + ")");
    ok(errs.length === 0, "voiceover: no page errors" + (errs[0] ? ": " + errs[0] : "")); await ctx.close();
  }

  // G-2: Backups says so when the last automatic copy failed, and what On My iPhone means
  {
    const { page, errs, ctx } = await open(browser, base, { native: true, ui: { saved: { ok: false, where: "files", at: ago(1) } } });
    await page.click("#stripOpen"); await page.waitForTimeout(500); await page.click("#libGear"); await page.waitForTimeout(400);
    ok((await page.textContent("#setBackupsV")) === "Last copy failed", "G-2 the Backups row says Last copy failed");
    await page.click("#setBackups"); await page.waitForTimeout(400);
    const line = await page.textContent("#setSaved");
    ok(/didn't save yesterday\. Back up now\./.test(line) && !/Nothing to do here/.test(line), "G-2 the page says the copy didn't save, not Nothing to do here");
    ok(/deleted if Scales is deleted/.test(line), "G-2 and that copies on this iPhone go with the app");
    ok(errs.length === 0, "backups: no page errors"); await ctx.close();
  }

  // G-16, G-35, G-37, G-17: the list
  {
    const { page, errs, ctx } = await open(browser, base);
    await page.click("#stripOpen"); await page.waitForTimeout(600);
    ok(await page.locator('#libList [data-page="insights"]').isVisible(), "G-24 Insights is a row in Your thoughts");
    ok(!(await page.locator("#setIns").count()), "G-24 and no longer in Settings");
    const lbl = await page.evaluate(() => { const r = document.querySelector('#libList .m span[aria-label]'); return r && r.getAttribute("aria-label"); });
    ok(!lbl || /^\d+ (day|week|month|year)s?$/.test(lbl), "G-17 ages are read in full (" + lbl + ")");
    await page.click("#segAway"); await page.waitForTimeout(300);
    ok(/Put away/.test(await page.textContent("#libList h3")), "G-37 Put away is a filter word");
    const rowBtn = page.locator('#libList button.t[data-open="p1"]');
    ok(await rowBtn.count() === 1, "G-16 a put-away row is a button");
    await rowBtn.click(); await page.waitForTimeout(700);
    ok(/long put-away thought/.test(await page.textContent("#words")), "G-16 tapping it opens the thought in full");
    await page.click("#words"); await page.waitForTimeout(600);
    ok(await page.locator("#editBring").isVisible() && await page.locator("#editWhy").isVisible(), "G-16 its Edit has Bring back and Say why");
    await page.click("#editBring"); await page.waitForTimeout(400);
    ok(!(await store(page)).p1.away, "G-16 Bring back brings it back");
    await page.click("#editDone"); await page.waitForTimeout(400);
    await page.click("#stripOpen"); await page.waitForTimeout(500); await page.click('#seg [data-view="all"]');
    await page.fill("#q", "zzzz"); await page.waitForTimeout(200);
    ok(/Nothing matches/.test(await page.textContent("#libList")) && !/in rotation/.test(await page.textContent("#libList")), "G-35 no matches says Nothing matches");
    ok(errs.length === 0, "list: no page errors" + (errs[0] ? ": " + errs[0] : "")); await ctx.close();
  }

  // G-22 browser backups; G-23 sets; G-25 Write offers sets and import while there are few thoughts
  {
    const { page, errs, ctx } = await open(browser, base);
    await page.click("#stripNew"); await page.waitForTimeout(400);
    ok(await page.locator("#writeAddFrom").isVisible(), "G-25 Write offers a set or an import while there are few thoughts");
    await page.click("#writeAddFrom"); await page.waitForTimeout(500);
    ok(await page.locator("#sets.open").count() === 1, "G-25 and it opens Sets");
    await page.click("#setsBack"); await page.waitForTimeout(500);
    ok(await page.locator("#sets.open").count() === 0 && await page.locator("#words").isVisible(), "G-25 Back returns to the thought");
    await page.click("#stripOpen"); await page.waitForTimeout(500); await page.click("#libGear"); await page.waitForTimeout(400);
    await page.click("#setBackups"); await page.waitForTimeout(300);
    ok(/Safari may clear/.test(await page.textContent("#setSaved")) && /get the iPhone app/.test(await page.textContent("#setSaved")), "G-22 browser Backups says Safari may clear it");
    await page.click("#backupsBack"); await page.waitForTimeout(400);
    await page.click("#setSets"); await page.waitForTimeout(400);
    await page.locator("#setList .srow.setr").first().click(); await page.waitForTimeout(300);
    ok(/Added · Remove/.test(await page.locator("#setList .srow.setr").first().textContent()), "G-23 an added set says Added · Remove");
    await page.click("#setsBack"); await page.waitForTimeout(400);
    ok(/^1 added$/.test((await page.textContent("#setSetsV")).trim()), "G-23 and the count agrees: " + (await page.textContent("#setSetsV")));
    ok(errs.length === 0, "sets: no page errors" + (errs[0] ? ": " + errs[0] : "")); await ctx.close();
  }

  // G-8 first run; G-10 placeholder contrast
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } }); const page = await ctx.newPage();
    await page.goto(base + "/"); await page.waitForTimeout(500);
    ok(/Start with five ›/.test(await page.textContent("#startFive")), "G-8 the first-run card has an action word");
    const wt = await page.evaluate(() => getComputedStyle(document.getElementById("writeText")).fontWeight);
    ok(+wt === 400, "G-7 the example is regular weight (" + wt + ")");
    await ctx.close();
  }

  // G-11, G-12: twice the text size at 375 wide: the strip holds, nothing scrolls sideways, Insights numbers fit
  for (const look of ["light", "dark"]) {
    const { page, errs, ctx } = await open(browser, base, { native: true, ts: 3.1, ui: { look } });
    await page.waitForTimeout(400);
    const ts = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ts").trim());
    ok(ts === "2", "G-11 [" + look + "] interface text grows to 2x (" + ts + ")");
    const strip = await page.evaluate(() => { const a = document.getElementById("stripOpen").getBoundingClientRect(), b = document.getElementById("stripNew").getBoundingClientRect(), s = document.getElementById("strip").getBoundingClientRect(); return { a: a.top + a.height / 2, b: b.top + b.height / 2, inside: a.bottom <= s.bottom + 1 && b.bottom <= s.bottom + 1, right: b.right <= s.right + 1 }; });
    ok(Math.abs(strip.a - strip.b) < 2 && strip.inside && strip.right, "G-12 [" + look + "] + New lines up with Your thoughts and stays inside the strip " + JSON.stringify(strip));
    await page.screenshot({ path: path.join(shots, "audit-2x-meet-" + look + ".png") });
    await page.click("#stripOpen"); await page.waitForTimeout(600); await page.click('#libList [data-page="insights"]'); await page.waitForTimeout(500);
    const clip = await page.evaluate(() => [...document.querySelectorAll("#insBody .fd .n")].filter((n) => n.scrollWidth > n.clientWidth + 1).length);
    ok(clip === 0, "G-12 [" + look + "] no Insights number is clipped");
    const sideways = await page.evaluate(() => [...document.querySelectorAll(".page.open .body")].some((b) => b.scrollWidth > b.clientWidth + 1));
    ok(!sideways, "G-11 [" + look + "] Insights doesn't scroll sideways at 2x");
    await page.screenshot({ path: path.join(shots, "audit-2x-insights-" + look + ".png") });
    ok(errs.length === 0, "2x: no page errors" + (errs[0] ? ": " + errs[0] : "")); await ctx.close();
  }

  // G-10, G-32: contrast of placeholders and handles on their grounds, both looks and both colors
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } }); const page = await ctx.newPage();
    await page.goto(base + "/"); await page.waitForTimeout(400);
    const res = await page.evaluate(() => {
      const hex = (c) => { const m = c.match(/\d+(\.\d+)?/g).map(Number); return m; };
      const L = (rgb) => { const c = rgb.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
      const cr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const probe = document.createElement("div"); document.body.appendChild(probe);
      const col = (v) => { probe.style.color = "var(" + v + ")"; return hex(getComputedStyle(probe).color); };
      const out = [];
      for (const theme of [null, "stone"]) for (const look of ["light", "dark"]) {
        if (theme) document.documentElement.setAttribute("data-theme", theme); else document.documentElement.removeAttribute("data-theme");
        document.documentElement.setAttribute("data-look", look);
        out.push({ k: (theme || "pistachio") + "-" + look, faint: +cr(col("--plum-faint"), col("--plum")).toFixed(2) });
      }
      probe.remove(); document.documentElement.removeAttribute("data-theme"); document.documentElement.removeAttribute("data-look"); return out;
    });
    ok(res.every((r) => r.faint >= 4.5), "G-10 placeholders reach 4.5:1 in every look: " + JSON.stringify(res));
    await ctx.close();
  }

  await browser.close(); server.close();
  console.log(fails ? fails + " failed" : "all passed"); process.exit(fails ? 1 : 0);
})();
