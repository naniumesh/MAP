// Storage: Upstash Redis REST on Vercel (env KV_REST_API_URL/TOKEN), else local JSON file for `node server.js`.
const fs = require("fs");
const path = require("path");

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const VKEY = "nearme:visits";
const MAX = 5000;
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
  async crowd(id) {
    if (useRedis) { const value = await redis(['GET','nearme:crowd:'+id]); return value ? JSON.parse(value) : null; }
    const value = (fread('crowds.json') || {})[id];
    return value && Date.parse(value.expiresAt)>Date.now() ? value : null;
  },
  async setCrowd(id, value) {
    if (useRedis) return redis(['SET','nearme:crowd:'+id,JSON.stringify(value),'EX',3600]);
    const values=fread('crowds.json') || {};
    for (const key of Object.keys(values)) if (Date.parse(values[key].expiresAt)<=Date.now()) delete values[key];
    values[id]=value; fwrite('crowds.json',values);
  },

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
};
