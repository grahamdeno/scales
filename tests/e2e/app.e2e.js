// Browser check for Scales: Playwright, Chromium, phone sizes.
// Run: node tests/e2e/app.e2e.js   (serves the repo on a local port; screenshots go to $SHOTS or ./e2e-shots)
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const root = path.join(__dirname, "..", "..");
const shots = process.env.SHOTS || path.join(root, "e2e-shots");
fs.mkdirSync(shots, { recursive: true });
const types = { ".html": "text/html", ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json" };
const server = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); s.end(fs.readFileSync(f));
});

const old = {};
for (let i = 1; i <= 8; i++) old["a" + i] = { id: "a" + i, text: "Active thought number " + i, status: "active", skip_count: i === 3 ? 4 : 0, created_at: "2026-09-0" + i + "T00:00:00Z" };
old.s1 = { id: "s1", text: "A thought I lived", status: "shed", shed_at: "2026-09-20T00:00:00Z" };
old.l1 = { id: "l1", text: "A thought I let go", status: "letgo", letgo_at: "2026-09-21T00:00:00Z" };

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch();
  for (const w of [390, 375, 430]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    await page.addInitScript((o) => { if (!localStorage.getItem("scales.thoughts.v1") && !sessionStorage.getItem("seeded")) { localStorage.setItem("scales.thoughts.v1", JSON.stringify(o)); sessionStorage.setItem("seeded", "1"); } }, old);
    const tag = "[" + w + "] ";
    await page.goto(base + "/");
    await page.waitForSelector("#words:not(:empty)");
    const first = (await page.textContent("#words")).trim();
    ok(first === "Active thought number 3", tag + "most skipped thought comes first (" + first + ")");
    await page.screenshot({ path: path.join(shots, w + "-1-meet.png") });
    ok(/10\s*$/.test(await page.textContent("#strip")), tag + "strip shows the count of all 10 imported thoughts");

    const drag = async (dy) => {
      const b = await page.locator("#stage").boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
      await page.mouse.move(x, y); await page.mouse.down();
      for (let i = 1; i <= 12; i++) await page.mouse.move(x, y + (dy * i) / 12);
      await page.mouse.up(); await page.waitForTimeout(700);
    };
    // short pull springs back
    await drag(-50);
    ok((await page.textContent("#words")).trim() === first, tag + "short swipe springs back");
    // swipe up = next
    await drag(-160);
    const second = (await page.textContent("#words")).trim();
    ok(second !== first, tag + "swipe up moves to the next thought (" + second + ")");
    // swipe up shows Undo, and Undo brings the thought back
    ok(await page.locator("#toast.on").count() === 1 && /Moved on/.test(await page.textContent("#toast")), tag + "Moved on toast shows after swipe up");
    await page.click("#toastUndo"); await page.waitForTimeout(500);
    ok((await page.textContent("#words")).trim() === first, tag + "Undo after swipe up brings the thought back");
    await drag(-160);
    // pull down = put away + Undo
    await drag(220);
    const third = (await page.textContent("#words")).trim();
    ok(third !== second, tag + "pull down puts it away");
    ok(await page.locator("#toast.on").count() === 1, tag + "toast with Undo shows");
    ok(!(await page.locator("#toastDel").isVisible()), tag + "your own thoughts never offer Delete when put away");
    await page.screenshot({ path: path.join(shots, w + "-2-putaway-toast.png") });
    await page.click("#toastUndo"); await page.waitForTimeout(500);
    ok((await page.textContent("#words")).trim() === second, tag + "Undo brings it back");
    // a near miss on + New never opens Edit
    await page.mouse.click(165, 90); await page.waitForTimeout(700);
    ok(!(await page.locator("#vEdit").isVisible()), tag + "a tap just right of + New does not open Edit");
    if (await page.locator("#vWrite").isVisible()) { await page.click("#writeCancel"); await page.waitForTimeout(500); }
    // a swipe up that starts on the Home bar does not drag the sheet
    await page.mouse.move(w / 2, 840); await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(w / 2, 840 - i * 40);
    await page.mouse.up(); await page.waitForTimeout(600);
    ok(await page.locator("#lib.open").count() === 0, tag + "a swipe from the Home bar leaves the library shut");
    // tap = edit
    await page.mouse.click(w / 2, 400); await page.waitForTimeout(700);
    ok(await page.locator("#vEdit").isVisible(), tag + "tap opens edit");
    await page.click("#editDelete");
    ok((await page.textContent("#editDelete")).trim() === "Tap again to delete", tag + "Delete asks for a second tap");
    await page.mouse.click(w / 2, 700); await page.waitForTimeout(100);
    ok((await page.textContent("#editDelete")).trim() === "Delete", tag + "tapping elsewhere takes Delete back");
    await page.fill("#editNote", "A note from the test");
    await page.screenshot({ path: path.join(shots, w + "-3-edit.png") });
    // Done is a word, not a pill
    const dn = await page.evaluate(() => { const b = getComputedStyle(document.getElementById("editDone")); return { r: b.borderRadius, bg: b.backgroundColor, c: b.color }; });
    ok(dn.bg === "rgba(0, 0, 0, 0)" && parseFloat(dn.r) === 0 && dn.c === "rgb(185, 201, 163)", tag + "Done is plain pistachio text, not a pill (" + JSON.stringify(dn) + ")");
    // A long thought: the box grows to fit (nothing hidden inside it) and the form scrolls as a whole; Done stays in place
    const long = Array.from({ length: 40 }, (_, i) => "word" + i).join(" ") + " the end of a long thought";
    const doneY = (await page.locator("#editDone").boundingBox()).y;
    await page.fill("#editText", long); await page.waitForTimeout(150);
    const g = await page.evaluate(() => { const t = document.getElementById("editText"), f = t.parentNode; return { inner: t.scrollHeight - t.clientHeight, grew: t.clientHeight > 200, formScrolls: f.scrollHeight > f.clientHeight }; });
    ok(g.inner <= 1 && g.grew && g.formScrolls, tag + "a long thought grows its box to fit; the form scrolls (" + JSON.stringify(g) + ")");
    ok(Math.abs((await page.locator("#editDone").boundingBox()).y - doneY) < 1, tag + "Done stays where it was");
    await page.screenshot({ path: path.join(shots, w + "-3b-edit-long.png") });
    await page.evaluate(() => { const f = document.getElementById("editText").parentNode; f.scrollTop = f.scrollHeight; });
    await page.waitForTimeout(100);
    const nb = await page.locator("#editNote").boundingBox(), fb2 = await page.locator("#editDone").boundingBox();
    ok(nb.y + nb.height <= fb2.y + 2 && Math.abs(fb2.y - doneY) < 1, tag + "scrolled to the end, the note is reachable above Done, which has not moved");
    await page.screenshot({ path: path.join(shots, w + "-3c-edit-long-end.png") });
    await page.fill("#editText", "Active thought number 1"); await page.waitForTimeout(100);
    await page.click("#editDone"); await page.waitForTimeout(700);
    ok(await page.locator("#vMeet").isVisible(), tag + "Done returns to the thought");
    // write
    await page.click("#newBtn"); await page.waitForTimeout(700);
    ok(await page.locator("#vWrite").isVisible(), tag + "New opens write");
    ok(await page.evaluate(() => getComputedStyle(document.getElementById("writeKeep")).borderRadius === "0px"), tag + "Keep is a word too");
    await page.fill("#writeText", "A brand new thought from the check");
    await page.screenshot({ path: path.join(shots, w + "-4-write.png") });
    await page.click("#writeKeep"); await page.waitForTimeout(500);
    ok(await page.locator("#writeKept").isVisible(), tag + "Kept message shows");
    await page.screenshot({ path: path.join(shots, w + "-5-kept.png") });
    await page.waitForTimeout(2200);
    ok(await page.locator("#vMeet").isVisible(), tag + "back on the thought after Keep");
    // library: pull the strip up to open it, pull the header down to shut it
    const sb = await page.locator("#strip").boundingBox();
    const libTop = () => page.evaluate(() => document.getElementById("lib").getBoundingClientRect().top);
    ok(Math.abs(await libTop() - sb.y) < 1.5 && !(await page.locator("#lib").isVisible()), tag + "shut, the sheet rests on the strip, hidden (" + Math.round(await libTop()) + " vs " + Math.round(sb.y) + ")");
    await page.mouse.move(w / 2, sb.y + 30); await page.mouse.down();
    await page.mouse.move(w / 2, sb.y + 20); await page.mouse.move(w / 2, sb.y - 10);
    ok(Math.abs(await libTop() - (sb.y - 40)) < 2 && await page.locator("#lib").isVisible(), tag + "pulled 40 px, the sheet's top is 40 px above the strip's top, not rising from below");
    for (let i = 1; i <= 10; i++) await page.mouse.move(w / 2, sb.y + 30 - i * 40);
    await page.mouse.up(); await page.waitForTimeout(600);
    ok(await page.locator("#lib.open").count() === 1, tag + "pulling the strip up opens the library");
    const hb = await page.locator("#lib h2").boundingBox();
    await page.mouse.move(w / 2, hb.y + 5); await page.mouse.down();
    for (let i = 1; i <= 40; i++) await page.mouse.move(w / 2, hb.y + 5 + i * 30);
    ok(await libTop() <= sb.y + 1, tag + "pulled far down, the sheet stops at the strip (" + Math.round(await libTop()) + " vs " + Math.round(sb.y) + ")");
    await page.mouse.up(); await page.waitForTimeout(600);
    ok(await page.locator("#lib.open").count() === 0, tag + "pulling the sheet down shuts it");
    ok(Math.abs(await libTop() - sb.y) < 1.5 && !(await page.locator("#lib").isVisible()), tag + "shut again, the sheet is back on the strip and hidden");
    await page.mouse.move(w / 2, sb.y + 30); await page.mouse.down();
    for (let i = 1; i <= 3; i++) { await page.mouse.move(w / 2, sb.y + 30 - i * 15); await page.waitForTimeout(60); }
    await page.mouse.up(); await page.waitForTimeout(600);
    ok(await page.locator("#lib.open").count() === 0, tag + "a short pull springs back shut");
    await page.click("#strip"); await page.waitForTimeout(700);
    ok(await page.locator("#lib.open").count() === 1, tag + "tapping the strip opens the library");
    // 2.4.0: three filters; Put away is a quiet row at the foot of All, one tap to the archive and one back
    ok((await page.locator("#seg button").count()) === 3 && !(await page.locator('#seg [data-view="away"]').count()) && !(await page.locator('#seg [data-view="on"]').count()), tag + "the filters are All, New and Bookmarked");
    const segw0 = await page.evaluate(() => { const g = document.getElementById("seg"); return { sw: g.scrollWidth, cw: g.clientWidth }; });
    ok(segw0.sw <= segw0.cw + 40 && await page.locator("#segMarked").isVisible(), tag + "all three fit without scrolling (" + JSON.stringify(segw0) + ")");
    ok(/In rotation ·/.test(await page.textContent("#libList")) && !/Put away ·/.test(await page.textContent("#libList")) && (await page.locator("#libList .arch").count()) === 1, tag + "All shows what is in rotation, then one quiet Put away row");
    await page.click("#libList .arch"); await page.waitForTimeout(200);
    ok(!/In rotation ·/.test(await page.textContent("#libList")) && /Put away ·/.test(await page.textContent("#libList")), tag + "the Put away row opens only the put away thoughts");
    await page.screenshot({ path: path.join(shots, w + "-6b-library-away.png") });
    await page.click("#libList .arch"); await page.waitForTimeout(200);
    ok(/In rotation ·/.test(await page.textContent("#libList")), tag + "and the way back at the top returns to All");
    await page.fill("#q", "a"); await page.waitForTimeout(200);
    ok(/Put away ·/.test(await page.textContent("#libList")) && (await page.locator("#libList .arch").count()) === 0, tag + "a search looks at put away thoughts too");
    await page.fill("#q", ""); await page.waitForTimeout(200);
    // 2.2.0: New, Bookmarked, the scrolling filters, and the review rule
    const segw = await page.evaluate(() => { const g = document.getElementById("seg"); return { sw: g.scrollWidth, cw: g.clientWidth, page: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
    ok(segw.sw <= segw.cw && segw.page <= 0, tag + "the three filters fit their row, and the page does not scroll sideways (" + JSON.stringify(segw) + ")");
    await page.evaluate(() => { const g = document.getElementById("seg"); g.scrollLeft = g.scrollWidth; });
    ok(await page.locator('#segMarked').isVisible(), tag + "Bookmarked can be scrolled to");
    await page.click('#seg [data-view="new"]'); await page.waitForTimeout(200);
    ok(/Added in the last 14 days · /.test(await page.textContent("#libList")) && /A brand new thought from the check/.test(await page.textContent("#libList")), tag + "New lists what was added in the last 14 days");
    await page.click('#seg [data-view="all"]'); await page.waitForTimeout(100);
    ok((await page.textContent("#segMarked")).trim() === "Bookmarked", tag + "no count while nothing is bookmarked");
    await page.click("#libClose"); await page.waitForTimeout(600);
    const readUi = () => page.evaluate(() => JSON.parse(localStorage.getItem("scales.next.ui.v1")));
    const readT = (id) => page.evaluate((i) => JSON.parse(localStorage.getItem("scales.next.thoughts.v1"))[i], id);
    const cur = (await readUi()).cur;
    // Cancel leaves a bookmark as it was
    await page.mouse.click(w / 2, 400); await page.waitForTimeout(600);
    await page.click("#editMark");
    ok(await page.getAttribute("#editMark", "aria-pressed") === "true", tag + "Bookmark toggles on in Edit");
    await page.click("#editCancel"); await page.waitForTimeout(500);
    ok(!(await readT(cur)).bookmarked, tag + "Cancel leaves it unbookmarked");
    // Done applies it, and a bookmark alone changes nothing about the schedule
    const before0 = await readT(cur), worked0 = (await readUi()).worked;
    await page.mouse.click(w / 2, 400); await page.waitForTimeout(600);
    ok(await page.getAttribute("#editMark", "aria-pressed") === "false", tag + "Edit opens with the bookmark off");
    await page.click("#editMark"); await page.screenshot({ path: path.join(shots, w + "-3d-edit-bookmark.png") });
    await page.click("#editDone"); await page.waitForTimeout(500);
    const after0 = await readT(cur);
    ok(!!after0.bookmarked && after0.due === before0.due && after0.skips === before0.skips && after0.thinks === before0.thinks && after0.works === before0.works && after0.text === before0.text, tag + "Done sets the bookmark and changes nothing about the schedule");
    ok((await readUi()).worked === worked0, tag + "a bookmark alone does not count as work on the thought");
    // The library: count, filter, and the row mark
    await page.click("#strip"); await page.waitForTimeout(700);
    ok((await page.textContent("#segMarked")).trim() === "Bookmarked · 1", tag + "the Bookmarked filter shows the count");
    ok(await page.locator("#libList .bk").count() === 1, tag + "a bookmarked thought carries a small mark in the list");
    await page.evaluate(() => { const g = document.getElementById("seg"); g.scrollLeft = g.scrollWidth; });
    await page.click("#segMarked"); await page.waitForTimeout(200);
    ok(/Bookmarked · 1/.test(await page.textContent("#libList")) && (await page.locator("#libList [data-review]").count()) === 1, tag + "Bookmarked lists it, opened as a review");
    await page.screenshot({ path: path.join(shots, w + "-6c-library-bookmarked.png") });
    // A review changes nothing about when it comes back
    await page.click("#libList [data-review]"); await page.waitForTimeout(700);
    ok((await readUi()).review === cur && (await page.textContent("#words")).trim() === before0.text, tag + "tapping it opens it on screen as a review");
    const rev0 = await readT(cur), logN = (await page.evaluate(() => JSON.parse(localStorage.getItem("scales.next.log.v1") || "[]"))).length;
    await page.waitForTimeout(1200); await page.keyboard.press("ArrowUp"); await page.waitForTimeout(600);
    const rev1 = await readT(cur), lg2 = await page.evaluate(() => JSON.parse(localStorage.getItem("scales.next.log.v1") || "[]"));
    ok(JSON.stringify([rev1.due, rev1.skips, rev1.thinks, rev1.works, rev1.seen, (rev1.visits || []).length]) === JSON.stringify([rev0.due, rev0.skips, rev0.thinks, rev0.works, rev0.seen, (rev0.visits || []).length]), tag + "a review leaves due, skips, thinks, works and visits exactly as they were");
    ok(lg2.length === logN + 1 && lg2[lg2.length - 1].kind === "review" && lg2[lg2.length - 1].id === cur, tag + "the review is logged as a review, so the times review can leave it out");
    // A put-away thought can be reviewed too, and stays put away
    const awayId = await page.evaluate(() => { const o = JSON.parse(localStorage.getItem("scales.next.thoughts.v1")); const k = Object.keys(o).find((i) => o[i].away); o[k].bookmarked = new Date().toISOString(); localStorage.setItem("scales.next.thoughts.v1", JSON.stringify(o)); return k; });
    if (awayId) {
      await page.reload(); await page.waitForTimeout(900);
      await page.click("#strip"); await page.waitForTimeout(700);
      await page.evaluate(() => { const g = document.getElementById("seg"); g.scrollLeft = g.scrollWidth; });
      await page.click("#segMarked"); await page.waitForTimeout(200);
      ok(/Bookmarked · 2/.test(await page.textContent("#libList")) && /Put away/.test(await page.textContent("#libList")), tag + "a bookmarked thought that is put away is listed, marked Put away");
      await page.click('#libList .lrow.away[data-review]'); await page.waitForTimeout(700);
      const aw = await readT(awayId);
      ok((await page.textContent("#words")).trim() === aw.text && !!aw.away, tag + "a put-away thought can be reviewed on screen and stays put away");
      await page.keyboard.press("ArrowUp"); await page.waitForTimeout(600);
      ok(!!(await readT(awayId)).away && (await readT(awayId)).visits.length === aw.visits.length, tag + "after the review it is still put away and its history is unchanged");
      await page.click("#strip"); await page.waitForTimeout(700);
    } else { await page.click("#strip"); await page.waitForTimeout(700); }
    await page.click('#seg [data-view="all"]'); await page.waitForTimeout(200);
    // 2.3: after "That's all for today", three quiet ways to carry on, none of which changes a schedule
    const saved = await page.evaluate(() => localStorage.getItem("scales.next.thoughts.v1"));
    const soonId = await page.evaluate(() => {
      const o = JSON.parse(localStorage.getItem("scales.next.thoughts.v1")); const ids = Object.keys(o).filter((i) => !o[i].away);
      ids.forEach((i, n) => { o[i].due = "2099-01-" + String(10 + n).padStart(2, "0"); o[i].skips = 0; });
      localStorage.setItem("scales.next.thoughts.v1", JSON.stringify(o));
      const u = JSON.parse(localStorage.getItem("scales.next.ui.v1")); u.cur = null; u.review = null; localStorage.setItem("scales.next.ui.v1", JSON.stringify(u));
      return ids[0];
    });
    await page.reload(); await page.waitForTimeout(900);
    ok(await page.locator("#empty").isVisible() && /all for today/.test(await page.textContent("#empty")), tag + "nothing due shows the closing screen");
    ok(await page.locator("#earlyBtn").isVisible() && await page.locator("#earlyWrite").isVisible() && await page.locator("#earlyMarked").isVisible() && /Bookmarked · \d/.test(await page.textContent("#earlyMarked")), tag + "Meet one early, Write one and Bookmarked with its count are offered");
    const early0 = await readT(soonId);
    await page.click("#earlyBtn"); await page.waitForTimeout(700);
    ok((await page.textContent("#words")).trim() === early0.text && (await readUi()).review === soonId, tag + "Meet one early brings the one due soonest, as a review");
    await page.keyboard.press("ArrowUp"); await page.waitForTimeout(700);
    const early1 = await readT(soonId);
    ok(early1.due === early0.due && early1.skips === early0.skips && early1.thinks === early0.thinks && (early1.visits || []).length === (early0.visits || []).length, tag + "meeting it early leaves due, skips, thinks and visits as they were");
    ok(await page.locator("#empty").isVisible(), tag + "it returns to the closing screen, one thought at a time");
    await page.click("#earlyWrite"); await page.waitForTimeout(500);
    ok(await page.locator("#vWrite").isVisible(), tag + "Write one opens a new thought");
    await page.click("#writeCancel"); await page.waitForTimeout(500);
    await page.click("#earlyMarked"); await page.waitForTimeout(700);
    ok(await page.locator("#lib.open").count() === 1 && /Bookmarked · \d/.test(await page.textContent("#libList")), tag + "Bookmarked opens the library on its bookmarked list");
    await page.evaluate((v) => { localStorage.setItem("scales.next.thoughts.v1", v); }, saved);
    await page.reload(); await page.waitForTimeout(900);
    await page.click("#strip"); await page.waitForTimeout(700);
    await page.click('#seg [data-view="all"]'); await page.waitForTimeout(200);
    // Settings: reached from the gear, back returns to the library still open
    await page.click("#libGear"); await page.waitForTimeout(600);
    ok(await page.locator("#settings.open").count() === 1, tag + "the gear opens Settings");
    ok(!(await page.locator("#iconSec").isVisible()), tag + "no App icon choice in a browser");
    ok(/Back up/.test(await page.textContent("#settings")) && /Restore from a backup/.test(await page.textContent("#settings")), tag + "Settings has Back up and Restore");
    ok((await page.getAttribute("#setPrivacy", "href")) === "https://scales.tangomike.app/privacy", tag + "Privacy links to the site");
    ok((await page.getAttribute("#setSupport", "href")) === "https://scales.tangomike.app/support", tag + "Support links to the site");
    ok(/^mailto:support@tangomike\.app/.test(await page.getAttribute("#setFeedback", "href")) && /Scales%202\.5\.0/.test(await page.getAttribute("#setFeedback", "href")), tag + "Feedback is an email with the version");
    ok(/Scales 2\.5\.0/.test(await page.textContent("#setVersion")), tag + "Settings shows the version");
    await page.screenshot({ path: path.join(shots, w + "-8-settings.png") });
    const dl = page.waitForEvent("download", { timeout: 3000 });
    await page.click("#setBackup"); const d = await dl;
    const bk = JSON.parse(fs.readFileSync(await d.path(), "utf8"));
    ok(bk.app === "scales" && bk.version === "2.5.0" && Object.keys(bk.thoughts).length >= 10 && Array.isArray(bk.visits), tag + "Back up saves a file with the thoughts and the visit log");
    // Restore: a Scales 2 file adds what is missing, a repeat adds nothing, a bad file is refused
    const mk = (id, text) => ({ id, text, note: "", created: "2026-10-01T00:00:00.000Z", due: "2026-11-01", away: null, skips: 0, thinks: 0, works: 0, seen: null, visits: [] });
    const f2 = path.join(shots, "restore2.json"), f1 = path.join(shots, "restore1.json"), fb = path.join(shots, "bad.json");
    fs.writeFileSync(f2, JSON.stringify({ app: "scales", version: "2.1.0", thoughts: { r1: mk("r1", "Restored one"), r2: mk("r2", "Restored two") }, gone: [] }));
    fs.writeFileSync(f1, JSON.stringify({ app: "scales", version: 1, thoughts: { z1: { id: "z1", text: "From a Scales 1 backup", status: "active" } }, activity: {}, prefs: {} }));
    fs.writeFileSync(fb, JSON.stringify({ hello: "world" }));
    await page.setInputFiles("#restoreFile", f2); await page.waitForTimeout(400);
    ok((await page.textContent("#restoreMsg")).trim() === "Added 2 thoughts.", tag + "Restore adds the two new thoughts (" + (await page.textContent("#restoreMsg")).trim() + ")");
    await page.evaluate(() => { document.getElementById("restoreFile").value = ""; }); // what tapping the row does
    await page.setInputFiles("#restoreFile", f2); await page.waitForTimeout(400);
    ok((await page.textContent("#restoreMsg")).trim() === "Nothing new in that backup.", tag + "Restoring the same file again adds nothing");
    await page.setInputFiles("#restoreFile", f1); await page.waitForTimeout(400);
    ok((await page.textContent("#restoreMsg")).trim() === "Added 1 thought.", tag + "A Scales 1 backup restores too");
    await page.setInputFiles("#restoreFile", fb); await page.waitForTimeout(400);
    ok(/isn't a Scales backup/.test(await page.textContent("#restoreMsg")), tag + "A file that is not a backup is refused");
    // Restore review: a file from a later Scales is refused with its own words
    const fn = path.join(shots, "newer.json");
    fs.writeFileSync(fn, JSON.stringify({ app: "scales", version: "3.0.0", thoughts: { n1: mk("n1", "From the future") } }));
    await page.setInputFiles("#restoreFile", fn); await page.waitForTimeout(400);
    ok(/from a newer Scales/.test(await page.textContent("#restoreMsg")), tag + "A backup from a later Scales is refused, not misread");
    // Restore review: when the phone has no room, nothing changes
    const before = await page.evaluate(() => localStorage.getItem("scales.next.thoughts.v1"));
    const beforeGone = await page.evaluate(() => localStorage.getItem("scales.next.gone.v1"));
    await page.evaluate(() => { window.__set = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error("QuotaExceededError"); }; });
    const f3 = path.join(shots, "restore3.json");
    fs.writeFileSync(f3, JSON.stringify({ app: "scales", version: "2.1.0", thoughts: { q1: mk("q1", "No room for me") }, gone: ["qq"] }));
    await page.setInputFiles("#restoreFile", f3); await page.waitForTimeout(400);
    await page.evaluate(() => { Storage.prototype.setItem = window.__set; });
    ok(/wasn't room/.test(await page.textContent("#restoreMsg")) &&
      before === await page.evaluate(() => localStorage.getItem("scales.next.thoughts.v1")) &&
      beforeGone === await page.evaluate(() => localStorage.getItem("scales.next.gone.v1")) &&
      !/No room for me/.test(await page.textContent("#libList")), tag + "With no room to save, the restore changes nothing");
    // Restore review: the file Back up made, restored on a new phone, brings every thought across
    if (w === 390) {
      const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } }); const p2 = await ctx2.newPage();
      await p2.goto(base + "/"); await p2.waitForTimeout(600);
      await p2.evaluate(() => { localStorage.clear(); }); await p2.reload(); await p2.waitForTimeout(600);
      const n0 = await p2.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("scales.next.thoughts.v1") || "{}")).length);
      await p2.evaluate(() => { const i = document.getElementById("restoreFile"); i.value = ""; });
      await p2.setInputFiles("#restoreFile", await d.path()); await p2.waitForTimeout(500);
      const ids = await p2.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("scales.next.thoughts.v1") || "{}")));
      const want = Object.keys(bk.thoughts).filter((id) => !(bk.gone || []).includes(id));
      const bms = await p2.evaluate(() => { const o = JSON.parse(localStorage.getItem("scales.next.thoughts.v1") || "{}"); return Object.keys(o).filter((k) => o[k].bookmarked).sort(); });
      const wantBm = Object.keys(bk.thoughts).filter((k) => bk.thoughts[k].bookmarked).sort();
      ok(wantBm.length >= 1 && JSON.stringify(bms) === JSON.stringify(wantBm), tag + "bookmarks come across on a new phone (" + bms.length + " of " + wantBm.length + ")");
      ok(want.every((id) => ids.includes(id)), tag + "A Back up file restores every thought on a new phone (" + n0 + " before, " + ids.length + " after, " + want.length + " in the file)");
      await ctx2.close();
    }
    // Help, and back
    ok(!(await page.textContent("#settings")).includes("Help") || !/^Help$/m.test(await page.evaluate(() => Array.from(document.querySelectorAll("#settings .sh")).map((e) => e.textContent).join("\n"))), tag + "no Help or About headings");
    await page.click("#setHelp"); await page.waitForTimeout(500);
    ok(await page.locator("#help.open").count() === 1 && /20 seconds or less/.test(await page.textContent("#help")) && /30 seconds or more/.test(await page.textContent("#help")), tag + "How Scales works opens with the new times");
    await page.screenshot({ path: path.join(shots, w + "-9-help.png") });
    await page.click("#helpBack"); await page.waitForTimeout(500);
    ok(await page.locator("#help.open").count() === 0 && await page.locator("#settings.open").count() === 1, tag + "Help goes back to Settings");
    await page.click("#setBack"); await page.waitForTimeout(500);
    ok(await page.locator("#settings.open").count() === 0 && await page.locator("#lib.open").count() === 1, tag + "Settings goes back to the library, still open");
    ok(/Restored one/.test(await page.textContent("#lib")), tag + "the library shows what was restored");
    await page.screenshot({ path: path.join(shots, w + "-6-library.png") });
    const lib = await page.textContent("#lib");
    await page.click("#libList .arch"); await page.waitForTimeout(200);
    const libAway = await page.textContent("#lib");
    await page.click("#libList .arch"); await page.waitForTimeout(200);
    ok(/brand new thought/.test(lib) && /A thought I lived/.test(libAway), tag + "library lists the new thought, and the put-away ones behind the Put away row");
    await page.fill("#q", "lived"); await page.waitForTimeout(300);
    ok(!/Active thought number 1/.test(await page.textContent("#lib")) && /A thought I lived/.test(await page.textContent("#lib")), tag + "search filters");
    await page.click("#lib [data-back]"); await page.waitForTimeout(300);
    ok(!(await page.locator('#lib .lrow.away .back').count()), tag + "Bring back moves it into rotation");
    await page.screenshot({ path: path.join(shots, w + "-7-library-search.png") });
    // old data untouched
    const after = await page.evaluate(() => localStorage.getItem("scales.thoughts.v1"));
    ok(JSON.stringify(JSON.parse(after)) === JSON.stringify(old), tag + "Scales 1's data unchanged");
    ok(errs.length === 0, tag + "no console errors" + (errs.length ? ": " + errs.join(" | ") : ""));
    await ctx.close();
  }
  // 2.3.0: a first open with nothing in it; the example, Start with five, who said it, and Sets
  for (const w of [390, 375]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    const tag = "[" + w + " first] ";
    const store = () => page.evaluate(() => JSON.parse(localStorage.getItem("scales.next.thoughts.v1") || "{}"));
    await page.goto(base + "/"); await page.waitForTimeout(900);
    ok(await page.locator("#vWrite").isVisible() && !(await page.locator("#writeCancel").isVisible()), tag + "an empty Scales opens on Write, with no Cancel");
    ok((await page.getAttribute("#writeText", "placeholder")) === "I do my best thinking before I check my phone.", tag + "the first Write shows the example");
    ok(await page.locator("#startFive").isVisible() && /start with five/i.test(await page.textContent("#startFive")), tag + "Or start with five is offered");
    ok(!(await page.evaluate(() => document.activeElement && document.activeElement.id === "writeText")), tag + "the keyboard does not jump up over the example");
    await page.screenshot({ path: path.join(shots, w + "-first-write.png") });
    await page.click("#writeText");
    ok((await page.getAttribute("#writeText", "placeholder")) === "", tag + "tapping the field clears the example");
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(ov <= 0, tag + "no sideways scroll on the first Write (" + ov + ")");
    await page.click("#startFive"); await page.waitForTimeout(900);
    const s5 = await store();
    ok(Object.keys(s5).length === 5 && Object.keys(s5).every((k) => k.startsWith("s-")), tag + "Start with five adds the five starters");
    ok(await page.locator("#vMeet").isVisible() && (await page.textContent("#words")).trim().length > 0, tag + "and opens the first one");
    const shown = (await page.textContent("#words")).trim();
    const st = Object.values(s5).find((t) => t.text === shown);
    ok(st && (st.by ? (await page.textContent("#by")).trim() === st.by && await page.locator("#by").isVisible() : !(await page.locator("#by").isVisible())), tag + "who said it shows under a quote (" + (st && st.by) + ")");
    await page.screenshot({ path: path.join(shots, w + "-first-meet.png") });
    // A set line not yet kept can be deleted straight from the Put away message, and leaves no trace
    const dropId = st.id;
    await page.keyboard.press("ArrowDown"); await page.waitForTimeout(700);
    ok(await page.locator("#toastDel").isVisible() && /Put away/.test(await page.textContent("#toast")), tag + "putting away a new set line offers Delete");
    await page.screenshot({ path: path.join(shots, w + "-toast-delete.png") });
    await page.click("#toastDel"); await page.waitForTimeout(300);
    const afterDrop = await store();
    const logIds = await page.evaluate(() => JSON.parse(localStorage.getItem("scales.next.log.v1") || "[]").map((e) => e.id));
    ok(!afterDrop[dropId] && !logIds.includes(dropId), tag + "Delete removes it and its visits");
    ok(/Deleted\. It won't come back\./.test(await page.textContent("#toast")) && await page.locator("#toast.on.done").count() === 1 && !(await page.locator("#toastUndo").isVisible()), tag + "and says so clearly, with no Undo");
    await page.screenshot({ path: path.join(shots, w + "-toast-deleted.png") });
    ok(/4\s*$/.test(await page.textContent("#strip")), tag + "and the count drops to 4");
    await page.waitForTimeout(3000);
    // A new thought typed with a quotation mark opens the Who said it line
    await page.click("#newBtn"); await page.waitForTimeout(500);
    ok(!(await page.locator("#startFive").isVisible()), tag + "Start with five is gone once there are thoughts");
    ok((await page.getAttribute("#writeText", "placeholder")) === "What's on your mind?", tag + "the example never shows again");
    ok(!(await page.locator("#writeBy").isVisible()) && await page.locator("#writeByAdd").isVisible(), tag + "Who said it starts as a quiet link");
    await page.fill("#writeText", "\u201CThe obstacle is the way.");
    await page.dispatchEvent("#writeText", "input");
    ok(await page.locator("#writeBy").isVisible(), tag + "an opening quotation mark opens the Who said it line");
    await page.fill("#writeBy", "  A friend ");
    await page.click("#writeKeep"); await page.waitForTimeout(1900);
    const mine = Object.values(await store()).find((t) => t.text === "\u201CThe obstacle is the way.");
    ok(mine && mine.by === "A friend", tag + "Keep saves who said it");
    await page.click("#newBtn"); await page.waitForTimeout(400);
    await page.fill("#writeText", "My own line"); await page.dispatchEvent("#writeText", "input");
    ok(!(await page.locator("#writeBy").isVisible()), tag + "a plain thought leaves the line closed");
    await page.click("#writeKeep"); await page.waitForTimeout(1900);
    ok(Object.values(await store()).find((t) => t.text === "My own line").by === "", tag + "a thought with no name is your own");
    // Edit changes who said it without counting as work
    await page.click("#strip"); await page.waitForTimeout(700);
    await page.fill("#q", "obstacle"); await page.waitForTimeout(200);
    await page.click('#libList [data-open="' + mine.id + '"]'); await page.waitForTimeout(800);
    await page.mouse.click(w / 2, 400); await page.waitForTimeout(700);
    ok(await page.locator("#vEdit").isVisible() && (await page.inputValue("#editBy")) === "A friend", tag + "Edit shows who said it");
    await page.fill("#editBy", "Ryan"); await page.click("#editDone"); await page.waitForTimeout(500);
    const ui1 = await page.evaluate(() => JSON.parse(localStorage.getItem("scales.next.ui.v1")));
    ok((await store())[mine.id].by === "Ryan" && !ui1.worked && (await page.textContent("#by")).trim() === "Ryan", tag + "Edit saves who said it and it is not counted as work");
    // Sets in Settings
    await page.click("#strip"); await page.waitForTimeout(700);
    await page.click("#libGear"); await page.waitForTimeout(600);
    ok(/Sets/.test(await page.textContent("#setSets")) && await page.locator("#setSets").isVisible(), tag + "Settings has a Sets row");
    await page.click("#setSets"); await page.waitForTimeout(600);
    ok(await page.locator("#sets.open").count() === 1, tag + "Sets opens its own page");
    ok((await page.locator("#setList .setr").count()) === 5, tag + "the Sets page lists the five sets");
    ok(/13 lines · Benjamin Franklin/.test(await page.locator('#setList [data-set="franklin"]').textContent()) && /Written for Scales/.test(await page.locator('#setList [data-set="questions"]').textContent()), tag + "each set says how many lines and from whom");
    const fr = page.locator('#setList [data-set="franklin"]');
    ok(/Add$/.test((await page.locator('#setList [data-set="jung"]').textContent()).trim()), tag + "a set not yet added says Add");
    const stoics = page.locator('#setList [data-set="stoics"]');
    ok(/Add$/.test((await stoics.textContent()).trim()), tag + "a set with only its starter lines here still says Add");
    await page.screenshot({ path: path.join(shots, w + "-settings-sets.png") });
    await fr.click(); await page.waitForTimeout(300);
    const s13 = Object.values(await store()).filter((t) => t.set === "franklin");
    ok(s13.length === 13 && /1[23] lines added/.test(await page.textContent("#setsMsg")), tag + "Add the rest brings in the other 12 of 13 lines");
    ok(/Remove$/.test((await page.locator('#setList [data-set="franklin"]').textContent()).trim()), tag + "then it offers Remove");
    await page.locator('#setList [data-set="franklin"]').click(); await page.waitForTimeout(200);
    ok(/Tap again to remove/.test(await page.locator('#setList [data-set="franklin"]').textContent()), tag + "Remove asks for a second tap");
    ok(Object.values(await store()).filter((t) => t.set === "franklin").length === 13, tag + "one tap removes nothing");
    await page.locator('#setList [data-set="franklin"]').click(); await page.waitForTimeout(300);
    ok(Object.values(await store()).filter((t) => t.set === "franklin" && !t.away).length === 0 && /removed/.test(await page.textContent("#setsMsg")), tag + "the second tap removes the unseen lines");
    const ov2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(ov2 <= 0, tag + "no sideways scroll in Settings (" + ov2 + ")");
    // Delete the ones you put away, from the Sets page
    await page.locator('#setList [data-set="stoics"]').click(); await page.waitForTimeout(300);
    await page.evaluate(() => { const o = JSON.parse(localStorage.getItem("scales.next.thoughts.v1")); ["s-ep-power", "s-ep-demand", "s-ep-lost"].forEach((k) => { o[k].away = new Date().toISOString(); }); o["s-ep-lost"].note = "mine"; localStorage.setItem("scales.next.thoughts.v1", JSON.stringify(o)); });
    await page.reload(); await page.waitForTimeout(900);
    await page.click("#strip"); await page.waitForTimeout(700); await page.click("#libGear"); await page.waitForTimeout(500); await page.click("#setSets"); await page.waitForTimeout(500);
    const clr = page.locator('#setList [data-clear="stoics"]');
    ok(await clr.isVisible() && /Delete the 2 you put away/.test(await clr.textContent()), tag + "a set with put-away lines offers to delete them (" + (await clr.textContent()) + ")");
    await clr.click(); await page.waitForTimeout(200);
    ok(/Tap again/.test(await page.locator('#setList [data-clear="stoics"]').textContent()), tag + "it asks for a second tap");
    await page.locator('#setList [data-clear="stoics"]').click(); await page.waitForTimeout(300);
    const sc = await store();
    ok(!sc["s-ep-power"] && !sc["s-ep-demand"] && sc["s-ep-lost"] && sc["s-ep-views"] && !(await page.locator('#setList [data-clear="stoics"]').count()), tag + "it deletes those two and keeps the one with a note");
    await page.screenshot({ path: path.join(shots, w + "-sets-page.png") });
    // How Scales works: three demos and bold action words
    await page.click("#setsBack"); await page.waitForTimeout(500); await page.click("#setHelp"); await page.waitForTimeout(700);
    ok((await page.locator("#help .demo").count()) === 3 && (await page.locator("#help strong").count()) >= 6 && (await page.locator("#help .demo.play").count()) >= 1, tag + "How Scales works shows three moves and plays them");
    await page.screenshot({ path: path.join(shots, w + "-help.png") });
    ok(!errs.length, tag + "no page errors (" + errs.join(" | ") + ")");
    await ctx.close();
  }
  // 2.5.0: Dark. The reading ground turns plum with bone words; the plum screens go deeper; pistachio stays the accent
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", deviceScaleFactor: 2, hasTouch: true });
    const page = await ctx.newPage();
    await page.addInitScript((o) => { if (!sessionStorage.getItem("d")) { localStorage.setItem("scales.thoughts.v1", JSON.stringify(o)); sessionStorage.setItem("d", "1"); } }, old);
    await page.goto(base + "/"); await page.waitForSelector("#words:not(:empty)"); await page.waitForTimeout(600);
    const meet = await page.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, ink: getComputedStyle(document.getElementById("words")).color, theme: document.getElementById("themeColor").content }));
    ok(meet.bg === "rgb(59, 34, 64)" && meet.ink === "rgb(241, 233, 216)", "dark: Meet is plum with bone words (" + JSON.stringify(meet) + ")");
    const strip = await page.evaluate(() => getComputedStyle(document.getElementById("strip")).backgroundColor);
    ok(strip !== meet.bg, "dark: the strip is a deeper plum than the ground (" + strip + ")");
    await page.screenshot({ path: path.join(shots, "dark-1-meet.png") });
    // Line breaks typed into a thought show on the main screen
    await page.click("#newBtn"); await page.waitForTimeout(400);
    await page.fill("#writeText", "1.\tSpeak the truth.\n\n\n\n2.\tBe reliable."); await page.dispatchEvent("#writeText", "input");
    await page.click("#writeKeep"); await page.waitForTimeout(1900);
    const lbId = await page.evaluate(() => { const o = JSON.parse(localStorage.getItem("scales.next.thoughts.v1")); return Object.keys(o).find((k) => /Be reliable/.test(o[k].text)); });
    await page.click("#strip"); await page.waitForTimeout(700); await page.click('#libList [data-open="' + lbId + '"]'); await page.waitForTimeout(800);
    const lb = await page.evaluate(() => ({ ws: getComputedStyle(document.getElementById("words")).whiteSpace, t: document.getElementById("words").textContent, h: document.getElementById("words").getBoundingClientRect().height }));
    ok(lb.ws === "pre-line" && lb.t === "1.\tSpeak the truth.\n\n2.\tBe reliable." && lb.h > 60, "line breaks show as typed, with extra empty lines kept to one (" + JSON.stringify(lb) + ")");
    await page.screenshot({ path: path.join(shots, "linebreaks.png") });
    await page.keyboard.press("ArrowDown"); await page.waitForTimeout(700);
    const tb = await page.evaluate(() => getComputedStyle(document.getElementById("toast")).backgroundColor);
    ok(tb === "rgb(185, 201, 163)", "dark: the Put away message is pistachio so it shows on plum (" + tb + ")");
    await page.screenshot({ path: path.join(shots, "dark-2-toast.png") });
    await page.click("#toastUndo"); await page.waitForTimeout(500);
    await page.mouse.click(195, 400); await page.waitForTimeout(700);
    const ed = await page.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, theme: document.getElementById("themeColor").content }));
    ok(ed.bg !== meet.bg && /23132A/i.test(ed.theme), "dark: Edit is the deeper plum, and the browser bar follows it (" + JSON.stringify(ed) + ")");
    await page.screenshot({ path: path.join(shots, "dark-3-edit.png") });
    await page.click("#editCancel"); await page.waitForTimeout(500);
    await page.click("#strip"); await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(shots, "dark-4-library.png") });
    await page.click("#libGear"); await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(shots, "dark-5-settings.png") });
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "light" });
    const page = await ctx.newPage();
    await page.addInitScript((o) => { if (!sessionStorage.getItem("l")) { localStorage.setItem("scales.thoughts.v1", JSON.stringify(o)); sessionStorage.setItem("l", "1"); } }, old);
    await page.goto(base + "/"); await page.waitForSelector("#words:not(:empty)");
    ok((await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === "rgb(185, 201, 163)", "light: Meet is still pistachio");
    await ctx.close();
  }
  // the iPhone app's bridge: ready, quiet reminders, daily save with the old data, and the put away buzz
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.addInitScript((o) => {
      window.__posts = [];
      window.webkit = { messageHandlers: { scales: { postMessage: (m) => window.__posts.push(m) } } };
      if (!sessionStorage.getItem("s")) { localStorage.setItem("scales.thoughts.v1", JSON.stringify(o)); sessionStorage.setItem("s", "1"); }
    }, old);
    await page.goto(base + "/?native=1"); await page.waitForTimeout(2000);
    const types = await page.evaluate(() => window.__posts.map((m) => m.type));
    ok(["ready", "unschedule", "badge", "save"].every((t) => types.includes(t)), "native: ready, unschedule, badge and save sent (" + types.join(",") + ")");
    const saved = await page.evaluate(() => JSON.parse(window.__posts.find((m) => m.type === "save").json));
    ok(saved.scales1 && saved.scales1["scales.thoughts.v1"] && Object.keys(saved.thoughts).length === 10, "native: daily save carries both apps' thoughts");
    await page.keyboard.press("ArrowUp"); await page.waitForTimeout(500);
    const lg = await page.evaluate(() => JSON.parse(localStorage.getItem("scales.next.log.v1") || "[]"));
    ok(lg.length === 1 && lg[0].how === "next" && typeof lg[0].ms === "number" && lg[0].lines.length === 2, "visit log records the move with its raw time");
    await page.evaluate(() => { window.__posts.length = 0; });
    await page.keyboard.press("ArrowDown"); await page.waitForTimeout(400);
    const hs = await page.evaluate(() => window.__posts.filter((m) => m.type === "haptic").map((m) => m.style));
    ok(hs.join(",") === "thud,letgo", "native: put away buzzes thud then letgo (" + hs.join(",") + ")");
    // App icon: shown only in the iPhone app; a choice is sent to the shell, and the shell's answer marks it
    await page.waitForTimeout(5300); await page.click("#strip"); await page.waitForTimeout(600); await page.click("#libGear"); await page.waitForTimeout(500);
    ok(await page.locator("#iconSec").isVisible(), "native: Settings shows App icon");
    await page.evaluate(() => { window.__posts.length = 0; window.scalesIcon("auto"); });
    await page.click('[data-icon="plum"]'); await page.waitForTimeout(100);
    const ic = await page.evaluate(() => window.__posts.filter((m) => m.type === "icon"));
    ok(ic.length === 1 && ic[0].name === "plum" && await page.getAttribute('[data-icon="plum"]', "aria-checked") === "true", "native: choosing Plum asks the shell for the plum icon");
    await page.evaluate(() => window.scalesIcon("bone"));
    ok(await page.getAttribute('[data-icon="bone"]', "aria-checked") === "true" && await page.getAttribute('[data-icon="plum"]', "aria-checked") === "false", "native: the shell's answer marks the icon that is on");
    await page.click('[data-icon="auto"]'); await page.waitForTimeout(100);
    ok((await page.evaluate(() => window.__posts.filter((m) => m.type === "icon").pop())).name === "", "native: Automatic asks for the main icon");
    await page.screenshot({ path: path.join(shots, "native-settings-icons.png") });
    await ctx.close();
  }
  // the trial address forwards home and keeps ?native=1
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(base + "/next/?native=1"); await page.waitForTimeout(800);
    ok(new URL(page.url()).pathname === "/" && new URL(page.url()).search === "?native=1", "/next/ forwards to / with ?native=1 (" + page.url() + ")");
    await ctx.close();
  }
  await browser.close(); server.close();
  console.log(fails ? fails + " FAILED" : "ALL PASSED");
  process.exit(fails ? 1 : 0);
})();
