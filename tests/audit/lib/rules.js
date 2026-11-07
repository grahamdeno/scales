// Rule checks run inside the page on whatever is on screen right now. Returns what a person would see (words,
// controls, which screen) and every rule it breaks. Only elements that are really visible count: in the viewport,
// not hidden, not faded out, and not covered by something on top.
function pageRules(opts) {
  opts = opts || {};
  const vw = innerWidth, vh = innerHeight;
  // User content (the thoughts themselves) is not held to the copy rules.
  const USER = "#carry, #libList .t, #libList .row p, #apThought, #whyThought, #impList, #ten .q, #aiThemes .ex, #insBody .q, #editHist";
  const issues = [];
  const add = (rule, sev, el, detail) => issues.push({ rule, sev, sel: el ? describe(el) : "", detail });

  function describe(el) {
    if (el.id) return "#" + el.id;
    let s = el.tagName.toLowerCase();
    if (el.classList.length) s += "." + Array.from(el.classList).slice(0, 2).join(".");
    const p = el.closest("[id]");
    return (p && p !== el ? "#" + p.id + " " : "") + s;
  }
  function seen(el) {
    if (!el.isConnected) return false;
    // Visually hidden for screen readers only (.sr, or clipped to nothing).
    if (el.closest(".sr")) return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.clip && cs.clip !== "auto" && /rect\(0(px)?,? 0/.test(cs.clip)) return false; }
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) return false;
    if (el.closest("[hidden], [aria-hidden='true']:not(#ten)") && !el.closest(".open")) {
      // aria-hidden pages are slid off screen; the rect test below decides. Hidden attribute always wins.
      if (el.closest("[hidden]")) return false;
    }
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) return false;
    // Effective opacity up the tree.
    let o = 1, n = el;
    while (n && n.nodeType === 1) { o *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement; }
    if (o < 0.1) return false;
    // Something on top? Test the middle of the part that is on screen.
    const x = Math.min(Math.max((Math.max(r.left, 0) + Math.min(r.right, vw)) / 2, 1), vw - 1);
    const y = Math.min(Math.max((Math.max(r.top, 0) + Math.min(r.bottom, vh)) / 2, 1), vh - 1);
    const top = document.elementFromPoint(x, y);
    if (!top) return false;
    return top === el || el.contains(top) || top.contains(el) || (top.closest("label") && top.closest("label").control === el);
  }
  function opacityOf(el) { let o = 1, n = el; while (n && n.nodeType === 1) { o *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement; } return o; }
  function rgba(s) { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
  function blend(fg, bg) { const a = fg.a; return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 }; }
  // The background is whatever is painted under the text, found by looking down through the stack of elements at
  // the text's position (so a control laid over another surface is measured against that surface).
  function bgOf(el) {
    const stack = []; const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + Math.min(r.width / 2, 12), 1), vw - 1), y = Math.min(Math.max(r.top + r.height / 2, 1), vh - 1);
    const layers = document.elementsFromPoint(x, y);
    let chain = layers.length ? layers : []; if (!chain.includes(el)) { chain = []; let n = el; while (n && n.nodeType === 1) { chain.push(n); n = n.parentElement; } }
    else chain = chain.slice(chain.indexOf(el));
    for (const n of chain) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== "none" && !/gradient/.test(cs.backgroundImage)) return null;
      const c = rgba(cs.backgroundColor); if (c && c.a > 0) { const o = opacityOf(n); stack.push({ r: c.r, g: c.g, b: c.b, a: c.a * o }); if (c.a * o >= 1) break; }
    }
    let base = stack.length && stack[stack.length - 1].a >= 1 ? stack.pop() : rgba(getComputedStyle(document.documentElement).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    if (base.a < 1) base = blend(base, { r: 255, g: 255, b: 255, a: 1 });
    while (stack.length) base = blend(stack.pop(), base);
    return base;
  }
  function lum(c) { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); }
  function ratio(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function ownText(el) { let s = ""; el.childNodes.forEach((c) => { if (c.nodeType === 3) s += c.textContent; }); return s.replace(/\s+/g, " ").trim(); }
  function nameOf(el) {
    const al = el.getAttribute("aria-label"); if (al && al.trim()) return al.trim();
    const lb = el.getAttribute("aria-labelledby"); if (lb) { const t = lb.split(/\s+/).map((i) => (document.getElementById(i) || {}).textContent || "").join(" ").trim(); if (t) return t; }
    if (el.labels && el.labels.length) { const t = Array.from(el.labels).map((l) => l.textContent).join(" ").trim(); if (t) return t; }
    const tx = (el.innerText || el.textContent || "").trim(); if (tx && !/^(input|textarea)$/i.test(el.tagName)) return tx;
    const img = el.querySelector && el.querySelector("img[alt]"); if (img && img.alt.trim()) return img.alt.trim();
    if (el.title) return el.title;
    if (el.placeholder) return el.placeholder;
    return "";
  }

  // The screen: which views are showing.
  const screens = [];
  document.querySelectorAll("section.view, section.page, #lib, #ten, #empty, #tip, #setOffer, #toast").forEach((s) => {
    if (s.id === "toast" ? s.classList.contains("on") : (!s.hidden && (s.classList.contains("view") || s.id === "ten" || s.id === "empty" || s.id === "tip" || s.id === "setOffer" ? true : s.classList.contains("open")))) {
      const r = s.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.left < vw && r.right > 0 && getComputedStyle(s).visibility !== "hidden") screens.push(s.id);
    }
  });

  // Visible text and words.
  let words = 0; const texts = []; const userWords = { n: 0 };
  const all = Array.from(document.body.querySelectorAll("*")).filter((e) => !/^(SCRIPT|STYLE|SVG|PATH|svg|path|circle|line|polyline|rect|g)$/.test(e.tagName));
  all.forEach((el) => {
    const t = ownText(el); if (!t) return;
    if (!seen(el)) return;
    const n = t.split(/\s+/).filter(Boolean).length;
    if (el.closest(USER)) { userWords.n += n; } else { words += n; texts.push({ el, t }); }
    const cs = getComputedStyle(el), fs = parseFloat(cs.fontSize);
    if (fs < 12 && !el.closest(".sr")) add("small-text", 1, el, fs + "px: \"" + t.slice(0, 40) + "\"");
    // Contrast
    const fg = rgba(cs.color), bg = bgOf(el);
    if (fg && bg) {
      const eff = blend({ r: fg.r, g: fg.g, b: fg.b, a: fg.a * opacityOf(el) }, bg);
      const cr = ratio(eff, bg), big = fs >= 24 || (fs >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
      const need = big ? 3 : 4.5;
      if (cr < need) add("contrast", cr < (big ? 2 : 3) ? 3 : 2, el, cr.toFixed(2) + ":1 (needs " + need + "): \"" + t.slice(0, 40) + "\"");
    }
    // Truncation: text cut by its own box.
    const clip = (cs.overflowX !== "visible" || cs.textOverflow === "ellipsis") && el.scrollWidth > el.clientWidth + 1;
    const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== "none" && el.scrollHeight > el.clientHeight + 1;
    if (clip && cs.textOverflow === "ellipsis") add("clamped", 1, el, "ends in ... : \"" + t.slice(0, 40) + "\"");
    else if (clip) add("truncation", 2, el, "\"" + t.slice(0, 50) + "\"");
    if (clamp) add("clamped", 1, el, "line clamp hides part of \"" + t.slice(0, 40) + "\"");
  });

  // Copy rules on the app's own words.
  texts.forEach(({ el, t }) => {
    if (/\u2014/.test(t)) add("copy-emdash", 2, el, "\"" + t.slice(0, 60) + "\"");
    if (/\bplease\b/i.test(t)) add("copy-please", 1, el, "\"" + t.slice(0, 60) + "\"");
    if (/\bclick\b/i.test(t)) add("copy-click", 1, el, "\"" + t.slice(0, 60) + "\"");
    if (/\b(simply|easy|easily)\b/i.test(t)) add("copy-coachy", 1, el, "\"" + t.slice(0, 60) + "\"");
    if (el.closest("button, a") && /!/.test(t)) add("copy-exclaim", 1, el, "\"" + t.slice(0, 60) + "\"");
  });

  // Controls: size, name, focus zoom.
  const ctrls = Array.from(document.querySelectorAll("button, a[href], input:not([type=file]):not([type=hidden]), textarea, select, [role=button], [role=radio], [role=switch]")).filter(seen);
  ctrls.forEach((el) => {
    const r = el.getBoundingClientRect();
    if ((r.width < 44 || r.height < 44) && !/^(INPUT|TEXTAREA)$/.test(el.tagName)) {
      // Effective target: padding counts, an inline text link inside prose is reported as minor.
      const small = Math.min(r.width, r.height);
      add("tap-target", small < 30 ? 3 : 2, el, Math.round(r.width) + "x" + Math.round(r.height) + " \"" + (nameOf(el) || "").slice(0, 30) + "\"");
    }
    if (!nameOf(el)) add("no-name", 3, el, el.tagName.toLowerCase() + " has nothing a screen reader can say");
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && parseFloat(getComputedStyle(el).fontSize) < 16) add("focus-zoom", 2, el, getComputedStyle(el).fontSize + " (iOS zooms the page on focus under 16px)");
  });

  // Page level.
  const se = document.scrollingElement;
  if (se.scrollWidth > vw + 1) add("h-scroll", 3, null, "page is " + se.scrollWidth + "px wide in a " + vw + "px screen");
  if (opts.reducedMotion) {
    all.filter(seen).forEach((el) => {
      const cs = getComputedStyle(el);
      const longest = (s) => Math.max(0, ...String(s).split(",").map((x) => parseFloat(x) * (/ms/.test(x) ? 0.001 : 1)));
      const anim = cs.animationName && cs.animationName !== "none" ? longest(cs.animationDuration) : 0;
      if (anim > 0.2 && (cs.animationIterationCount === "infinite" || anim > 0.5)) add("motion", 2, el, "animates " + anim + "s with reduced motion on");
    });
  }
  const cls = typeof window.__cls === "number" ? window.__cls : -1;
  return { screens, words, userWords: userWords.n, controls: ctrls.length, issues, cls };
}
module.exports = { pageRules };
