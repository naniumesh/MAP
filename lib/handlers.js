const crypto = require("crypto");
const store = require("./store");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

function isAdmin(req) {
  return (req.headers["x-admin-password"] || "") === ADMIN_PASSWORD;
}

async function recordVisit(req, body) {
  const lat = Number(body.lat), lng = Number(body.lng);
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { status: 400, body: { error: "bad coordinates" } };
  const visit = {
    id: crypto.randomUUID(),
    visitorId: String(body.visitorId || "").slice(0, 64) || crypto.randomUUID(),
    lat, lng,
    accuracy: Number(body.accuracy) || null,
    address: String(body.address || "").slice(0, 300),
    time: new Date().toISOString(),
    ip: (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "",
    userAgent: String(req.headers["user-agent"] || "").slice(0, 200),
  };
  await store.add(visit);
  return { status: 200, body: { ok: true, id: visit.id } };
}

async function adminVisits(req) {
  if (!isAdmin(req)) return { status: 401, body: { error: "unauthorized" } };
  if (req.method === "DELETE") { await store.clear(); return { status: 200, body: { ok: true } }; }
  return { status: 200, body: { persistent: store.persistent, visits: await store.all() } };
}

module.exports = { recordVisit, adminVisits, isAdmin };
