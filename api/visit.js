// POST /api/visit — visitor's browser sends its location (no login, no form)
const { recordVisit } = require("../lib/handlers");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const out = await recordVisit(req, body);
    res.status(out.status).json(out.body);
  } catch (e) { res.status(500).json({ error: e.message }); }
};
