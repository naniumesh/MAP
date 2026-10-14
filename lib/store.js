// Storage: Upstash Redis REST on Vercel (env KV_REST_API_URL/TOKEN), else local JSON file for `node server.js`.
const fs = require("fs");
const path = require("path");

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const VKEY = "nearme:visits";
const MAX = 5000;
const DIR = process.env.VERCEL ? "/tmp" : (process.env.NEARME_DATA_DIR || path.join(__dirname, "..", "data"));
const f = (n) => path.join(DIR, n);
const useRedis = Boolean(URL_ && TOKEN);

async function redis(cmd) {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await r.json(); if (j.error) throw new Error(j.error); return j.result;
}
function fread(n) { try { return JSON.parse(fs.readFileSync(f(n), "utf8")); } catch { return null; } }
function fwrite(n, v) { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(f(n), JSON.stringify(v, null, 2)); }

// Keep the newest record per browser, including duplicate records from older releases.
function latestPerDevice(visits) {
  const seen = new Set();
  return visits.slice().sort((a,b) => Date.parse(b.time)-Date.parse(a.time)).filter(v => {
    const key=v.visitorId || v.id;
    if(seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, MAX);
}

// Atomic upsert prevents two concurrent Redis submissions from losing devices.
const UPSERT = `
local rows = redis.call('LRANGE', KEYS[1], 0, -1)
local fresh = cjson.decode(ARGV[1])
local keep = {}
for _, raw in ipairs(rows) do
  local old = cjson.decode(raw)
  if old.visitorId ~= fresh.visitorId then table.insert(keep, raw)
  elseif old.time > fresh.time then fresh = old end
end
redis.call('DEL', KEYS[1])
redis.call('RPUSH', KEYS[1], cjson.encode(fresh))
for i=1, math.min(#keep, tonumber(ARGV[2])-1) do redis.call('RPUSH', KEYS[1], keep[i]) end
return 1
`;

module.exports = {
  latestPerDevice,
  async setName(visitorId, name) {
    if (useRedis) {
      if (name) await redis(['HSET', 'nearme:device-names', visitorId, name]);
      else await redis(['HDEL', 'nearme:device-names', visitorId]);
      return;
    }
    const names=fread('device-names.json') || {};
    if(name) names[visitorId]=name; else delete names[visitorId];
    fwrite('device-names.json',names);
  },
  async names() {
    if(!useRedis) return fread('device-names.json') || {};
    const pairs=await redis(['HGETALL','nearme:device-names']);
    const names={};
    for(let i=0;i<pairs.length;i+=2) names[pairs[i]]=pairs[i+1];
    return names;
  },
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

  // One latest consented visit per browser/device.
  async add(visit) {
    if (useRedis) { await redis(['EVAL', UPSERT, 1, VKEY, JSON.stringify(visit), MAX]); return; }
    const visits = latestPerDevice([visit, ...(fread('visits.json') || [])]);
    fwrite('visits.json', visits);
  },
  async all() {
    const visits = useRedis
      ? (await redis(['LRANGE', VKEY, 0, MAX-1])).map(s => JSON.parse(s))
      : (fread('visits.json') || []);
    return latestPerDevice(visits);
  },
  async clear() { if (useRedis) await redis(['DEL', VKEY, 'nearme:device-names']); else { fwrite('visits.json', []); fwrite('device-names.json', {}); } },
};
