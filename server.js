// Local test server (not used on Vercel — Vercel runs api/*.js). Run: node server.js
const http = require("http");
const fs = require("fs");
const path = require("path");
const { recordVisit, adminVisits } = require("./lib/handlers");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };

const send = (res, status, body, type = "application/json") => { res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" }); res.end(typeof body === "string" ? body : JSON.stringify(body)); };
const readBody = (req) => new Promise((ok, fail) => { let d = ""; req.on("data", (c) => { d += c; if (d.length > 1e5) req.destroy(); }); req.on("end", () => { try { ok(JSON.parse(d || "{}")); } catch (e) { fail(e); } }); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === "POST" && url.pathname === "/api/visit") { const o = await recordVisit(req, await readBody(req)); return send(res, o.status, o.body); }
    if (url.pathname === "/api/visits") { const o = await adminVisits(req); return send(res, o.status, o.body); }
  } catch (e) { return send(res, 500, { error: e.message }); }

  let file = url.pathname === "/" ? "/index.html" : url.pathname === "/admin" ? "/admin.html" : url.pathname;
  const full = path.join(PUBLIC_DIR, path.normalize(file).replace(/^(\.\.[/\\])+/, ""));
  if (full.startsWith(PUBLIC_DIR) && fs.existsSync(full) && fs.statSync(full).isFile()) {
    res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream" });
    return fs.createReadStream(full).pipe(res);
  }
  send(res, 404, "Not found", "text/plain");
}).listen(PORT, () => {
  console.log(`NearMe:  http://localhost:${PORT}`);
  console.log(`Admin:   http://localhost:${PORT}/admin  (password: ${process.env.ADMIN_PASSWORD || "admin123"})`);
});
