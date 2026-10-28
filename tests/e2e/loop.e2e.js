// Browser tests for the main loop (1.68.0). They drive the real page in Chromium at iPhone size:
// first run, the three choices, Skip and its pushback, Today's question, Later and its return,
// Reflect and Undo, Capture, and Undo going away. Run with: node --test tests/e2e/loop.e2e.js
// (needs Playwright; CI installs it, see .github/workflows/test.yml).
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");

const root = path.join(__dirname, "..", "..");
let server, base, browser;
const types = { ".js": "text/javascript", ".html": "text/html", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".woff2": "font/woff2", ".svg": "image/svg+xml" };

before(async () => {
  server = http.createServer((req, res) => {
    let p = path.join(root, decodeURIComponent(req.url.split("?")[0]));
    if (p.endsWith("/")) p += "index.html";
    fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": types[path.extname(p)] || "application/octet-stream" }); res.end(d); });
  });
  await new Promise((r) => server.listen(0, r));
  base = "http://localhost:" + server.address().port + "/index.html";
  browser = await chromium.launch();
});
after(async () => { await browser.close(); server.close(); });

const P = (id, text, extra) => Object.assign({ id, text, status: "active", skip_count: 0, lifetime_skips: 0, reflect_count: 0, created_at: "2026-10-01" }, extra || {});
// A page at iPhone size with the given saved prefs and thoughts, the clock set to `at`. No network.
async function open({ prefs, thoughts, at } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install({ time: at || new Date(2026, 9, 27, 9, 0) });
  await page.addInitScript(([p, t]) => {
    if (p) localStorage.setItem("scales.prefs.v1", JSON.stringify(p));
    if (t) localStorage.setItem("scales.thoughts.v1", JSON.stringify(t));
  }, [prefs || null, thoughts || null]);
  await page.goto(base);
  await page.clock.runFor(500);
  page.errors = errors;
  return page;
}
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("scales.thoughts.v1")));
const words = (page) => page.$eval("#words", (e) => e.textContent);
// The choices are buttons in view (1.73.0): tap one.
async function choose(page, move) { await page.click('#keys [data-move="' + move + '"]'); await page.clock.runFor(300); }
// Advance the page clock in small steps until check() passes, so a slow machine does not fail a test.
async function until(page, check, steps = 40) {
  // Real time too (1.71.0): a mocked network answer needs the event loop, not just the page clock.
  for (let i = 0; i < steps; i++) { if (await check()) return true; await page.clock.runFor(250); await page.waitForTimeout(50); }
  return check();
}
const rows = (page) => page.$$eval("#keys .choice", (s) => s.map((x) => x.textContent));
// 1.83.0: the question fades in after DWELL_MS on the thought; no button.
// The screen is quiet by then; one touch on the thought wakes it (1.83.2).
const reveal = async (page) => { await page.clock.runFor(6200); await page.click("#words"); await page.clock.runFor(100); };
const ready = { onboarded: true, coach_seen: true };

test("first run: welcome, a starter deck, the three choices, then the deck", async () => {
  const page = await open();
  assert.match(await page.textContent(".welcome h1"), /Scales/);
  await page.click("#wNext");
  await page.click('[data-starter="stoic"]'); await page.clock.runFor(300);
  assert.match(await page.textContent(".welcome h1"), /Three choices/);
  await page.click("#wDone"); await page.clock.runFor(300);
  assert.ok((await words(page)).length > 10, "a thought is on screen");
  assert.ok(Object.keys(await saved(page)).length >= 5, "the starter deck was added");
  assert.deepEqual(page.errors, []);
});

test("the three choices are in view; Today's question shows the line (1.73.0)", async () => {
  const page = await open({ prefs: ready, thoughts: { a: P("a", "Say the hard thing early.") } });
  assert.deepEqual(await rows(page), ["Skip", "Reflect", "Lived"]);
  assert.equal(await page.$eval('#keys [data-move="keep"]', (e) => e.classList.contains("main")), true, "Reflect is the suggested choice");
  await page.click(".qbtn"); await page.clock.runFor(300);
  assert.ok((await page.textContent("#aiLine")).length > 5, "the line shows");
  assert.equal(await page.$("#scrollHint"), null, "a short thought has no scroll hint");
});

test("Skip asks once; Keep it goes back; Skip after reading rests the thought", async () => {
  const page = await open({ prefs: ready, thoughts: { a: P("a", "One."), b: P("b", "Two.") } });
  const first = await words(page);
  await choose(page, "skip");
  assert.match(await page.textContent("#card .phase"), /Before you skip/);
  assert.deepEqual(await rows(page), ["Skip anyway", "Keep it"]);
  await choose(page, "stay");
  assert.deepEqual(await rows(page), ["Skip", "Reflect", "Lived"], "Keep it goes back to the choices");
  assert.equal(await words(page), first, "the same thought");
  assert.ok((await page.textContent("#aiLine")).length > 5, "with the line still showing");
  await choose(page, "skip"); await page.clock.runFor(500);
  const t = Object.values(await saved(page)).find((x) => x.text === first);
  assert.equal(t.skip_count, 1);
  assert.notEqual(await words(page), first, "the next thought is up");
});

test("tap to see the line: then Skip it rests straight away and Later is offered", async () => {
  const page = await open({ prefs: ready, thoughts: { a: P("a", "One."), b: P("b", "Two.") } });
  const first = await words(page);
  await reveal(page);
  assert.ok((await page.textContent("#aiLine")).length > 5, "the line shows");
  assert.deepEqual(await rows(page), ["Skip", "Reflect", "Lived"]);
  assert.match(await page.textContent(".laterbtn"), /^Later/);
  await page.click(".laterbtn"); await page.clock.runFor(500);
  const t = Object.values(await saved(page)).find((x) => x.text === first);
  assert.ok(t.later, "saved for later");
  assert.equal(t.skip_count, 0, "Later is not a skip");
});

test("the touch that wakes a quiet screen only wakes it; the next one presses (1.82.1)", async () => {
  const page = await open({ prefs: ready, thoughts: { a: P("a", "One."), b: P("b", "Two.") } });
  await page.clock.runFor(3500);
  assert.ok(await page.evaluate(() => document.body.classList.contains("quiet")), "quiet after 3 seconds");
  await page.click('[data-move="question"]'); await page.clock.runFor(300);
  assert.ok(!(await page.evaluate(() => document.body.classList.contains("quiet"))), "awake");
  assert.equal(await page.$("#card .phase"), null, "the waking touch presses nothing");
  await page.click('[data-move="question"]'); await page.clock.runFor(300);
  assert.match(await page.textContent("#card .phase"), /The other side/, "the next touch does");
});
test("the question fades in after a few seconds; its buttons show, then go quiet (1.83.0)", async () => {
  const page = await open({ prefs: ready, thoughts: { a: P("a", "One."), b: P("b", "Two.") } });
  const box = async () => (await page.$eval("#words", (e) => e.getBoundingClientRect().top));
  const top0 = await box();
  assert.ok(!(await page.isVisible("#aiLine")), "not yet");
  assert.equal(await page.$('[data-move="peek"]'), null, "no button for it");
  await reveal(page);
  assert.ok(await page.isVisible("#aiLine"), "the question is there");
  assert.equal(await box(), top0, "the thought did not move");
  assert.ok(await page.$eval("#dwell", (e) => e.classList.contains("fresh")), "Reply, Keep and Later at full strength");
  assert.ok(await page.$(".laterbtn"), "Later is offered");
  await page.clock.runFor(4500);
  assert.ok(!(await page.$eval("#dwell", (e) => e.classList.contains("fresh"))), "then quiet with the rest");
});
test("Reflect goes quiet as well (1.82.2)", async () => {
  const page = await open({ prefs: ready, thoughts: { a: P("a", "One."), b: P("b", "Two.") } });
  await choose(page, "keep"); await page.clock.runFor(3500);
  assert.ok(await page.evaluate(() => document.body.classList.contains("quiet")));
});
test("Scales Plus opened from Settings closes back to Settings (1.82.4)", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.route(/^https?:\/\//, (r) => {
    const u = new URL(r.request().url());
    if (u.hostname !== "scales.tangomike.app" || u.pathname === "/api/ai") return r.abort();
    const p = path.join(root, u.pathname.replace(/^\/app\/?/, "/") === "/" ? "/index.html" : u.pathname.replace(/^\/app\//, "/"));
    fs.readFile(p, (e, d) => e ? r.fulfill({ status: 404 }) : r.fulfill({ status: 200, contentType: types[path.extname(p)] || "application/octet-stream", body: d }));
  });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(2026, 9, 27, 9, 0) });
  await page.addInitScript((t) => {
    window.scalesNative = { version: 1, platform: "ios" };
    window.webkit = { messageHandlers: { scales: { postMessage: () => {} } } };
    localStorage.setItem("scales.prefs.v1", JSON.stringify({ onboarded: true, coach_seen: true }));
    localStorage.setItem("scales.thoughts.v1", JSON.stringify(t));
  }, { a: P("a", "One.") });
  await page.goto("https://scales.tangomike.app/app/?native=1"); await page.clock.runFor(500);
  await page.evaluate(() => window.scalesStore({ active: false, price: "$19.99", trialDays: 14 }));
  await page.click("#setBtn"); await page.clock.runFor(300);
  await page.click("#openPlus"); await page.clock.runFor(300);
  assert.ok(await page.isVisible("#plusBack"), "the way back shows");
  await page.click("#plusClose"); await page.clock.runFor(300);
  assert.equal(await page.$eval("#sheetSettings", (e) => e.open), true, "back on Settings");
  await ctx.close();
});
test("a thought back from Later waits for a choice and counts nothing", async () => {
  const page = await open({ prefs: ready, at: new Date(2026, 9, 27, 20, 50),
    thoughts: { a: P("a", "Back from earlier.", { later: { day: "2026-10-27", at: "" } }), b: P("b", "Other.") } });
  assert.match(await page.textContent("#card .phase"), /Saved from earlier/);
  assert.equal(await words(page), "Back from earlier.", "the thought is on screen");
  await page.clock.runFor(9000);
  assert.equal((await saved(page)).a.reflect_count, 0, "nothing counted on its own");
  assert.deepEqual(await rows(page), ["Skip", "Reflect", "Lived"]);
  assert.equal(await page.$(".laterbtn"), null, "no Later for a thought that just came back from Later");
});

test("Reflect counts after eight seconds; on trial, no Undo, just Next (1.83.2)", async () => {
  // One thought, so the deck's weighted draw cannot put a different one on screen.
  const page = await open({ prefs: ready, thoughts: { a: P("a", "One.", { skip_count: 2, lifetime_skips: 2 }) } });
  await choose(page, "keep");
  assert.ok(await until(page, async () => /Reflecting/.test(await page.textContent("#card .phase").catch(() => ""))), "the Reflect screen");
  await page.clock.runFor(8000);
  assert.ok(await until(page, async () => /Counted as Reflect/.test(await page.textContent("#reflFoot").catch(() => ""))), "counted after eight seconds");
  assert.equal((await saved(page)).a.skip_count, 1, "one lighter");
  assert.equal(await page.$("#reflUndo"), null, "no Undo while REFLECT_UNDO is false");
  assert.ok(await page.$("#reflNext"), "Next thought");
});

test("Capture adds a thought from the + button", async () => {
  const page = await open({ prefs: ready, thoughts: { a: P("a", "One.") } });
  await page.click("#addTop"); await page.clock.runFor(300);
  await page.fill("#thoughtInput", "Finish what I start.");
  await page.click("#addBtn"); await page.clock.runFor(300);
  assert.ok(Object.values(await saved(page)).some((t) => t.text === "Finish what I start."));
});

test("Undo goes away after eight seconds", async () => {
  const page = await open({ prefs: ready, thoughts: { a: P("a", "One."), b: P("b", "Two.") } });
  await reveal(page);
  await page.click(".laterbtn"); await page.clock.runFor(500);
  assert.ok(await page.$("#toastUndo"), "Undo is there");
  await page.clock.runFor(8500);
  assert.equal(await page.$("#toastUndo"), null, "and gone");
});

test("a long thought stays between the top and the choices, and the top says how many are left", async () => {
  const long = Array.from({ length: 6 }, (_, i) => "Part " + (i + 1) + "\nA line long enough to wrap across the screen more than once, so the whole thought is tall.").join("\n\n");
  const page = await open({ prefs: ready, thoughts: { a: P("a", long), b: P("b", "Two."), c: P("c", "Three.") } });
  await page.clock.runFor(300);
  const box = await page.evaluate(() => { const b = (id) => document.getElementById(id).getBoundingClientRect(); return { words: b("words"), card: b("card") }; });
  if ((await words(page)).startsWith("Part")) {
    assert.ok(box.words.top >= box.card.top - 1 && box.words.bottom <= box.card.bottom + 1, "the thought fits inside its area");
  }
  assert.match(await page.textContent("#todayLbl"), /3 left today/);
});

test("the welcome hides +, the switch and Settings; Reflect shows a question when no quote fits", async () => {
  let page = await open();
  assert.equal(await page.$eval("#addTop", (e) => e.hidden), true);
  assert.equal(await page.$eval("#setBtn", (e) => e.hidden), true);
  page = await open({ prefs: ready, thoughts: { a: P("a", "One.") } });
  assert.equal(await page.$eval("#setBtn", (e) => e.hidden), false);
  await choose(page, "keep");
  assert.ok(await until(page, async () => ((await page.textContent("#aiLine").catch(() => "")) || "").endsWith("?")), "a question to sit with");
  assert.match(await page.getAttribute("#feedbackLink", "href"), /^mailto:support@tangomike\.app\?subject=Scales%20feedback/);
});

test("Reply: without AI the reply is kept; with AI today's voice answers in the thread (1.71.0)", async () => {
  let page = await open({ prefs: ready, thoughts: { a: P("a", "One.") } });
  await reveal(page);
  await page.click("#replyBtn"); await page.fill("#replyInput", "In the meeting."); await page.click("#replyDone");
  assert.ok(await until(page, async () => (await saved(page)).a.replies.length === 1), "kept");
  assert.equal(await page.$eval("#sheetWeigh", (e) => e.open), false, "no thread without AI");

  const answer = "Then say it before the meeting starts. What are you protecting by waiting?";
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => /api\.anthropic\.com/.test(r.request().url())
    // The voice's answer only for the thread; the line on screen gets a different text, so the two are never confused.
    ? r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: [{ type: "text", text: /They are replying/.test(r.request().postData() || "") ? answer : "Where would saying it early have changed yesterday?" }], stop_reason: "end_turn" }) })
    : r.abort());
  page = await ctx.newPage();
  await page.clock.install({ time: new Date(2026, 9, 27, 9, 0) });
  await page.addInitScript(([p, t, k]) => {
    localStorage.setItem("scales.prefs.v1", JSON.stringify(p)); localStorage.setItem("scales.thoughts.v1", JSON.stringify(t)); localStorage.setItem(k, "sk-ant-test");
  }, [Object.assign({ ai_consent: true }, ready), { a: P("a", "One.") }, "scales.apikey.v1"]);
  await page.goto(base); await page.clock.runFor(500);
  await reveal(page);
  assert.ok(await until(page, async () => !!(await page.$("#replyBtn"))), "the line and Reply");
  await page.click("#replyBtn");
  assert.match(await page.textContent("#replyNote"), /answers\./);
  await page.fill("#replyInput", "In the meeting."); await page.click("#replyDone");
  assert.ok(await until(page, async () => (await page.$$eval("#talkLog .bub.them", (b) => b.map((x) => x.textContent)).catch(() => [])).some((x) => x.includes(answer))), "the voice answered");
  const t = (await saved(page)).a;
  assert.equal(t.talks.length, 1); assert.equal(t.talks[0].reply, true);
  assert.deepEqual(t.talks[0].turns.map((x) => x.me), [true, false]);
  assert.equal(await page.$eval("#talkForm", (e) => e.hidden), false, "you can keep going");
});

test("Scales Plus in the iPhone app: no server AI without it; buy, then AI requests carry the App Store record (1.72.0)", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const asked = [];
  await ctx.route(/^https?:\/\//, (r) => {
    const u = new URL(r.request().url());
    if (u.hostname !== "scales.tangomike.app") return r.abort();
    if (u.pathname === "/api/ai") {
      asked.push(r.request().headers()["x-scales-plus"] || "");
      const ok = r.request().headers()["x-scales-plus"] === "signed-record";
      return r.fulfill({ status: ok ? 200 : 402, contentType: "application/json",
        body: JSON.stringify(ok ? { content: [{ type: "text", text: "What would saying it before noon change?" }] } : { type: "error", error: { type: "plus_required", message: "x" } }) });
    }
    const p = path.join(root, u.pathname.replace(/^\/app\/?/, "/") === "/" ? "/index.html" : u.pathname.replace(/^\/app\//, "/"));
    fs.readFile(p, (e, d) => e ? r.fulfill({ status: 404 }) : r.fulfill({ status: 200, contentType: types[path.extname(p)] || "application/octet-stream", body: d }));
  });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(2026, 9, 27, 9, 0) });
  await page.addInitScript((t) => {
    window.scalesNative = { version: 1, platform: "ios" };
    window.__sent = []; window.webkit = { messageHandlers: { scales: { postMessage: (m) => window.__sent.push(m) } } };
    localStorage.setItem("scales.prefs.v1", JSON.stringify({ onboarded: true, coach_seen: true }));
    localStorage.setItem("scales.thoughts.v1", JSON.stringify(t));
  }, { a: P("a", "Say the hard thing early.") });
  await page.goto("https://scales.tangomike.app/app/?native=1"); await page.clock.runFor(500);
  const sent = () => page.evaluate(() => window.__sent.map((m) => m.type));
  // The app reports no Plus, with a trial on offer.
  await page.evaluate(() => window.scalesStore({ active: false, price: "$19.99", trialDays: 14 }));
  await reveal(page);
  assert.equal(asked.length, 0, "no server AI without Plus");
  await page.click("#words"); await page.clock.runFor(100); // wake the quiet screen
  await page.click("#setBtn"); await page.clock.runFor(300);
  assert.equal(await page.$eval("#plusGroup", (e) => e.hidden), false);
  assert.match(await page.textContent("#plusStatus"), /Try it free for 14 days/);
  await page.click("#openPlus"); await page.clock.runFor(300);
  assert.match(await page.textContent("#plusPrice"), /14 days free, then \$19\.99 a year\./);
  assert.equal(await page.textContent("#plusBuy"), "Start free trial");
  await page.click("#plusBuy");
  assert.ok((await sent()).includes("purchase"), "asks the App Store");
  // The App Store says yes: Plus is on, AI is asked for once, then lines come from the server with the record.
  await page.evaluate(() => window.scalesStore({ active: true, jws: "signed-record", expires: Date.now() + 14 * 864e5, trial: true, renews: true, price: "$19.99", note: "bought" }));
  assert.ok(await until(page, async () => await page.$eval("#sheetConsent", (e) => e.open)), "AI consent asked after buying");
  await page.click("#consentYes");
  assert.ok(await until(page, async () => asked.includes("signed-record")), "the record goes with AI requests");
  assert.ok(asked.every((h) => h === "signed-record"));
});

test("Question it: the case against, then Let go puts it in the Ledger with the reason (1.79.0)", async () => {
  const page = await open({ prefs: ready, thoughts: { a: P("a", "Never complain. Never explain.", { why: "Excuses cost more than they buy." }), b: P("b", "Be present, need little.") } });
  if ((await words(page)) !== "Never complain. Never explain.") { await choose(page, "skip"); await choose(page, "skip"); }
  await page.click('[data-move="question"]'); await page.clock.runFor(300);
  assert.match(await page.textContent(".phase"), /The other side/);
  assert.match(await page.textContent(".qnotes"), /Excuses cost more than they buy\./, "your reason sits under the case");
  assert.deepEqual(await rows(page), ["Let go", "Revise", "Keep it"]);
  assert.ok((await page.textContent("#aiSrc")).length > 0, "a test question without Plus");
  await choose(page, "letgo");
  assert.equal(await page.$eval("#sheetLetGo", (e) => e.open), true);
  await page.fill("#letInput", "Explaining is how my team learns why.");
  await page.click("#confirmLetGo"); await page.clock.runFor(600);
  const t = (await saved(page)).a;
  assert.equal(t.status, "letgo"); assert.equal(t.letgo_why, "Explaining is how my team learns why.");
  await page.click("#tabLedger"); await page.clock.runFor(600);
  await page.click("[data-foldlet]"); await page.clock.runFor(200);
  assert.match(await page.textContent("#ledgerList"), /Explaining is how my team learns why\./);
  assert.deepEqual(page.errors, []);
});

test("Question it: Keep it counts as weighed and the next thought comes up (1.79.0)", async () => {
  const page = await open({ prefs: ready, thoughts: { a: P("a", "Rest is part of the work.", { skip_count: 2 }) } });
  await page.click('[data-move="question"]'); await page.clock.runFor(300);
  await choose(page, "qkeep"); await page.clock.runFor(600);
  const t = (await saved(page)).a;
  assert.equal(t.skip_count, 1); assert.equal(t.questioned, 1);
  assert.deepEqual(page.errors, []);
});
