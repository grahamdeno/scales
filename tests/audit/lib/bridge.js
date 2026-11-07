// A stand-in for the iPhone shell. Runs before the page (addInitScript), so the page believes it is inside the app.
// Every message the page sends to the shell is recorded with a timestamp in window.__bridge, so the audit can check
// which haptic fired at which moment. Apple Intelligence answers in the formats Scales asks for, after a short delay.
// Also records layout shift (Chromium only) in window.__cls.
function bridgeInit(opts) {
  opts = opts || {};
  window.__bridge = [];
  window.__t0 = Date.now();
  window.scalesNative = { version: 1, platform: "ios", build: "audit", testflight: false };
  const answer = (m) => {
    const ins = String(m.instructions || "");
    if (/AGAINST:/.test(ins)) return "AGAINST: Speed often matters more than care when the window to act is short. Waiting can cost the chance entirely.\nASSUMES: That slowing down never has a cost of its own.";
    if (/FOR:/.test(ins)) return "FOR: Slowing down catches errors that haste hides. Most regret comes from moves made too fast, not too slow.";
    if (/one letter/i.test(ins)) return "C";
    if (/tension/i.test(ins)) return "1 and 2";
    if (/6 to 8/.test(ins)) return "1. Work\n2. Family\n3. Discipline\n4. Faith";
    if (/one theme/.test(ins)) return /number [1-3]\b/.test(m.prompt) ? "Work" : "Discipline";
    return "This week you met your thoughts often and stayed longest with discipline.";
  };
  window.webkit = { messageHandlers: { scales: { postMessage: (m) => {
    try { window.__bridge.push(Object.assign({ t: Date.now() - window.__t0 }, JSON.parse(JSON.stringify(m)))); } catch (e) {}
    if (!m) return;
    if (m.type === "aiStatus") setTimeout(() => window.scalesAI && window.scalesAI(opts.ai === false ? "unsupported" : "available"), 20);
    if (m.type === "ai") setTimeout(() => window.scalesAIResult && window.scalesAIResult(m.id, answer(m), ""), 60);
    if (m.type === "save") setTimeout(() => window.scalesSaved && window.scalesSaved({ ok: true, where: "Files" }), 10);
    if (m.type === "backup") setTimeout(() => window.scalesBackedUp && window.scalesBackedUp({ ok: true }), 10);
  } } } };
  window.__cls = 0;
  try {
    new PerformanceObserver((l) => { l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__cls += e.value; }); })
      .observe({ type: "layout-shift", buffered: true });
  } catch (e) { window.__cls = -1; }
}
module.exports = { bridgeInit };
