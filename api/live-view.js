// GET /api/live-view — admin reads everyone CURRENTLY sharing (updated in the last 60s). Needs admin password.
const store = require("../lib/store");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
module.exports = async (req, res) => {
  if ((req.headers["x-admin-password"] || "") !== ADMIN_PASSWORD) return res.status(401).json({ error: "unauthorized" });
  try { res.setHeader("Cache-Control", "no-store"); res.status(200).json({ live: await store.liveAll() }); }
  catch (e) { res.status(500).json({ error: e.message }); }
};
