// Serves the repo on a local port, the same way the browser tests do.
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "..", "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".png": "image/png", ".webp": "image/webp",
  ".woff2": "font/woff2", ".json": "application/json", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".css": "text/css" };

function serve() {
  const server = http.createServer((q, s) => {
    let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
    s.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); s.end(fs.readFileSync(f));
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r({ base: "http://127.0.0.1:" + server.address().port, close: () => server.close() })));
}
module.exports = { serve, root };
