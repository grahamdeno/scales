// Tests for the parts of Scales outside the page: the website, the app proxy, and the Scales Plus server.
// Plus is not offered by Scales 2 (October 2026); the server and the iPhone app's StoreKit code stay, unused.
// Run with: node --test

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("the website is published whole: strict styles, and the app passed through (1.79.0)", () => {
  const h = fs.readFileSync(path.join(__dirname, "..", "site", "_headers"), "utf8");
  assert.match(h, /style-src 'self';/); assert.doesNotMatch(h, /unsafe-inline/, "no inline styles allowed");
  const proxy = fs.readFileSync(path.join(__dirname, "..", "server", "app-proxy.js"), "utf8");
  assert.match(proxy, /https:\/\/grahamdeno\.github\.io\/scales\//);
  const wf = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "site.yml"), "utf8");
  assert.match(wf, /cp server\/ai\.mjs functions\/api\/ai\.js/); assert.match(wf, /"functions\/app\/\[\[path\]\]\.js"/, "Functions sit beside out/, where Wrangler looks for them");
});

test("the Scales 2 website: four pages, strict CSP, no inline code, no Scales 1 words, no em-dashes (2.2.0)", () => {
  const pages = ["index", "support", "privacy", "404"];
  for (const p of pages) {
    const h = read("site/" + p + ".html");
    assert.doesNotMatch(h, /<script/i, p + ": no scripts");
    assert.doesNotMatch(h, /\sstyle=|<style/i, p + ": no inline styles");
    assert.doesNotMatch(h, /\u2014/, p + ": no em-dashes");
    for (const bad of ["Scales Plus", "Ledger", "Reflect", "Lived", "Wikiquote", "Weigh your thoughts", "Skip"]) {
      assert.ok(!h.includes(bad), p + " still mentions " + bad);
    }
    assert.match(h, /href="\/site\.css\?v=2\.2\.0"/);
  }
  assert.doesNotMatch(read("site/site.css"), /\u2014|smoke|#0a84ff|blue/i);
  assert.match(read("site/site.css"), /--pist:#B9C9A3/);
  const idx = read("site/index.html");
  for (const w of ["One thought at a time.", "Two moves. That&#39;s all.".replace("&#39;", "'"), "Scales reads the pause.", "Nothing disappears on its own.", "Yours, on your phone.", "20 seconds or less", "30 seconds or more"])
    assert.ok(idx.includes(w), "landing has: " + w);
  assert.match(read("site/privacy.html"), /Effective October 29, 2026\./);
  const sup = read("site/support.html");
  assert.match(sup, /tap the gear, and choose Back up/); assert.match(sup, /Restoring adds what's missing and never\s+overwrites|Restoring adds what's missing and never overwrites/);
  for (const f of ["shot-meet.png", "shot-pull.png", "shot-library.png", "icon.png"]) assert.ok(fs.existsSync(path.join(__dirname, "..", "site", "img", f)), f);
  const wf = read(".github/workflows/site.yml");
  assert.match(wf, /check \/ "One thought at a time"/); assert.match(wf, /check "\/site\.css\?v=2\.2\.0" "--pist"/);
});

// ---------- 1.72.0: Scales Plus, checked on the server ----------
const storeDir = path.join(__dirname, "fixtures", "store");
const nodeCrypto = require("crypto");
const derOf = (f) => new nodeCrypto.X509Certificate(fs.readFileSync(path.join(storeDir, f))).raw;
const testRoot = nodeCrypto.createHash("sha256").update(derOf("root.pem")).digest("hex");
const b64u = (x) => Buffer.from(x).toString("base64url");
// A StoreKit-style transaction JWS signed by the test leaf key.
function plusJws(over = {}, keyPem = fs.readFileSync(path.join(storeDir, "leaf.key"))) {
  const header = { alg: "ES256", x5c: ["leaf.pem", "mid.pem", "root.pem"].map((f) => derOf(f).toString("base64")) };
  const body = Object.assign({ bundleId: "com.grahamdeno.scales", productId: "com.grahamdeno.scales.plus.yearly", environment: "Sandbox",
    type: "Auto-Renewable Subscription", expiresDate: Date.now() + 864e5 }, over);
  const input = b64u(JSON.stringify(header)) + "." + b64u(JSON.stringify(body));
  const sig = nodeCrypto.sign("sha256", Buffer.from(input), { key: keyPem, dsaEncoding: "ieee-p1363" });
  return input + "." + b64u(sig);
}
test("verifyPlus: an App Store signed record of an active Scales Plus subscription passes; anything else fails", async () => {
  const { verifyPlus, APPLE_ROOT_G3 } = await import("../server/ai.mjs");
  const roots = [testRoot];
  assert.equal((await verifyPlus(plusJws(), { roots })).productId, "com.grahamdeno.scales.plus.yearly");
  assert.equal((await verifyPlus(plusJws({ environment: "Production" }), { roots })).environment, "Production");
  await assert.rejects(verifyPlus(plusJws()), /unknown root/, "only Apple's root by default");
  assert.equal(APPLE_ROOT_G3, "63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179");
  await assert.rejects(verifyPlus(plusJws({ expiresDate: Date.now() - 1000 }), { roots }), /expired/);
  await assert.rejects(verifyPlus(plusJws({ revocationDate: Date.now() - 1000 }), { roots }), /refunded/);
  await assert.rejects(verifyPlus(plusJws({ bundleId: "com.other.app" }), { roots }), /wrong app/);
  await assert.rejects(verifyPlus(plusJws({ productId: "com.grahamdeno.scales.other" }), { roots }), /wrong app/);
  await assert.rejects(verifyPlus(plusJws({ environment: "Xcode" }), { roots }), /environment/);
  const good = plusJws(), [h, p, sg] = good.split(".");
  const forged = b64u(JSON.stringify(Object.assign(JSON.parse(Buffer.from(p, "base64url")), { expiresDate: Date.now() + 9e12 })));
  await assert.rejects(verifyPlus(h + "." + forged + "." + sg, { roots }), /bad signature/, "a changed record fails");
  // Signed by a key that is not the leaf in the chain.
  const other = nodeCrypto.generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey.export({ type: "sec1", format: "pem" });
  const bad = plusJws({}, other);
  await assert.rejects(verifyPlus(bad, { roots }), /bad signature/);
  // A chain without the intermediate's Apple marker.
  const hdr = JSON.parse(Buffer.from(h, "base64url")); hdr.x5c[1] = hdr.x5c[2];
  await assert.rejects(verifyPlus(b64u(JSON.stringify(hdr)) + "." + p + "." + sg, { roots }), /App Store certificate/);
  await assert.rejects(verifyPlus("nope", { roots }), /not a JWS/);
});
test("TestFlight preview: Apple's AppTransaction for a Sandbox copy of this app turns the server on (1.82.0)", async () => {
  const { verifyPreview } = await import("../server/ai.mjs");
  const roots = [testRoot];
  const app = (o) => plusJws(Object.assign({ productId: undefined, expiresDate: undefined, environment: undefined, receiptType: "Sandbox", appAppleId: 1 }, o));
  assert.equal((await verifyPreview(app(), { roots })).bundleId, "com.grahamdeno.scales");
  assert.ok(await verifyPreview(app({ receiptType: undefined, environment: "Sandbox" }), { roots }));
  await assert.rejects(verifyPreview(app({ receiptType: "Production" }), { roots }), /not a TestFlight copy/, "an App Store copy can't preview");
  await assert.rejects(verifyPreview(app({ bundleId: "com.other.app" }), { roots }), /wrong app/);
  await assert.rejects(verifyPreview(app()), /unknown root/, "only Apple's root by default");
  const src = read("server/ai.mjs");
  assert.match(src, /env\.PLUS_PREVIEW === "off"/, "the server can end the preview");
  const swift = read("ios/App/WebViewController.swift"), yml = read("ios/project.yml");
  assert.match(swift, /AppTransaction\.shared/); assert.match(swift, /ScalesPlusPreview/);
  assert.match(yml, /UIDeviceFamily: \[1\]/, "iPhone only, or the App Store asks for iPad screenshots");
  const tgt = yml.slice(yml.indexOf("\ntargets:"), yml.indexOf("\nschemes:"));
  assert.equal((tgt.match(/^    settings:/gm) || []).length, 1, "one settings block on the target: a second one is silently ignored");
  assert.match(tgt, /^        TARGETED_DEVICE_FAMILY: "1"/m, "iPhone only on the target itself, where it beats XcodeGen's iOS default of 1,2");
  assert.match(read(".github/workflows/ios.yml"), /UIDeviceFamily/, "CI stops an upload that lists iPad");
  assert.match(yml, /ScalesPlusPreview: false/, "off for the App Store: Scales 2 has no AI and Plus is not offered");
});
test("the AI server needs Scales Plus, fixes the model and limits, and only takes same-origin text messages", async () => {
  const mod = await import("../server/ai.mjs");
  const seen = [];
  global.fetch = async (url, init) => { seen.push({ url, body: JSON.parse(init.body), key: init.headers["x-api-key"] }); return new Response(JSON.stringify({ content: [{ type: "text", text: "ok" }] }), { status: 200 }); };
  const env = { ANTHROPIC_API_KEY: "sk-ant-server" }, site = "https://scales.tangomike.app";
  const post = (body, origin, plus) => mod.onRequestPost({ env, request: new Request(site + "/api/ai", { method: "POST",
    headers: Object.assign(origin ? { Origin: origin } : {}, plus ? { "X-Scales-Plus": plus } : {}), body: JSON.stringify(body) }) });
  const hi = { messages: [{ role: "user", content: "hi" }] };
  assert.equal((await post(hi, "https://evil.example")).status, 403);
  assert.equal((await post(hi, site)).status, 402, "no Plus record");
  mod.TRUSTED_ROOTS.push(testRoot);
  try {
    assert.equal((await post(hi, site, plusJws({ expiresDate: Date.now() - 1 }))).status, 402, "an expired one");
    assert.equal(seen.length, 0, "nothing sent on without Plus");
    const plus = plusJws();
    assert.equal((await post({ messages: [{ role: "system", content: "x" }] }, site, plus)).status, 400);
    const r = await post({ model: "claude-opus-5-5", max_tokens: 99999, system: "s", messages: [{ role: "user", content: "hi" }] }, site, plus);
    assert.equal(r.status, 200);
    assert.equal(seen[0].body.model, "claude-haiku-5-5");
    assert.equal(seen[0].body.max_tokens, 1024);
    assert.equal(seen[0].key, "sk-ant-server");
  } finally { mod.TRUSTED_ROOTS.pop(); }
  assert.equal((await mod.onRequestPost({ env: {}, request: new Request(site + "/api/ai", { method: "POST", headers: { Origin: site }, body: "{}" }) })).status, 503);
});

