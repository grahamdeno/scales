// Scales AI proxy (1.64.0): a Cloudflare Pages Function, deployed (renamed to functions/api/ai.js) in the Pages
// project that serves scales.tangomike.app. The app at scales.tangomike.app/app posts here; this adds the
// Anthropic key (the ANTHROPIC_API_KEY secret), fixes the model and limits, and passes the answer back.
// Nothing is stored or logged. Abuse limits: same-origin requests only, a Cloudflare rate-limiting rule on
// /api/ai, and a monthly spend limit on the Anthropic workspace.
//
// Scales Plus (1.72.0): every request carries the App Store's signed record of an active Scales Plus
// subscription (the X-Scales-Plus header: StoreKit's JWS for the transaction). It is checked here before
// anything is sent on: signed by a key whose certificate chain ends at Apple Root CA - G3, for this app and
// product, not expired, not refunded. A record can only come from a purchase made in the iPhone app, so this
// limits the server to paying (or trialing) users of the real app. No other dependency: the certificates are
// read with a small DER reader and checked with WebCrypto.
const MODEL = "claude-haiku-5-5", MAX_TOKENS = 1024, MAX_BODY = 24000, MAX_MESSAGES = 16, MAX_SYSTEM = 4000;
export const BUNDLE_ID = "com.grahamdeno.scales", PLUS_PRODUCT = "com.grahamdeno.scales.plus.yearly";
// SHA-256 of Apple Root CA - G3 (https://www.apple.com/certificateauthority/).
export const APPLE_ROOT_G3 = "63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179";
// The roots a record may chain to. Only Apple's in production; tests add their own.
export const TRUSTED_ROOTS = [APPLE_ROOT_G3];
const OID_LEAF = "1.2.840.113635.100.6.11.1", OID_INTERMEDIATE = "1.2.840.113635.100.6.2.1";

function reply(status, type, message) {
  return new Response(JSON.stringify({ type: "error", error: { type, message } }),
    { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

// ---------- a small DER reader ----------
function tlv(b, i) {
  const tag = b[i];
  let len = b[i + 1], at = i + 2;
  if (len & 0x80) { const n = len & 0x7f; len = 0; for (let k = 0; k < n; k++) len = len * 256 + b[at + k]; at += n; }
  if (at + len > b.length) throw new Error("bad DER");
  return { tag, start: i, body: at, end: at + len };
}
function kids(b, node) { const out = []; for (let i = node.body; i < node.end;) { const k = tlv(b, i); out.push(k); i = k.end; } return out; }
function oid(b, node) {
  const v = b.subarray(node.body, node.end), parts = [Math.floor(v[0] / 40), v[0] % 40];
  let n = 0;
  for (let i = 1; i < v.length; i++) { n = n * 128 + (v[i] & 0x7f); if (!(v[i] & 0x80)) { parts.push(n); n = 0; } }
  return parts.join(".");
}
function time(b, node) {
  const s = new TextDecoder().decode(b.subarray(node.body, node.end));
  const full = node.tag === 0x17 ? (+s.slice(0, 2) >= 50 ? "19" : "20") + s : s;
  return Date.UTC(+full.slice(0, 4), +full.slice(4, 6) - 1, +full.slice(6, 8), +full.slice(8, 10), +full.slice(10, 12), +full.slice(12, 14));
}
const CURVES = { "1.2.840.10045.3.1.7": ["P-256", 32], "1.3.132.0.34": ["P-384", 48] };
const HASHES = { "1.2.840.10045.4.3.2": "SHA-256", "1.2.840.10045.4.3.3": "SHA-384" };
// The parts of a certificate the check needs.
export function readCert(der) {
  const cert = tlv(der, 0), [tbs, alg, sig] = kids(der, cert), t = kids(der, tbs);
  const o = t[0].tag === 0xa0 ? 1 : 0; // explicit version
  const validity = kids(der, t[o + 3]), spki = t[o + 5], spkiAlg = kids(der, kids(der, spki)[0]);
  const exts = [];
  const extBox = t.slice(o + 6).find((x) => x.tag === 0xa3);
  if (extBox) kids(der, kids(der, extBox)[0]).forEach((e) => exts.push(oid(der, kids(der, e)[0])));
  const sigBits = der.subarray(sig.body + 1, sig.end); // skip the unused-bits byte
  return {
    der, tbs: der.subarray(tbs.start, tbs.end), sigHash: HASHES[oid(der, kids(der, alg)[0])], sig: sigBits,
    notBefore: time(der, validity[0]), notAfter: time(der, validity[1]),
    spki: der.subarray(spki.start, spki.end), curve: CURVES[oid(der, spkiAlg[1])], exts
  };
}
// An ECDSA signature as DER (SEQUENCE of r and s) to the fixed-length form WebCrypto checks.
function rawSig(der, size) {
  const seq = tlv(der, 0), [r, s] = kids(der, seq), out = new Uint8Array(size * 2);
  const put = (n, off) => { let v = der.subarray(n.body, n.end); while (v.length > size && v[0] === 0) v = v.subarray(1); out.set(v, off + size - v.length); };
  put(r, 0); put(s, size);
  return out;
}
const b64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
const hex = (buf) => Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, "0")).join("");
async function key(cert) {
  if (!cert.curve) throw new Error("unsupported key");
  return crypto.subtle.importKey("spki", cert.spki, { name: "ECDSA", namedCurve: cert.curve[0] }, false, ["verify"]);
}
async function signedBy(cert, issuer) {
  if (!cert.sigHash || !issuer.curve) return false;
  return crypto.subtle.verify({ name: "ECDSA", hash: cert.sigHash }, await key(issuer), rawSig(cert.sig, issuer.curve[1]), cert.tbs);
}

// Check a StoreKit transaction JWS. Returns the transaction when it proves an active Scales Plus subscription,
// otherwise throws with the reason. roots: allowed root fingerprints (tests pass their own).
// The chain and signature of any App Store signed record: a subscription transaction, or the app's own AppTransaction.
async function appleRecord(jws, roots, now) {
  const parts = String(jws || "").split(".");
  if (parts.length !== 3) throw new Error("not a JWS");
  const header = JSON.parse(new TextDecoder().decode(b64(parts[0])));
  if (header.alg !== "ES256" || !Array.isArray(header.x5c) || header.x5c.length !== 3) throw new Error("bad header");
  const [leaf, mid, root] = header.x5c.map((c) => readCert(b64(c)));
  if (!roots.includes(hex(await crypto.subtle.digest("SHA-256", root.der)))) throw new Error("unknown root");
  if (![leaf, mid, root].every((c) => c.notBefore <= now && now <= c.notAfter)) throw new Error("certificate dates");
  if (!leaf.exts.includes(OID_LEAF) || !mid.exts.includes(OID_INTERMEDIATE)) throw new Error("not an App Store certificate");
  if (!(await signedBy(mid, root)) || !(await signedBy(leaf, mid))) throw new Error("broken chain");
  const ok = leaf.curve && leaf.curve[0] === "P-256" &&
    await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, await key(leaf), b64(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!ok) throw new Error("bad signature");
  return JSON.parse(new TextDecoder().decode(b64(parts[1])));
}

export async function verifyPlus(jws, { roots = TRUSTED_ROOTS, now = Date.now() } = {}) {
  const t = await appleRecord(jws, roots, now);
  if (t.bundleId !== BUNDLE_ID || t.productId !== PLUS_PRODUCT) throw new Error("wrong app or product");
  if (t.environment !== "Production" && t.environment !== "Sandbox") throw new Error("wrong environment");
  if (t.revocationDate) throw new Error("refunded");
  if (!(t.expiresDate > now)) throw new Error("expired");
  return t;
}

// TestFlight preview (1.82.0): until the App Store approves Scales Plus, a TestFlight copy can turn Plus on to try it.
// The proof is the app's AppTransaction, signed by Apple: this app, in the Sandbox environment, which only TestFlight
// and development copies have. PLUS_PREVIEW=off on the server ends it; the app's ScalesPlusPreview flag hides it.
export async function verifyPreview(jws, { roots = TRUSTED_ROOTS, now = Date.now() } = {}) {
  const t = await appleRecord(jws, roots, now);
  if (t.bundleId !== BUNDLE_ID) throw new Error("wrong app");
  const env = t.environment || t.receiptType;
  if (env !== "Sandbox" && env !== "ProductionSandbox") throw new Error("not a TestFlight copy (" + env + ")");
  return t;
}

// Checked records, kept for this server instance until they expire, so a conversation is checked once.
const seen = new Map();
async function plusOk(jws) {
  const id = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(jws)));
  const until = seen.get(id);
  if (until && until > Date.now()) return true;
  try {
    const t = await verifyPlus(jws);
    if (seen.size > 2000) seen.clear();
    seen.set(id, t.expiresDate);
    return true;
  } catch (e) { return false; }
}
const seenPreview = new Map();
async function previewOk(jws) {
  const id = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(jws)));
  const until = seenPreview.get(id);
  if (until && until > Date.now()) return "";
  try {
    await verifyPreview(jws);
    if (seenPreview.size > 2000) seenPreview.clear();
    seenPreview.set(id, Date.now() + 36e5);
    return "";
  } catch (e) { return e.message || "not valid"; }
}

export async function onRequestPost({ request, env }) {
  const site = new URL(request.url).origin;
  if (request.headers.get("Origin") !== site) return reply(403, "forbidden", "Requests must come from the Scales app.");
  if (!env.ANTHROPIC_API_KEY) return reply(503, "not_configured", "The AI key is not set on the server.");
  const plus = request.headers.get("X-Scales-Plus"), preview = request.headers.get("X-Scales-Preview");
  const paid = !!plus && plus.length <= 12000 && await plusOk(plus);
  if (!paid) {
    if (!preview || preview.length > 12000) return reply(402, "plus_required", "AI in Scales needs Scales Plus.");
    if (env.PLUS_PREVIEW === "off") return reply(402, "plus_required", "The Scales Plus preview has ended.");
    const why = await previewOk(preview);
    if (why) return reply(402, "plus_required", "Preview not accepted: " + why + ".");
  }
  const text = await request.text();
  if (text.length > MAX_BODY) return reply(413, "too_large", "Request too large.");
  let body;
  try { body = JSON.parse(text); } catch (e) { return reply(400, "bad_json", "Request is not JSON."); }
  const messages = Array.isArray(body.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
  const ok = messages.length && messages.every((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string");
  if (!ok) return reply(400, "bad_messages", "Messages must be user or assistant text.");
  const req = { model: MODEL, max_tokens: MAX_TOKENS, messages };
  if (typeof body.system === "string") req.system = body.system.slice(0, MAX_SYSTEM);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(req)
  });
  return new Response(res.body, { status: res.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

export function onRequest() {
  return reply(405, "method", "Use POST.");
}
