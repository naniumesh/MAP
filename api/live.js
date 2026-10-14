// POST /api/live  — the visitor's own browser pushes its live position WHILE they are actively sharing.
// Body: {visitorId, name, lat, lng, accuracy, sharing:true|false}. sharing:false stops it.
const store = require("../lib/store");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const b = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const id = String(b.visitorId || "").slice(0, 64);
    if (!id) return res.status(400).json({ error: "no id" });
    if (b.sharing === false) { await store.removeLive(id); return res.status(200).json({ ok: true, stopped: true }); }
    const lat = Number(b.lat), lng = Number(b.lng);
    if (!isFinite(lat) || !isFinite(lng)) return res.status(400).json({ error: "bad coords" });
    await store.setLive(id, { name: String(b.name || "").slice(0, 60), lat, lng, accuracy: Number(b.accuracy) || null, time: Date.now() });
    res.status(200).json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
