// Browser tests for the main loop (1.68.0). They drive the real page in Chromium at iPhone size:
// first run, the hold and its choices, Skip and its pushback, tap to see the line, Later and its return,
// Sit with it and Undo, Capture, and Undo going away. Run with: node --test tests/e2e/loop.e2e.js
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
// A page at iPhone size with the given saved prefs and principles, the clock set to `at`. No network.
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
// Press and hold the bottom of the screen until the choices open, then let go (they stay open to tap).
async function hold(page) {
  const box = await (await page.$("#holdZone")).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.clock.runFor(700); await page.mouse.up(); await page.clock.runFor(100);
}
// Advance the page clock in small steps until check() passes, so a slow machine does not fail a test.
async function until(page, check, steps = 40) {
  // Real time too (1.71.0): a mocked network answer needs the event loop, not just the page clock.
  for (let i = 0; i < steps; i++) { if (await check()) return true; await page.clock.runFor(250); await page.waitForTimeout(50); }
  return check();
}
const rows = (page) => page.$$eval("#choices .pickrow span", (s) => s.map((x) => x.textContent));
const ready = { onboarded: true, coach_seen: true };

test("first run: welcome, a starter deck, the hold, then the deck", async () => {
  const page = await open();
  assert.match(await page.textContent(".welcome h1"), /Scales/);
  await page.click("#wNext");
  await page.click('[data-starter="stoic"]'); await page.clock.runFor(300);
  assert.match(await page.textContent(".welcome h1"), /Press and hold/);
  await page.click("#wDone"); await page.clock.runFor(300);
  assert.ok((await words(page)).length > 10, "a principle is on screen");
  assert.ok(Object.keys(await saved(page)).length >= 5, "the starter deck was added");
  assert.deepEqual(page.errors, []);
});

test("the hold opens three choices; a quick tap on the hold area chooses nothing", async () => {
  const page = await open({ prefs: ready, thoughts: { a: P("a", "Say the hard thing early.") } });
  const box = await (await page.$("#holdZone")).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await page.clock.runFor(300);
  assert.equal(await page.$eval("#choices", (e) => e.hidden), true, "a tap does not open the choices");
  await hold(page);
  assert.deepEqual(await rows(page), ["Living it", "Sit with it", "Skip"]);
  assert.equal(await page.$("#scrollHint"), null, "a short principle has no scroll hint");
});

test("Skip without the tap asks first; Skip it rests the principle", async () => {
  const page = await open({ prefs: ready, thoughts: { a: P("a", "One."), b: P("b", "Two.") } });
  const first = await words(page);
  await hold(page); await page.click('#choices [data-pick="skip"]'); await page.clock.runFor(300);
  assert.match(await page.textContent("#card .phase"), /Skip this one\?/);
  await hold(page);
  assert.ok((await rows(page)).includes("Skip it"));
  await page.click('#choices [data-pick="skip"]'); await page.clock.runFor(800);
  const t = Object.values(await saved(page)).find((x) => x.text === first);
  assert.equal(t.skip_count, 1);
  assert.notEqual(await words(page), first, "the next principle is up");
});

test("tap to see the line: then Skip it rests straight away and Later is offered", async () => {
  const page = await open({ prefs: ready, thoughts: { a: P("a", "One."), b: P("b", "Two.") } });
  const first = await words(page);
  await page.click("#words"); await page.clock.runFor(300);
  assert.ok((await page.textContent("#aiLine")).length > 5, "the line shows");
  await hold(page);
  assert.deepEqual(await rows(page), ["Living it", "Sit with it", "Later", "Skip it"]);
  await page.click('#choices [data-pick="later"]'); await page.clock.runFor(500);
  const t = Object.values(await saved(page)).find((x) => x.text === first);
  assert.ok(t.later, "saved for later");
  assert.equal(t.skip_count, 0, "Later is not a skip");
});

test("a principle back from Later waits for a choice and counts nothing", async () => {
  const page = await open({ prefs: ready, at: new Date(2026, 9, 27, 20, 50),
    thoughts: { a: P("a", "Back from earlier.", { later: { day: "2026-10-27", at: "" } }), b: P("b", "Other.") } });
  assert.match(await page.textContent("#card .phase"), /Saved from earlier/);
  assert.equal(await words(page), "Back from earlier.", "the principle is on screen");
  await page.clock.runFor(9000);
  assert.equal((await saved(page)).a.reflect_count, 0, "nothing counted on its own");
  await hold(page);
  assert.deepEqual(await rows(page), ["Living it", "Sit with it", "Skip it"]);
});

test("Sit with it counts after eight seconds, and Undo puts it back", async () => {
  // One principle, so the deck's weighted draw cannot put a different one on screen.
  const page = await open({ prefs: ready, thoughts: { a: P("a", "One.", { skip_count: 2, lifetime_skips: 2 }) } });
  await hold(page); await page.click('#choices [data-pick="keep"]');
  assert.ok(await until(page, async () => /Sitting with it/.test(await page.textContent("#card .phase").catch(() => ""))), "the Sit with it screen");
  await page.clock.runFor(8000);
  assert.ok(await until(page, async () => /Counted as Sit with it/.test(await page.textContent("#reflFoot").catch(() => ""))), "counted after eight seconds");
  assert.equal((await saved(page)).a.skip_count, 1, "one lighter");
  await page.click("#reflUndo");
  assert.ok(await until(page, async () => (await saved(page)).a.skip_count === 2), "undone");
  assert.equal((await saved(page)).a.reflect_count, 0);
});

test("Capture adds a principle from the + button", async () => {
  const page = await open({ prefs: ready, thoughts: { a: P("a", "One.") } });
  await page.click("#addTop"); await page.clock.runFor(300);
  await page.fill("#thoughtInput", "Finish what I start.");
  await page.click("#addBtn"); await page.clock.runFor(300);
  assert.ok(Object.values(await saved(page)).some((t) => t.text === "Finish what I start."));
});

test("Undo goes away after eight seconds", async () => {
  const page = await open({ prefs: ready, thoughts: { a: P("a", "One."), b: P("b", "Two.") } });
  await page.click("#words"); await page.clock.runFor(200);
  await hold(page); await page.click('#choices [data-pick="later"]'); await page.clock.runFor(500);
  assert.ok(await page.$("#toastUndo"), "Undo is there");
  await page.clock.runFor(8500);
  assert.equal(await page.$("#toastUndo"), null, "and gone");
});

test("a long principle stays between the top and the hold, and the top says how many are left", async () => {
  const long = Array.from({ length: 6 }, (_, i) => "Part " + (i + 1) + "\nA line long enough to wrap across the screen more than once, so the whole principle is tall.").join("\n\n");
  const page = await open({ prefs: ready, thoughts: { a: P("a", long), b: P("b", "Two."), c: P("c", "Three.") } });
  await page.clock.runFor(300);
  const box = await page.evaluate(() => { const b = (id) => document.getElementById(id).getBoundingClientRect(); return { words: b("words"), card: b("card") }; });
  if ((await words(page)).startsWith("Part")) {
    assert.ok(box.words.top >= box.card.top - 1 && box.words.bottom <= box.card.bottom + 1, "the principle fits inside its area");
  }
  assert.match(await page.textContent("#todayLbl"), /3 left today/);
});

test("the welcome hides + and the menu; Sit with it shows a question when no quote fits", async () => {
  let page = await open();
  assert.equal(await page.$eval("#addTop", (e) => e.hidden), true);
  assert.equal(await page.$eval("#menuBtn", (e) => e.hidden), true);
  page = await open({ prefs: ready, thoughts: { a: P("a", "One.") } });
  assert.equal(await page.$eval("#menuBtn", (e) => e.hidden), false);
  await hold(page); await page.click('#choices [data-pick="keep"]');
  assert.ok(await until(page, async () => ((await page.textContent("#aiLine").catch(() => "")) || "").endsWith("?")), "a question to sit with");
  assert.match(await page.getAttribute("#feedbackLink", "href"), /^mailto:support@tangomike\.app\?subject=Scales%20feedback/);
});

test("Reply: without AI the reply is kept; with AI today's voice answers in the thread (1.71.0)", async () => {
  let page = await open({ prefs: ready, thoughts: { a: P("a", "One.") } });
  await page.click("#words"); await page.clock.runFor(300);
  await page.click("#replyBtn"); await page.fill("#replyInput", "In the meeting."); await page.click("#replyDone");
  assert.ok(await until(page, async () => (await saved(page)).a.replies.length === 1), "kept");
  assert.equal(await page.$eval("#sheetWeigh", (e) => e.open), false, "no thread without AI");

  const answer = "Then say it before the meeting starts. What are you protecting by waiting?";
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => /api\.anthropic\.com/.test(r.request().url())
    ? r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: [{ type: "text", text: answer }], stop_reason: "end_turn" }) })
    : r.abort());
  page = await ctx.newPage();
  await page.clock.install({ time: new Date(2026, 9, 27, 9, 0) });
  await page.addInitScript(([p, t, k]) => {
    localStorage.setItem("scales.prefs.v1", JSON.stringify(p)); localStorage.setItem("scales.thoughts.v1", JSON.stringify(t)); localStorage.setItem(k, "sk-ant-test");
  }, [Object.assign({ ai_consent: true }, ready), { a: P("a", "One.") }, "scales.apikey.v1"]);
  await page.goto(base); await page.clock.runFor(500);
  await page.click("#words");
  assert.ok(await until(page, async () => !!(await page.$("#replyBtn"))), "the line and Reply");
  await page.click("#replyBtn");
  assert.match(await page.textContent("#replyNote"), /answers\./);
  await page.fill("#replyInput", "In the meeting."); await page.click("#replyDone");
  assert.ok(await until(page, async () => ((await page.textContent("#talkLog").catch(() => "")) || "").includes(answer)), "the voice answered");
  const t = (await saved(page)).a;
  assert.equal(t.talks.length, 1); assert.equal(t.talks[0].reply, true);
  assert.deepEqual(t.talks[0].turns.map((x) => x.me), [true, false]);
  assert.equal(await page.$eval("#talkForm", (e) => e.hidden), false, "you can keep going");
});
