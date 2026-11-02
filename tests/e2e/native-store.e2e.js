// Browser check for the iPhone app's store script (ios/App/NativeStore.js), with the shell faked: the page's saves
// reach the "file", the newer side wins on start, and the real app runs normally on top of it.
// Run: node tests/e2e/native-store.e2e.js
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const root = path.join(__dirname, "..", "..");
const storeJs = fs.readFileSync(path.join(root, "ios/App/NativeStore.js"), "utf8");
const types = { ".html": "text/html", ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".png": "image/png", ".woff2": "font/woff2" };
const server = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  if (p === "/blank.html") { s.writeHead(200, { "content-type": "text/html" }); return s.end("<!doctype html><title>b</title>"); }
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); s.end(fs.readFileSync(f));
});
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };

// The fake shell: records "store" messages, and hands the page a seed before it starts.
function shell(seed, preset) {
  return `window.__msgs = [];
    window.webkit = { messageHandlers: { scales: { postMessage: function (m) { window.__msgs.push(JSON.parse(JSON.stringify(m))); } } } };
    window.scalesNative = { version: 1, platform: "ios", build: "40", testflight: false, look: true, bundled: true };
    (function () { var p = ${JSON.stringify(preset || null)}; if (p) { localStorage.clear(); for (var k in p) localStorage.setItem(k, p[k]); } })();
    window.__scalesSeed = ${JSON.stringify(seed)};
    ${storeJs}`;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch();
  async function run(seed, preset, body) {
    const ctx = await browser.newContext();
    await ctx.addInitScript({ content: shell(seed, preset) });
    const page = await ctx.newPage();
    await page.goto(base + "/blank.html");
    await body(page);
    await ctx.close();
  }

  await run(null, null, async (page) => {
    await wait(400);
    ok((await page.evaluate(() => window.__msgs.length)) === 0, "no file and nothing saved: nothing sent");
    await page.evaluate(() => { localStorage.setItem("scales.a", "1"); localStorage.setItem("other", "x"); localStorage.setItem("scales.b", "2"); });
    await wait(450);
    const m = await page.evaluate(() => window.__msgs);
    ok(m.length === 1 && m[0].type === "store" && m[0].rev === 1 && !m[0].full && m[0].set["scales.a"] === "1" && m[0].set["scales.b"] === "2" && !("other" in m[0].set), "saves are batched into one message, scales keys only");
    ok((await page.evaluate(() => localStorage.getItem("scales.native.rev"))) === "1", "the revision goes up in localStorage at once");
    await page.evaluate(() => { localStorage.removeItem("scales.a"); localStorage.removeItem("scales.none"); });
    await wait(450);
    const m2 = await page.evaluate(() => window.__msgs[1]);
    ok(m2 && m2.rev === 2 && m2.del.length === 1 && m2.del[0] === "scales.a", "a removal is sent; removing a missing key sends nothing extra");
    await page.evaluate(() => { localStorage.setItem("scales.c", "3"); window.scalesStoreFlush(); });
    ok((await page.evaluate(() => window.__msgs.length)) === 3, "flush sends at once (on going to the background)");
  });

  await run({ rev: 5, data: { "scales.t": "file", "scales.u": "u" } }, { "scales.t": "old", "scales.x": "stale", "keep": "k", "scales.native.rev": "3" }, async (page) => {
    const st = await page.evaluate(() => ({ t: localStorage.getItem("scales.t"), u: localStorage.getItem("scales.u"), x: localStorage.getItem("scales.x"), keep: localStorage.getItem("keep"), rev: localStorage.getItem("scales.native.rev") }));
    ok(st.t === "file" && st.u === "u" && st.x === null && st.keep === "k" && st.rev === "5", "a newer file replaces the scales keys exactly, and leaves other keys alone");
    await wait(400);
    ok((await page.evaluate(() => window.__msgs.length)) === 0, "after a restore from the file, nothing is sent back");
    await page.evaluate(() => localStorage.setItem("scales.t", "new"));
    await wait(450);
    const m = await page.evaluate(() => window.__msgs[0]);
    ok(m && m.rev === 6 && m.set["scales.t"] === "new", "the next change carries the next revision");
  });

  await run({ rev: 4, data: { "scales.t": "file" } }, { "scales.t": "phone", "scales.v": "v", "scales.native.rev": "7" }, async (page) => {
    await wait(450);
    const m = await page.evaluate(() => window.__msgs[0]);
    ok(m && m.full === true && m.rev === 8 && m.set["scales.t"] === "phone" && m.set["scales.v"] === "v", "newer localStorage (an unsent change) sends everything under a new revision");
    ok((await page.evaluate(() => localStorage.getItem("scales.t"))) === "phone", "and localStorage is kept as it was");
  });

  await run({ rev: 2, data: { "scales.t": "file" } }, null, async (page) => {
    ok((await page.evaluate(() => localStorage.getItem("scales.t"))) === "file", "iOS cleared localStorage: the file puts it back");
  });

  // A restore that can't finish (storage full): stop sending, and make the next start restore from the file again.
  {
    const ctx = await browser.newContext();
    await ctx.addInitScript({ content: `(function () { var o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === "scales.bad") throw new Error("QuotaExceededError"); return o.call(this, k, v); }; })();` + shell({ rev: 9, data: { "scales.ok": "1", "scales.bad": "big" } }, { "scales.ok": "old" }) });
    const page = await ctx.newPage();
    await page.goto(base + "/blank.html");
    await page.evaluate(() => { localStorage.setItem("scales.ok", "changed"); });
    await wait(450);
    const st = await page.evaluate(() => ({ err: window.scalesStoreError, rev: localStorage.getItem("scales.native.rev"), n: window.__msgs.length }));
    ok(st.err === "restore" && st.rev === null && st.n === 0, "a restore that can't finish sends nothing and leaves no revision, so the file wins next time");
    await ctx.close();
  }

  // The real app on top of the script, with thoughts only in the "file".
  const th = { a1: { id: "a1", text: "Most things go better when I slow down.", created: "2026-10-01T00:00:00Z", due: "2026-10-01" } };
  await run(null, null, async () => {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errs = [];
  await ctx.addInitScript({ content: shell(null, null) });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(base + "/index.html?native=1");
  await wait(1500);
  const sent = await page.evaluate(() => window.__msgs.filter((m) => m.type === "store"));
  ok(errs.length === 0, "the app runs with the store script and no page errors" + (errs.length ? ": " + errs[0] : ""));
  ok(sent.length >= 1 && Object.keys(sent[sent.length - 1].set).some((k) => k.indexOf("scales.next.") === 0), "the app's own saves reach the file");
  // Next launch: localStorage gone (iOS cleared it), the file has everything the app saved.
  const file = {}; let rev = 0;
  for (const m of sent) { rev = m.rev; if (m.full) Object.keys(file).forEach((k) => delete file[k]); Object.assign(file, m.set); (m.del || []).forEach((k) => delete file[k]); }
  file["scales.next.thoughts.v1"] = JSON.stringify(Object.assign(JSON.parse(file["scales.next.thoughts.v1"] || "{}"), th));
  await ctx.close();
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await ctx2.addInitScript({ content: shell({ rev: rev + 1, data: file }, null) });
  const p2 = await ctx2.newPage();
  const errs2 = []; p2.on("pageerror", (e) => errs2.push(String(e)));
  await p2.goto(base + "/index.html?native=1");
  await wait(1500);
  const has = await p2.evaluate(() => { try { return Object.keys(JSON.parse(localStorage.getItem("scales.next.thoughts.v1")) || {}).indexOf("a1") >= 0; } catch (e) { return false; } });
  ok(has && errs2.length === 0, "after iOS clears the web storage, the app starts with the thought from the file");
  await ctx2.close();

  await browser.close(); server.close();
  console.log(fails ? fails + " failed" : "all passed");
  process.exit(fails ? 1 : 0);
})();
