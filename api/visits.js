// GET /api/visits — admin reads all locations (header x-admin-password). PATCH updates a device name. DELETE clears records and names.
const { adminVisits } = require("../lib/handlers");
module.exports = async (req, res) => {
  try {
    const out = await adminVisits(req);
    res.setHeader("Cache-Control", "no-store");
    res.status(out.status).json(out.body);
  } catch (e) { res.status(500).json({ error: e.message }); }
};
