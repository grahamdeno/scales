// Browser check for Share Sheet import (2.38.0, 1.2 item 3): the page side of the inbox.
// Run: node tests/e2e/inbox.e2e.js   (a stand-in plays the iPhone app, hands over items and records inboxDone)
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
const mk = (id, text) => ({ id, text, by: "", note: "", created: ago(10), due: day, away: null, skips: 0, thinks: 0, works: 0, seen: ago(2), visits: [] });

async function open(browser, base, st) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
  await page.addInitScript((o) => {
    window.__m = [];
    window.webkit = { messageHandlers: { scales: { postMessage: (m) => { window.__m.push(m); } } } };
    window.scalesNative = { build: "70" };
    if (!sessionStorage.getItem("s")) { localStorage.clear(); localStorage.setItem("scales.next.thoughts.v1", JSON.stringify(o.st)); localStorage.setItem("scales.next.ui.v1", JSON.stringify({ nudged: true, cur: o.cur })); sessionStorage.setItem("s", "1"); }
  }, { st, cur: Object.keys(st)[0] || "" });
  await page.goto(base + "/?native=1"); await page.waitForFunction(() => typeof window.scalesInbox === "function");
  return { page, errs, ctx };
}
const deliver = (page, items) => page.evaluate((it) => { window.__m.length = 0; window.scalesInbox(it); return window.__m.filter((m) => m.type === "inboxDone"); }, items);
const stored = (page) => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("scales.next.thoughts.v1") || "{}")));

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch();

  // 1. Items are added through Write's path, saved, and only then answered with inboxDone.
  {
    const { page, errs, ctx } = await open(browser, base, { k0: mk("k0", "Rest is part of the work.") });
    const items = [
      { id: "i1", text: "  Begin before you are ready.  ", source: "A book", at: ago(1) },
      { id: "i2", text: "https://example.com/essay", source: "", at: ago(0.5) },
      { id: "i3", text: "   ", source: "x", at: ago(0.2) },
    ];
    const done = await deliver(page, items);
    ok(done.length === 1 && done[0].ids.join() === "i1,i2,i3", "inboxDone lists every handled id (" + JSON.stringify(done.map((d) => d.ids)) + ")");
    let st = await stored(page);
    const a = st.find((t) => t.text === "Begin before you are ready.");
    ok(st.length === 3 && a && a.by === "A book", "two new thoughts saved, text trimmed, source on the byline");
    ok(!st.some((t) => !t.text.trim()), "an empty text adds nothing");
    ok(await page.evaluate(() => document.getElementById("stripN").textContent) === "3", "the thought count updates");
    // 2. The same items again (the app crashed before removing them): nothing twice, still answered.
    const again = await deliver(page, items);
    st = await stored(page);
    ok(st.length === 3, "a repeated delivery adds nothing");
    ok(again.length === 1 && again[0].ids.join() === "i1,i2,i3", "it is still answered, so the app can remove them");
    // 3. Items with no usable id are ignored and not answered for; no list, no harm.
    const none = await deliver(page, [{ text: "no id" }, null]);
    ok(none.length === 0 && (await stored(page)).length === 3, "no id: nothing added, nothing answered");
    ok((await page.evaluate(() => { try { window.scalesInbox("nope"); window.scalesInbox(); return true; } catch (e) { return false; } })), "a bad argument does not throw");
    // 4. The ids survive a reload, so a duplicate after a restart is still skipped.
    await page.reload(); await page.waitForFunction(() => typeof window.scalesInbox === "function");
    const after = await deliver(page, [items[0]]);
    ok((await stored(page)).length === 3 && after.length === 1, "after a reload the same id is still skipped");
    ok(errs.length === 0, "no page errors" + (errs.length ? ": " + errs[0] : ""));
    await ctx.close();
  }

  // 5. First ever thought arrives with nothing stored: it is due today.
  {
    const { page, errs, ctx } = await open(browser, base, {});
    await deliver(page, [{ id: "z1", text: "My first thought", source: "", at: ago(0.1) }]);
    const st = await stored(page);
    ok(st.length === 1 && st[0].due === day, "the first thought is due today (" + (st[0] && st[0].due) + ")");
    ok(errs.length === 0, "no page errors on an empty start" + (errs.length ? ": " + errs[0] : ""));
    await ctx.close();
  }

  await browser.close(); server.close();
  console.log(fails ? fails + " FAILED" : "all passed"); process.exit(fails ? 1 : 0);
})();
