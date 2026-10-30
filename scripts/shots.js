// Screenshots of the real app for the website and the App Store, at iPhone 16 Pro Max size (440 x 956 points, 3x:
// 1320 x 2868, Apple's 6.9-inch size). The app runs as it is; only the phone's safe areas, status bar, Dynamic Island
// and home indicator are added, since a browser has none of them.
// Usage: node scripts/shots.js <out folder>   (serves this folder itself)
"use strict";
const path = require("path"), fs = require("fs"), http = require("http");
const { chromium } = require("playwright");
const C = require("../core.js");
const root = path.join(__dirname, ".."), out = path.resolve(process.argv[2] || "shots");
fs.mkdirSync(out, { recursive: true });

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json" };
const server = http.createServer((q, r) => {
  let f = path.join(root, decodeURIComponent(q.url.split("?")[0]));
  if (f.endsWith("/")) f += "index.html";
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); r.end(b); });
});

// The thoughts on screen: a few of the sets' lines and a few written by hand.
function seed(now) {
  const S = require("../sets.js"), sets = (global.ScalesSets || S).sets, st = {}, today = C.dayKey(now);
  const line = (setId, start) => { const s = sets.find((x) => x.id === setId); const it = s.items.find((i) => i.text.startsWith(start)); const t = Object.assign(C.make(it.text, now, it.by), { id: "s-" + it.id, set: setId, item: it.id, from: "set", due: today }); st[t.id] = t; return t.id; };
  const own = (text, o) => { const t = Object.assign(C.make(text, now), { due: today }, o || {}); t.id = "o" + Object.keys(st).length; st[t.id] = t; return t.id; };
  const ids = {
    epictetus: line("stoics", "People are not disturbed"),
    busy: line("questions", "What am I avoiding"),
    franklin: line("franklin", "Give everything you own"),
    jung: line("jung", "I can't change what"),
    dread: own("Most problems are smaller than the dread before them.", { skips: 2, seen: "2026-10-20T12:00:00.000Z", visits: [{ at: "x", kind: "skipped", ms: 4000 }] }),
    rest: own("Rest is part of the work.", { due: C.addDays(today, 1), seen: "2026-10-25T12:00:00.000Z", visits: [{}] }),
    hard: own("Say the hard thing early, while it is still small.", { due: C.addDays(today, 2), seen: "2026-10-25T12:00:00.000Z", visits: [{}], bookmarked: "2026-10-26T12:00:00.000Z" }),
    first: own("I am not my first reaction.", { due: C.addDays(today, 4), seen: "2026-10-25T12:00:00.000Z", visits: [{}] }),
    polite: own("Ask one more question than feels polite.", { away: "2026-10-21T12:00:00.000Z", seen: "2026-10-21T12:00:00.000Z", visits: [{}] })
  };
  return { st, ids };
}

// Status bar, Dynamic Island and home indicator, drawn over the page in its own ink.
function chrome(ink) {
  return `
  <div style="position:fixed;inset:0;pointer-events:none;z-index:2147483647;font-family:Geist,-apple-system,sans-serif;color:${ink}">
    <div style="position:absolute;left:0;top:0;width:150px;height:62px;display:flex;align-items:center;justify-content:center;padding-top:4px;font-weight:600;font-size:17px;letter-spacing:-0.2px">9:41</div>
    <div style="position:absolute;left:157px;top:11px;width:126px;height:37px;border-radius:19px;background:#000"></div>
    <div style="position:absolute;right:0;top:0;width:150px;height:62px;display:flex;align-items:center;justify-content:center;gap:6px;padding-top:4px">
      <svg width="19" height="12" viewBox="0 0 19 12"><g fill="${ink}"><rect x="0" y="7.5" width="3.2" height="4.5" rx="0.9"/><rect x="5.2" y="5" width="3.2" height="7" rx="0.9"/><rect x="10.4" y="2.5" width="3.2" height="9.5" rx="0.9"/><rect x="15.6" y="0" width="3.2" height="12" rx="0.9"/></g></svg>
      <svg width="17" height="12" viewBox="0 0 17 12"><g fill="${ink}"><path d="M8.5 2.4c2.4 0 4.6.9 6.3 2.5l1.2-1.2C14 1.7 11.4.6 8.5.6S3 1.7 1 3.7l1.2 1.2C3.9 3.3 6.1 2.4 8.5 2.4z"/><path d="M8.5 5.9c1.4 0 2.8.5 3.8 1.5l1.2-1.2C12.2 4.9 10.4 4.1 8.5 4.1s-3.7.8-5 2.1l1.2 1.2c1-1 2.4-1.5 3.8-1.5z"/><path d="M8.5 9.3c.5 0 1 .2 1.4.6L8.5 11.4 7.1 9.9c.4-.4.9-.6 1.4-.6z"/></g></svg>
      <svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.8" fill="none" stroke="${ink}" stroke-opacity="0.4"/><rect x="2" y="2" width="20" height="9" rx="2.5" fill="${ink}"/><path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2z" fill="${ink}" fill-opacity="0.45"/></svg>
    </div>
    <div style="position:absolute;left:153px;bottom:8px;width:134px;height:5px;border-radius:3px;background:${ink}"></div>
  </div>`;
}

if (!process.argv.includes("--frame")) (async () => {
  await new Promise((r) => server.listen(0, r));
  const base = "http://127.0.0.1:" + server.address().port + "/";
  const browser = await chromium.launch();
  const now = new Date(); now.setHours(9, 41, 0, 0);

  async function shot(name, scheme, cur, act) {
    const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, colorScheme: scheme, hasTouch: true });
    const page = await ctx.newPage();
    const { st, ids } = seed(now);
    await page.addInitScript(([st, ui]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.clear();
        localStorage.setItem("scales.next.thoughts.v1", JSON.stringify(st));
        localStorage.setItem("scales.next.ui.v1", JSON.stringify(ui));
        sessionStorage.setItem("seeded", "1");
      }
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = ":root { --top: 62px !important; --bot: 34px !important; } .hint, #carry { transition: none !important; } * { caret-color: transparent; }";
        document.head.appendChild(s);
      });
    }, [st, { cur: ids[cur], ms: 0, worked: false, nudged: true, view: "all", review: null, snapDay: C.dayKey(now) }]);
    await page.goto(base + "index.html"); await page.waitForTimeout(1200);
    if (act) await act(page, ids);
    const bg = await page.evaluate(() => {
      const el = document.elementFromPoint(220, 30) || document.body;
      let e = el, c = "";
      while (e && (!(c = getComputedStyle(e).backgroundColor) || c === "rgba(0, 0, 0, 0)")) e = e.parentElement;
      const m = (c || "rgb(255,255,255)").match(/\d+/g).map(Number);
      return 0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2];
    });
    await page.evaluate((h) => document.body.insertAdjacentHTML("beforeend", h), chrome(bg > 140 ? "#1C1420" : "#FFFFFF"));
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(out, name + ".png") });
    console.log("saved " + name + ".png");
    await ctx.close();
  }

  await shot("meet-light", "light", "epictetus");
  await shot("meet-dark", "dark", "busy");
  await shot("meet-own", "light", "dread");
  await shot("pull", "light", "franklin", async (page) => {
    await page.mouse.move(220, 480); await page.mouse.down(); await page.waitForTimeout(50);
    for (let y = 480; y <= 640; y += 8) { await page.mouse.move(220, y); await page.waitForTimeout(12); }
    await page.waitForTimeout(150);
  });
  await shot("library", "light", "epictetus", async (page) => { await page.click("#strip"); await page.waitForTimeout(900); });
  await shot("library-dark", "dark", "epictetus", async (page) => { await page.click("#strip"); await page.waitForTimeout(900); });
  await shot("sets", "light", "epictetus", async (page) => {
    await page.click("#strip"); await page.waitForTimeout(800); await page.click("#libGear"); await page.waitForTimeout(600);
    await page.click("#setSets"); await page.waitForTimeout(700);
  });
  await shot("write", "light", "epictetus", async (page) => {
    await page.click("#newBtn"); await page.waitForTimeout(700);
    await page.fill("#writeText", "The meeting I keep dreading is mostly a conversation I haven't had yet.");
    await page.evaluate(() => { document.activeElement && document.activeElement.blur(); document.getElementById("writeText").dispatchEvent(new Event("input", { bubbles: true })); });
    await page.waitForTimeout(400);
  });
  await browser.close(); server.close();
})();

// Framed copies for the website: each screenshot inside a plain phone body, background left transparent.
// Usage: node scripts/shots.js <out folder> --frame <name> [<name> ...]   (reads <out>/<name>.png, writes <out>/<name>-framed.png)
if (process.argv.includes("--frame")) {
  const names = process.argv.slice(process.argv.indexOf("--frame") + 1);
  (async () => {
    const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 470, height: 990 }, deviceScaleFactor: 2 })).newPage();
    for (const n of names) {
      const src = "data:image/png;base64," + fs.readFileSync(path.join(out, n + ".png")).toString("base64");
      await p.setContent(`<html><body style="margin:0;background:transparent">
        <div id="ph" style="width:466px;height:982px;border-radius:72px;padding:13px;box-sizing:border-box;margin:4px 2px;
          background:linear-gradient(145deg,#3a3440,#151217 40%,#262129);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.16),inset 0 0 0 5px #0d0b0f">
          <img src="${src}" style="width:440px;height:956px;border-radius:59px;display:block">
        </div></body></html>`);
      await p.waitForTimeout(100);
      await p.locator("#ph").screenshot({ path: path.join(out, n + "-framed.png"), omitBackground: true });
      console.log("framed " + n);
    }
    await b.close();
  })();
}
