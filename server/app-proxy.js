export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname === "/app") return Response.redirect(url.origin + "/app/" + url.search, 301);
  const path = url.pathname.replace(/^\/app\//, "");
  const res = await fetch("https://grahamdeno.github.io/scales/" + path + url.search, {
    method: context.request.method,
    headers: { "Accept": context.request.headers.get("Accept") || "*/*" }
  });
  const out = new Response(res.body, res);
  out.headers.set("Cache-Control", "no-cache");
  return out;
}
