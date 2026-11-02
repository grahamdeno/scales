// Scales for iPhone: keeps a copy of everything Scales saves in a file the app owns (NativeStore.swift), so iOS
// clearing the web view's storage can never lose a thought. Runs before the page, in the bundled app only.
//
// The page keeps using localStorage as it always has. This script:
// 1. On start, compares the file's revision with localStorage's. The newer one wins: the file refills
//    localStorage (after iOS cleared it, or on the first launch after moving from the web), or localStorage
//    sends everything to the file (a change was made but the app closed before the file was written).
// 2. After that, every change to a "scales" key is sent to the file, a few at a time.
// The revision goes up the moment a change is made, before it reaches the file, so an unsent change always
// makes localStorage the newer one on the next start.
(function () {
  var h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.scales;
  var seed = window.__scalesSeed; try { delete window.__scalesSeed; } catch (e) { window.__scalesSeed = undefined; }
  if (!h) return;
  var ls; try { ls = window.localStorage; } catch (e) { return; }
  var P = "scales", REV = "scales.native.rev";
  var S = Storage.prototype, setItem = S.setItem, removeItem = S.removeItem, clear = S.clear;
  function ours(k) { return typeof k === "string" && k.indexOf(P) === 0 && k !== REV; }
  function keys() { var out = []; for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (ours(k)) out.push(k); } return out; }
  function num(v) { var n = parseInt(v, 10); return isFinite(n) && n > 0 ? n : 0; }

  var localRev = num(ls.getItem(REV)), fileRev = seed && seed.data ? num(seed.rev) : 0;
  var rev, full = false, live = true;
  if (seed && seed.data && fileRev >= localRev && fileRev > 0) {
    // The file is as new or newer: localStorage becomes exactly the file.
    var ok = true;
    keys().forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(seed.data, k)) removeItem.call(ls, k); });
    for (var k in seed.data) {
      if (!Object.prototype.hasOwnProperty.call(seed.data, k) || !ours(k)) continue;
      if (ls.getItem(k) === seed.data[k]) continue;
      try { setItem.call(ls, k, String(seed.data[k])); } catch (e) { ok = false; }
    }
    rev = fileRev;
    try { setItem.call(ls, REV, String(rev)); } catch (e) {}
    // If the file could not be put back whole, the page would start from a partial copy. Never let that
    // partial copy be written over the file: stop sending changes, and tell the page.
    if (!ok) { live = false; window.scalesStoreError = "restore"; }
  } else {
    // localStorage is newer, or there is no file yet: the file gets everything.
    rev = Math.max(localRev, fileRev);
    full = keys().length > 0 || fileRev > 0;
  }

  var set = {}, del = {}, timer = null, dirty = false;
  function mark() {
    if (!dirty) { dirty = true; rev++; try { setItem.call(ls, REV, String(rev)); } catch (e) {} }
    if (!timer) timer = setTimeout(flush, 300);
  }
  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!live || (!dirty && !full)) return;
    var msg = { type: "store", rev: rev, full: full, set: {}, del: [] };
    if (full) { keys().forEach(function (k) { msg.set[k] = ls.getItem(k); }); }
    else { for (var a in set) msg.set[a] = set[a]; for (var b in del) msg.del.push(b); }
    set = {}; del = {}; dirty = false; full = false;
    try { h.postMessage(msg); } catch (e) { full = true; dirty = true; }
  }

  S.setItem = function (k, v) {
    setItem.call(this, k, v);
    if (this === ls && ours(String(k))) { set[String(k)] = String(v); delete del[String(k)]; mark(); }
  };
  S.removeItem = function (k) {
    var had = this === ls && ours(String(k)) && ls.getItem(String(k)) !== null;
    removeItem.call(this, k);
    if (had) { del[String(k)] = 1; delete set[String(k)]; mark(); }
  };
  S.clear = function () {
    var gone = this === ls ? keys() : [];
    clear.call(this);
    if (gone.length) { gone.forEach(function (k) { del[k] = 1; delete set[k]; }); mark(); }
  };

  // Everything goes to the file under a new revision, so it is newer than anything the file has.
  if (full) mark();
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flush(); });
  window.addEventListener("pagehide", flush);
  window.scalesStoreFlush = flush;
})();
