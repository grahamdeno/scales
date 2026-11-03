// Browser check for refining a thought (2.31.0): Say why waits, Save and write the next one, and the link both ways.
// Run: node tests/e2e/refine.e2e.js
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch();
  const ago = (d) => new Date(Date.now() - d * 86400000).toISOString(), day = new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 10);
  const st = {}; ["What part of me do I work hardest to keep others from seeing?", "Rest is part of the work.", "Speak your mind."].forEach((t, i) => { st["k" + i] = { id: "k" + i, text: t, by: "", note: "", created: ago(20), due: day, away: null, skips: 0, thinks: 0, works: 0, seen: ago(2), visits: [{ at: ago(2), kind: "seen", ms: 22000 }] }; });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await ctx.addInitScript((o) => { if (!sessionStorage.getItem("s")) { localStorage.clear(); localStorage.setItem("scales.next.thoughts.v1", JSON.stringify(o)); localStorage.setItem("scales.next.ui.v1", JSON.stringify({ nudged: true, cur: "k0", learnedUp: true, learnedDown: true })); sessionStorage.setItem("s", "1"); } }, st);
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(base + "/"); await wait(1200);
  await page.$eval("#srAway", (e) => e.click()); await wait(6500);
  ok(await page.isVisible("#toastWhy") && (await page.evaluate(() => document.getElementById("toastWhy").nextElementSibling.id)) === "toastUndo", "after putting away, Say why is first and still there after 6 seconds");
  await page.click("#toastWhy"); await wait(600);
  ok((await page.textContent("#whyKeep")) === "Save reason" && /Save and write the next one/.test(await page.textContent("#whyNext")), "Say why: Save reason, and Save and write the next one");
  await page.fill("#whyText", "Too broad. The real question is narrower: What do I hide at work because I'm afraid it makes me look less capable?");
  await page.click("#whyNext"); await wait(700);
  ok(await page.isVisible("#vWrite") && (await page.textContent("#writeHead")) === "From your reason", "Write opens, marked From your reason");
  ok((await page.inputValue("#writeText")) === "What do I hide at work because I'm afraid it makes me look less capable?", "with the question from the reason");
  await page.click("#writeKeep"); await wait(2400);
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem("scales.next.thoughts.v1")));
  const nid = s.k0.ledTo;
  ok(nid && s[nid] && s[nid].grewFrom === "k0" && s.k0.awayWhy && s.k0.away, "the old one is away with its reason and leads to the new one, which grew from it");
  ok(/What do I hide at work/.test(await page.textContent("#words")), "the new thought shows next");
  await page.$eval("#srEdit", (e) => e.click()); await wait(500);
  ok(await page.isVisible("#editGrew") && /Grew from/.test(await page.textContent("#editGrew")) && /What part of me/.test(await page.textContent("#editGrew")), "Edit says what it grew from");
  await page.click("#editCancel"); await wait(300);
  await page.click("#strip"); await wait(700); await page.click("#libList .arch"); await wait(300);
  const lt = await page.textContent("#libList"); ok(/Led to: What do I hide at work/.test(lt), "Put away says what the old one led to" + (/Led to/.test(lt) ? "" : " [" + lt.slice(0, 160) + "]"));
  // Without a question, the whole reason is offered, selected
  await page.click("#libClose"); await wait(500);
  await page.$eval("#srAway", (e) => e.click()); await wait(700); await page.click("#toastWhy"); await wait(600);
  await page.fill("#whyText", "Lived this one now"); await page.click("#whyNext"); await wait(700);
  ok((await page.inputValue("#writeText")) === "Lived this one now" && await page.evaluate(() => { const w = document.getElementById("writeText"); return w.selectionStart === 0 && w.selectionEnd === w.value.length; }), "no question: the whole reason, selected");
  ok(errs.length === 0, "no page errors" + (errs.length ? ": " + errs[0] : ""));
  await browser.close(); server.close();
  console.log(fails ? fails + " failed" : "all passed"); process.exit(fails ? 1 : 0);
})();
