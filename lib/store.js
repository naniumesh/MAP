// Storage: Upstash Redis REST on Vercel (env KV_REST_API_URL/TOKEN), else local JSON file for `node server.js`.
const fs = require("fs");
const path = require("path");

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const VKEY = "nearme:visits", LKEY = "nearme:live";
const MAX = 5000, LIVE_WINDOW = 60000; // a sharer counts as "live" only within 60s of their last update
const DIR = process.env.VERCEL ? "/tmp" : path.join(__dirname, "..", "data");
const f = (n) => path.join(DIR, n);
const useRedis = Boolean(URL_ && TOKEN);

async function redis(cmd) {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await r.json(); if (j.error) throw new Error(j.error); return j.result;
}
function fread(n) { try { return JSON.parse(fs.readFileSync(f(n), "utf8")); } catch { return null; } }
function fwrite(n, v) { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(f(n), JSON.stringify(v, null, 2)); }

module.exports = {
  persistent: useRedis,

  // --- Visit log (one record each time someone enters the site) ---
  async add(visit) {
    if (useRedis) { await redis(["LPUSH", VKEY, JSON.stringify(visit)]); await redis(["LTRIM", VKEY, 0, MAX - 1]); return; }
    const v = fread("visits.json") || []; v.unshift(visit); fwrite("visits.json", v.slice(0, MAX));
  },
  async all() {
    if (useRedis) return (await redis(["LRANGE", VKEY, 0, MAX - 1])).map((s) => JSON.parse(s));
    return fread("visits.json") || [];
  },
  async clear() { if (useRedis) await redis(["DEL", VKEY]); else fwrite("visits.json", []); },

  // --- Live sharing (only present while a person is knowingly, actively sharing) ---
  async setLive(id, rec) {
    if (useRedis) await redis(["HSET", LKEY, id, JSON.stringify(rec)]);
    else { const m = fread("live.json") || {}; m[id] = rec; fwrite("live.json", m); }
  },
  async removeLive(id) {
    if (useRedis) await redis(["HDEL", LKEY, id]);
    else { const m = fread("live.json") || {}; delete m[id]; fwrite("live.json", m); }
  },
  async liveAll() {
    let map = {};
    if (useRedis) { const a = await redis(["HGETALL", LKEY]) || []; for (let i = 0; i < a.length; i += 2) map[a[i]] = JSON.parse(a[i + 1]); }
    else map = fread("live.json") || {};
    const now = Date.now(), out = [];
    for (const [id, r] of Object.entries(map)) {
      if (now - (r.time || 0) > LIVE_WINDOW) { this.removeLive(id).catch(() => {}); continue; }
      out.push({ id, ...r });
    }
    return out;
  },
};
