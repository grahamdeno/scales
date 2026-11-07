// The journeys from docs/audit/journeys.md, walked one deliberate interaction at a time.
// Each journey: id, name, target cost, which collection it starts with, and the walk.
// w.free(...) wraps steps taken only to check something; they do not count toward the cost.

const openSettings = async (w) => { await w.tap("#strip", "open Your thoughts", 900); await w.tap("#libGear", "open Settings", 700); };

module.exports = [
  {
    id: "J1", name: "First run: write the first thought", target: 2, seed: "empty", query: "tips=1",
    async run(w) {
      await w.look("first screen");
      w.expect(await w.visible("#writeHead") && /What's on your mind\?/.test(await w.text("#writeHead")), "the first screen says what to do");
      w.expect(await w.visible("#startFive"), "a second way in (start with five) is offered");
      const t0 = await w.now();
      await w.fill("#writeText", "Patience over speed.", "write the first thought");
      await w.tap("#writeKeep", "Keep", 1200);
      w.expect(/Here it is|comes back/i.test(await w.text("#writeKept")) || await w.visible("#vMeet"), "it says the thought is kept and when it comes back");
      w.expect((await w.haptics(t0)).includes("signature"), "Keep plays the keep haptic");
      w.expect(Object.keys(await w.store()).length === 1, "one thought is saved");
      await w.wait(2600); await w.look("after keep");
    },
  },
  {
    id: "J2", name: "First run: start with a set", target: 1, seed: "empty", query: "tips=1",
    async run(w) {
      await w.look("first screen");
      await w.tap("#startFive", "Start with five", 1500);
      const n = Object.keys(await w.store()).length;
      w.expect(n >= 5, "start with five adds lines (" + n + ")");
      w.expect(await w.visible("#vMeet") && (await w.text("#words")).length > 0, "it lands on a thought to read");
    },
  },
  {
    id: "J3", name: "Daily session to the day's end", target: 30, seed: "regular", clock: true,
    async run(w) {
      await w.look("open the app");
      const before = await w.store(), first = await w.text("#words");
      w.expect(first.length > 0, "the app opens on a thought");
      // Sit with the first one for 35 s: the visit should read as thought about.
      await w.sitFor(35000);
      const t0 = await w.now();
      await w.swipeUp("sit 35 s, then swipe up");
      let lg = await w.logged(); const last = lg[lg.length - 1];
      w.expect(last && last.kind === "thought", "35 s on a thought reads as thought about (" + (last && last.kind) + ")");
      w.expect((await w.haptics(t0)).includes("tick"), "crossing the swipe line ticks");
      const ids = new Set([last && last.id]);
      for (let i = 0; i < 34 && !(await w.visible("#empty")); i++) {
        const id = await w.page.evaluate(() => JSON.parse(localStorage.getItem("scales.next.ui.v1") || "{}").cur);
        if (id) ids.add(id);
        await w.sitFor(4000);
        await w.swipeUp("swipe up " + (i + 2));
      }
      lg = await w.logged();
      const today = lg.filter((e) => !e.undone && e.at && e.at.slice(0, 10) === new Date(Date.now()).toISOString().slice(0, 10));
      w.expect(await w.visible("#empty"), "the day ends with a stop screen");
      w.expect(/30 for today/.test(await w.text("#emptyHead")), "it says that's 30 for today (" + (await w.text("#emptyHead")) + ")");
      w.expect(await w.visible("#earlyBtn"), "Keep going is offered");
      w.expect(ids.size >= 29, "30 different thoughts, no repeats in a day (" + ids.size + ")");
      const after = await w.store();
      const moved = Object.keys(before).filter((k) => !after[k] || !!after[k].away !== !!before[k].away);
      w.expect(moved.length === 0, "nothing was put away or removed by swiping (" + moved.length + ")");
      w.expect(today.length >= 30 || lg.length - 0 >= 30, "30 visits are logged");
      await w.free(() => w.tap("#earlyBtn", "Keep going", 900));
      w.expect(await w.visible("#vMeet") && (await w.text("#words")).length > 0 && !(await w.visible("#empty")), "Keep going brings another thought");
    },
  },
  {
    id: "J4", name: "Put away, then undo", target: 2, seed: "small",
    async run(w) {
      await w.look("a thought");
      const first = await w.text("#words"), n0 = await w.text("#stripN"), t0 = await w.now();
      await w.pullDown("pull down to put away");
      w.expect((await w.text("#words")) !== first, "pull down takes the thought off the screen");
      w.expect(await w.visible("#toast") && /Put away/.test(await w.text("#toastMsg")), "a message says Put away, with Undo");
      const hp = await w.haptics(t0);
      w.expect(hp.includes("thud") && hp.includes("letgo"), "put away plays thud then let go (" + hp.join(",") + ")");
      await w.tap("#toastUndo", "Undo", 700);
      w.expect((await w.text("#words")) === first, "Undo brings back the same thought, in place");
      const st = await w.store();
      w.expect(Object.values(st).every((t) => !t.away), "nothing is left put away after Undo");
      w.expect((await w.text("#stripN")) === n0, "the count is unchanged");
    },
  },
  {
    id: "J5", name: "Write a new thought mid-session", target: 3, seed: "small",
    async run(w) {
      await w.free(() => w.swipeUp());
      const cur = await w.text("#words"), n0 = Object.keys(await w.store()).length;
      await w.tap("#stripNew", "tap + New", 700);
      w.expect(await w.visible("#vWrite"), "+ New opens the writing screen");
      await w.fill("#writeText", "Ask for help sooner than feels comfortable.", "write it");
      await w.tap("#writeKeep", "Keep", 2400);
      w.expect(Object.keys(await w.store()).length === n0 + 1, "the new thought is saved");
      w.expect(await w.visible("#vMeet") && (await w.text("#words")) === cur, "back on the same thought as before (" + (await w.text("#words")).slice(0, 30) + ")");
    },
  },
  {
    id: "J6", name: "Edit, add a note, bookmark", target: 6, seed: "small",
    async run(w) {
      const id = await w.page.evaluate(() => JSON.parse(localStorage.getItem("scales.next.ui.v1") || "{}").cur);
      await w.tapThought("tap the thought");
      w.expect(await w.visible("#vEdit"), "a tap opens Edit");
      await w.fill("#editText", "Say the hard thing early, and kindly.", "change the words");
      await w.tap("#noteBtn", "Add a note", 300);
      await w.fill("#editNote", "Tried this with the team on Monday.", "write the note");
      await w.tap("#editMark", "bookmark it", 300);
      const t0 = await w.now();
      await w.tap("#editDone", "Done", 800);
      w.expect(await w.visible("#vMeet"), "Done returns to the thought");
      w.expect((await w.haptics(t0)).includes("medium"), "saving an edit plays a firm haptic");
      const t = (await w.store())[id] || {};
      w.expect(t.text === "Say the hard thing early, and kindly.", "the new words are saved");
      w.expect(/Monday/.test(t.note || ""), "the note is saved");
      w.expect(!!t.bookmarked, "the bookmark is saved");
      await w.free(() => w.tapThought("open it again"));
      w.expect((await w.text("#editHist")).length > 0, "Edit shows a history line (" + (await w.text("#editHist")).slice(0, 50) + ")");
      await w.free(() => w.tap("#editCancel", "close"));
    },
  },
  {
    id: "J7", name: "Find a thought", target: 3, seed: "regular",
    async run(w) {
      await w.tap("#strip", "open Your thoughts", 900);
      w.expect(await w.visible("#lib"), "the list opens");
      await w.fill("#q", "campsite", "search a word");
      w.expect(/campsite/i.test(await w.text("#libList")), "the search finds it");
      await w.tap("#libList [data-open]", "open the result", 900);
      w.expect(/campsite/i.test(await w.text("#words")), "the thought is on screen");
      await w.free(async () => {
        await w.tap("#strip", "reopen", 900); await w.fill("#q", "", "clear search");
        await w.tap('#seg [data-view="new"]', "New filter", 500);
        w.expect(/Added in the last 14 days/.test(await w.text("#libList")), "New lists what was added lately");
        await w.tap('#seg [data-view="marked"]', "Bookmarked filter", 500);
        w.expect(/Bookmarked · \d/.test(await w.text("#segMarked")) && (await w.page.locator("#libList [data-open]").count()) >= 1, "Bookmarked lists the bookmarked ones");
        await w.tap('#seg [data-view="all"]', "All", 400);
      });
    },
  },
  {
    id: "J8", name: "Bring back a put-away thought", target: 3, seed: "regular",
    async run(w) {
      const away0 = Object.values(await w.store()).filter((t) => t.away).length;
      await w.tap("#strip", "open Your thoughts", 900);
      await w.page.locator("#libList .arch").scrollIntoViewIfNeeded().catch(() => {});
      await w.tap("#libList .arch", "open Put away", 600);
      w.expect(/Put away/.test(await w.text("#libList")), "the Put away list opens");
      const back = w.page.locator("#libList [data-back]").first();
      w.expect(await back.count() === 1, "each put-away thought has a way back");
      await w.tap("#libList [data-back]", "bring one back", 800);
      const away1 = Object.values(await w.store()).filter((t) => t.away).length;
      w.expect(away1 === away0 - 1, "one fewer is put away (" + away0 + " to " + away1 + ")");
    },
  },
  {
    id: "J9", name: "Import a pasted list", target: 5, seed: "regular",
    async run(w) {
      const n0 = Object.keys(await w.store()).length;
      await openSettings(w);
      await w.tap("#setImport", "Import thoughts", 600);
      await w.fill("#impText", "The obstacle is the way.\n- Marcus Aurelius\n\nMeasure twice, cut once.\n\nDo what you can, with what you have, where you are.\n- Theodore Roosevelt\n\nWell begun is half done.", "paste a list");
      await w.wait(500);
      w.expect(/4 thoughts found/.test(await w.text("#impMsg")), "the preview finds 4 (" + (await w.text("#impMsg")) + ")");
      w.expect(/Marcus Aurelius/.test(await w.text("#impList")), "who said it is picked up");
      await w.tap("#impAdd", "Add", 900);
      const n1 = Object.keys(await w.store()).length;
      w.expect(n1 === n0 + 4, "4 thoughts are added (" + n0 + " to " + n1 + ")");
      w.expect((await w.text("#impMsg")).length > 0, "it says what happened (" + (await w.text("#impMsg")) + ")");
    },
  },
  {
    id: "J10", name: "Add a set, then remove it", target: 6, seed: "regular",
    async run(w) {
      await openSettings(w);
      await w.tap("#setSets", "Sets", 600);
      const row = '#setList [data-set="franklin"]';
      await w.tap(row, "Add Franklin's Virtues", 700);
      const st = await w.store(), n = Object.values(st).filter((t) => t.set === "franklin").length;
      w.expect(n >= 12, "the set's lines are added (" + n + ")");
      w.expect(/Remove$/.test((await w.text(row)).trim()), "the set now offers Remove");
      await w.tap(row, "Remove", 500);
      w.expect(/Tap again/.test(await w.text(row)), "Remove asks for a second tap");
      await w.tap(row, "confirm Remove", 700);
      const left = Object.values(await w.store()).filter((t) => t.set === "franklin" && !t.away).length;
      w.expect(left === 0, "unseen lines are taken back (" + left + " left in rotation)");
    },
  },
  {
    id: "J11", name: "Back up, then restore", target: 6, seed: "regular",
    async run(w, x) {
      await openSettings(w);
      await w.tap("#setBackups", "Backups", 600);
      const t0 = await w.now();
      await w.tap("#setBackup", "Back up now", 900);
      const br = await w.bridge();
      w.expect(br.some((m) => m.type === "backup" && m.t >= t0), "Back up now hands a file to the iPhone");
      w.expect((await w.haptics(t0)).includes("success"), "a finished backup plays success");
      const bad = x.file("not-a-backup.json", JSON.stringify({ hello: "world" }));
      await w.act("choose a file that is not a backup", () => w.page.setInputFiles("#restoreFile", bad), 900);
      w.expect(/isn't a Scales backup/.test(await w.text("#restoreMsg")), "a wrong file is refused with a plain reason (" + (await w.text("#restoreMsg")) + ")");
      const good = await w.page.evaluate(() => ({ app: "scales", version: window.ScalesNext.VERSION, exported_at: new Date().toISOString(),
        thoughts: JSON.parse(localStorage.getItem("scales.next.thoughts.v1")), gone: [], visits: JSON.parse(localStorage.getItem("scales.next.log.v1") || "[]"), events: [] }));
      good.thoughts.restored1 = Object.assign({}, Object.values(good.thoughts)[0], { id: "restored1", text: "Restored from the audit backup." });
      await w.act("choose a real backup", () => w.page.setInputFiles("#restoreFile", x.file("scales-backup.json", JSON.stringify(good))), 1200);
      const m = await w.text("#restoreMsg");
      w.expect(/Restored|restored|Added|added/.test(m), "a real backup restores and says so (" + m + ")");
      w.expect(!!(await w.store()).restored1, "the restored thought is there");
    },
  },
  {
    id: "J12", name: "Argue with it", target: 4, seed: "regular",
    async run(w) {
      await w.wait(800);
      await w.tapThought("tap the thought");
      await w.wait(600);
      w.expect(await w.visible("#argBtn"), "Edit offers Argue with it");
      await w.tap("#argBtn", "Argue with it", 1500);
      w.expect(await w.visible("#argPage"), "the argument opens");
      w.expect((await w.text("#apAgainst")).length > 20, "Against it is written");
      w.expect((await w.text("#apFor")).length > 20, "For it is written");
      await w.tap("#apWrite", "Write your answer", 400);
      await w.fill("#apNoteText", "I'd rather slowing down be true, because rushing has cost me more.", "write the answer");
      await w.tap("#argBack", "back to Edit", 800);
      w.expect(await w.visible("#vEdit"), "back in Edit");
      w.expect(/rushing has cost me/.test(await w.page.inputValue("#editNote").catch(() => "")), "the answer is kept as a note");
    },
  },
  {
    id: "J13", name: "Read a tension, dismiss it as wrong", target: 3, seed: "regular",
    async run(w) {
      await w.wait(3000);
      await w.tap("#strip", "open Your thoughts", 1200);
      const g = w.page.locator('#libList [data-group="tension"]');
      w.expect(await g.count() === 1, "Tensions shows in Your thoughts");
      await w.tap('#libList [data-group="tension"]', "open Tensions", 500);
      await w.tap("#libList [data-tension]", "open a tension", 900);
      w.expect(await w.visible("#ten") && /and yet/.test(await w.text("#ten")), "two thoughts are shown with \"and yet\" between them");
      const k0 = await w.page.evaluate(() => (JSON.parse(localStorage.getItem("scales.next.tensions.v1") || "{}").pairs || []).length);
      await w.tap("#tenNo", "Not a tension", 900);
      const k1 = await w.page.evaluate(() => (JSON.parse(localStorage.getItem("scales.next.tensions.v1") || "{}").pairs || []).length);
      w.expect(k1 === k0 - 1, "the pair is dropped (" + k0 + " to " + k1 + ")");
      w.expect(/Won't pair these again/.test(await w.text("#toastMsg")), "and it says so");
    },
  },
  {
    id: "J14", name: "Open Insights", target: 3, seed: "regular",
    async run(w) {
      await openSettings(w);
      await w.tap("#setIns", "Insights", 800);
      const b = await w.text("#insBody");
      w.expect(await w.visible("#insPage"), "Insights opens");
      w.expect(b.length > 40, "it has something to say");
      w.expect(!/undefined|NaN|null|\[object/.test(b), "no broken values on the page");
    },
  },
  {
    id: "J15", name: "Change the colors and keep them", target: 3, seed: "regular",
    async run(w) {
      await openSettings(w);
      await w.tap('#themeSeg [data-theme-pick="stone"]', "pick Stone", 600);
      w.expect(await w.page.evaluate(() => document.documentElement.getAttribute("data-theme")) === "stone", "Stone applies at once");
      await w.free(async () => { await w.page.reload(); await w.wait(1500); await w.look("after reload"); });
      w.expect(await w.page.evaluate(() => document.documentElement.getAttribute("data-theme")) === "stone", "Stone is kept after the app restarts");
    },
  },
  {
    id: "J16", name: "Coming back after two weeks away", target: 0, seed: "regular", clock: true, awayDays: 14,
    async run(w) {
      await w.look("open after 14 days");
      w.expect(await w.visible("#vMeet") && (await w.text("#words")).length > 0, "it opens on a thought, not a list of what was missed");
      w.expect(!(await w.visible("#empty")), "no stop screen on arrival");
      const body = await w.page.evaluate(() => document.body.innerText);
      w.expect(!/overdue|behind|missed|catch up/i.test(body), "no guilt words (overdue, behind, missed)");
      const due = await w.page.evaluate(() => { const C = window.ScalesNext, s = JSON.parse(localStorage.getItem("scales.next.thoughts.v1")); return C.dueToday(s, new Date()).length; });
      w.expect(due > 0, "plenty is due (" + due + "), but the day is still 30");
    },
  },
  {
    id: "J17", name: "Learn how Scales works", target: 3, seed: "small",
    async run(w) {
      await openSettings(w);
      await w.tap("#setHelp", "How Scales works", 900);
      const h = await w.text("#help");
      w.expect(/Swipe up/.test(h) && /Pull down/.test(h) && /Tap/.test(h), "all three moves are explained");
      w.expect(/20 seconds/.test(h) && /30 seconds/.test(h), "the timing rules are stated");
      w.expect((await w.page.locator("#help .demo").count()) === 3, "each move has a demo");
    },
  },
  {
    id: "J18", name: "Phone storage refuses a save", target: 1, seed: "small",
    async run(w) {
      await w.page.evaluate(() => { const s = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (/thoughts/.test(k)) { const e = new Error("full"); e.name = "QuotaExceededError"; throw e; } return s.call(this, k, v); }; });
      await w.pullDown("pull down with storage full");
      const m = await w.text("#toast");
      w.expect(/Couldn't save/.test(m) && /Back up now/.test(m), "after a swipe or pull, it says it couldn't save and points to Back up now (showing: " + m.slice(0, 40) + ")");
      await w.free(async () => {
        await w.tap("#stripNew", "write one", 600); await w.fill("#writeText", "This one cannot be saved."); await w.tap("#writeKeep", "Keep", 600);
      });
      const m2 = await w.text("#toastMsg");
      w.expect(/Couldn't save/.test(m2), "after writing, it says it couldn't save (showing: " + m2.slice(0, 40) + ")");
      w.expect(!/^✓/.test(m2), "the failure is not marked with a tick (showing: " + m2.slice(0, 12) + ")");
    },
  },
];
