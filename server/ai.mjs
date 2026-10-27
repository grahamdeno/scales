// Scales AI proxy (1.64.0): a Cloudflare Pages Function, deployed (renamed to functions/api/ai.js) in the Pages
// project that serves scales.tangomike.app. The app at scales.tangomike.app/app posts here; this adds the
// Anthropic key (the ANTHROPIC_API_KEY secret), fixes the model and limits, and passes the answer back.
// Nothing is stored or logged. Abuse limits: same-origin requests only, a Cloudflare rate-limiting rule on
// /api/ai, and a monthly spend limit on the Anthropic workspace. App Attest and the Scales Plus check come
// before 1.0.
const MODEL = "claude-haiku-5-5", MAX_TOKENS = 1024, MAX_BODY = 24000, MAX_MESSAGES = 16, MAX_SYSTEM = 4000;

function reply(status, type, message) {
  return new Response(JSON.stringify({ type: "error", error: { type, message } }),
    { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

export async function onRequestPost({ request, env }) {
  const site = new URL(request.url).origin;
  if (request.headers.get("Origin") !== site) return reply(403, "forbidden", "Requests must come from the Scales app.");
  if (!env.ANTHROPIC_API_KEY) return reply(503, "not_configured", "The AI key is not set on the server.");
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
