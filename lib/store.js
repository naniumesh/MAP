// Visit storage. On Vercel: Upstash Redis (via Vercel Marketplace, free tier) using its REST API — no npm packages.
// Without Redis env vars it falls back to a local JSON file (fine for `node server.js`, NOT persistent on Vercel).
const fs = require("fs");
const path = require("path");

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = "nearme:visits";
const MAX = 5000;
const FILE = path.join(process.env.VERCEL ? "/tmp" : path.join(__dirname, "..", "data"), "visits.json");

async function redis(cmd) {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

function fileRead() { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return []; } }
function fileWrite(v) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(v, null, 2)); }

module.exports = {
  persistent: Boolean(URL_ && TOKEN),
  async add(visit) {
    if (URL_ && TOKEN) { await redis(["LPUSH", KEY, JSON.stringify(visit)]); await redis(["LTRIM", KEY, 0, MAX - 1]); return; }
    const v = fileRead(); v.unshift(visit); fileWrite(v.slice(0, MAX));
  },
  async all() {
    if (URL_ && TOKEN) return (await redis(["LRANGE", KEY, 0, MAX - 1])).map((s) => JSON.parse(s));
    return fileRead();
  },
  async clear() {
    if (URL_ && TOKEN) { await redis(["DEL", KEY]); return; }
    fileWrite([]);
  },
};
