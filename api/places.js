// GET /api/places?cat=food|shop|hotel&lat=..&lng=..  — proxies OpenStreetMap Overpass (avoids browser CORS limits)
const CATS = {
  food:  { radius: 2000, query: 'nwr["amenity"~"^(restaurant|cafe|fast_food|food_court|ice_cream)$"]' },
  shop:  { radius: 2000, query: 'nwr["shop"~"^(mall|supermarket|department_store|clothes|convenience|electronics|bakery|jewelry|books|shoes)$"]' },
  hotel: { radius: 3000, query: 'nwr["tourism"~"^(hotel|guest_house|hostel|motel)$"]' },
};
const SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

module.exports = async (req, res) => {
  const cat = CATS[req.query.cat];
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  if (!cat || !isFinite(lat) || !isFinite(lng)) return res.status(400).json({ error: "bad request" });
  const q = `[out:json][timeout:20];${cat.query}(around:${cat.radius},${lat},${lng});out center tags 80;`;

  let lastErr = "no server answered";
  for (const url of SERVERS) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "NearMe/1.0 (vercel app)" },
        body: "data=" + encodeURIComponent(q),
        signal: AbortSignal.timeout(22000),
      });
      if (!r.ok) { lastErr = `${url} -> ${r.status}`; continue; }
      const j = await r.json();
      const places = (j.elements || []).map((e) => ({
        name: e.tags?.name, lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon,
        kind: e.tags?.cuisine || e.tags?.amenity || e.tags?.shop || e.tags?.tourism || "",
      })).filter((p) => p.name && p.lat);
      res.setHeader("Cache-Control", "s-maxage=300");
      return res.status(200).json({ places });
    } catch (e) { lastErr = `${url} -> ${e.message}`; }
  }
  res.status(502).json({ error: lastErr });
};
