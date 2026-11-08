// The walker: does what a person does, one deliberate interaction at a time, and records what each one cost and
// what the screen looked like after it. Gestures are real pointer drags on the card, the way a finger moves.
const path = require("path"), fs = require("fs");
const { pageRules } = require("./rules");

class Walker {
  constructor(page, o) {
    this.page = page; this.o = o; this.cost = 0; this.steps = []; this.checks = []; this.errors = [];
    this.out = o.out; this.shots = o.shots !== false; this.n = 0;
    fs.mkdirSync(this.out, { recursive: true });
    page.on("pageerror", (e) => this.errors.push(String(e).slice(0, 300)));
    page.on("console", (m) => { if (m.type() === "error" && !/favicon|ERR_FILE_NOT_FOUND|404/.test(m.text())) this.errors.push(m.text().slice(0, 300)); });
  }
  wait(ms) { return this.page.waitForTimeout(ms); }
  async settle(ms) { await this.wait(ms == null ? 650 : ms); }

  // One deliberate interaction. Counted, then the screen is recorded.
  async act(label, fn, settle) {
    this.cost++;
    const t = Date.now();
    try { await fn(); } catch (e) { this.checks.push({ ok: false, msg: "could not " + label + ": " + String(e.message || e).split("\n")[0] }); }
    await this.settle(settle);
    await this.record(label, Date.now() - t);
  }
  // Wait (up to 2.5 s) for fades and slides to finish, so contrast is measured on the settled screen.
  // WebKit runs slower than Chromium and was caught measuring text mid-fade. Endless animations (breathing) are ignored.
  async calm() {
    for (let i = 0; i < 25; i++) {
      const busy = await this.page.evaluate(() => (document.getAnimations ? document.getAnimations() : []).some((a) => {
        const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
        return a.playState === "running" && t && t.iterations !== Infinity;
      })).catch(() => false);
      if (!busy) return;
      await this.wait(100);
    }
  }
  async record(label, ms) {
    this.n++;
    await this.calm();
    const r = await this.page.evaluate(pageRules, { reducedMotion: !!this.o.reducedMotion }).catch((e) => ({ screens: [], words: 0, controls: 0, issues: [], cls: -1, err: String(e) }));
    const prevCls = this.steps.length ? this.steps[this.steps.length - 1].clsTotal : 0;
    const step = { n: this.n, label, ms: ms || 0, screens: r.screens, words: r.words, userWords: r.userWords, controls: r.controls,
      issues: r.issues, clsTotal: r.cls, cls: r.cls >= 0 ? +(r.cls - (prevCls > 0 ? prevCls : 0)).toFixed(4) : null };
    if (this.shots) {
      const f = String(this.n).padStart(2, "0") + "-" + label.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) + ".png";
      await this.page.screenshot({ path: path.join(this.out, f) }).catch(() => {});
      step.shot = f;
    }
    this.steps.push(step);
    return step;
  }
  async look(label) { return this.record(label, 0); }   // record without counting an interaction
  // Steps the audit takes only to check something (not part of the person's job) do not count toward the cost.
  async free(fn) { const c = this.cost; await fn(); this.cost = c; }

  // Gestures and inputs.
  async drag(dy) {
    const b = await this.page.locator("#stage").boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await this.page.mouse.move(x, y); await this.page.mouse.down();
    for (let i = 1; i <= 14; i++) { await this.page.mouse.move(x, y + (dy * i) / 14); await this.wait(12); }
    await this.page.mouse.up();
  }
  swipeUp(label) { return this.act(label || "swipe up", () => this.drag(-170), 750); }
  pullDown(label) { return this.act(label || "pull down", () => this.drag(230), 900); }
  tapThought(label) { return this.act(label || "tap the thought", async () => { const b = await this.page.locator("#words").boundingBox(); await this.page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); }, 800); }
  tap(sel, label, settle) { return this.act(label || "tap " + sel, () => this.page.locator(sel).first().click({ timeout: 4000 }), settle); }
  fill(sel, text, label) { return this.act(label || "type in " + sel, () => this.page.locator(sel).first().fill(text, { timeout: 4000 }), 300); }
  key(k, label) { return this.act(label || "press " + k, () => this.page.keyboard.press(k)); }
  async sitFor(ms) { await this.page.clock.runFor(ms); }

  // Checks.
  expect(ok, msg) { this.checks.push({ ok: !!ok, msg }); return !!ok; }
  async visible(sel) { return this.page.locator(sel).first().isVisible().catch(() => false); }
  async text(sel) { return ((await this.page.locator(sel).first().textContent({ timeout: 2000 }).catch(() => "")) || "").trim(); }
  async store() { return this.page.evaluate(() => JSON.parse(localStorage.getItem("scales.next.thoughts.v1") || "{}")); }
  async logged() { return this.page.evaluate(() => JSON.parse(localStorage.getItem("scales.next.log.v1") || "[]")); }
  async bridge() { return this.page.evaluate(() => window.__bridge || []); }
  async haptics(since) { return (await this.bridge()).filter((m) => m.type === "haptic" && (!since || m.t >= since)).map((m) => m.style); }
  async now() { return this.page.evaluate(() => Date.now() - window.__t0); }

  result() {
    return { cost: this.cost, steps: this.steps, checks: this.checks, errors: Array.from(new Set(this.errors)),
      passed: this.checks.length > 0 && this.checks.every((c) => c.ok) };
  }
}
module.exports = { Walker };
