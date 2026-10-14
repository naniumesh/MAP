// GET /api/places?cat=food|shop|hotel&lat=..&lng=..
// If GOOGLE_API_KEY is set -> Google Places (gives rating, review count, open-now).
// Otherwise -> OpenStreetMap Overpass (free, no key; no ratings, but includes opening hours when tagged).

const OSM = {
  food:  { radius: 2000, query: 'nwr["amenity"~"^(restaurant|cafe|fast_food|food_court|ice_cream)$"]' },
  shop:  { radius: 2000, query: 'nwr["shop"~"^(mall|supermarket|department_store|clothes|convenience|electronics|bakery|jewelry|books|shoes)$"]' },
  hotel: { radius: 3000, query: 'nwr["tourism"~"^(hotel|guest_house|hostel|motel)$"]' },
};
const OSM_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const GOOGLE_TYPE = { food: "restaurant", shop: "store", hotel: "lodging" };

function haversine(a, b, c, d) { const R = 6371000, r = Math.PI / 180, dl = (c - a) * r, dn = (d - b) * r;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }

async function fromGoogle(cat, lat, lng, key) {
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&rankby=distance&type=${GOOGLE_TYPE[cat]}&key=${key}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const j = await r.json();
  if (j.status && j.status !== "OK" && j.status !== "ZERO_RESULTS") throw new Error("google: " + j.status + (j.error_message ? " - " + j.error_message : ""));
  return (j.results || []).map((p) => ({
    name: p.name,
    lat: p.geometry?.location?.lat, lng: p.geometry?.location?.lng,
    kind: (p.types || []).find((t) => !["point_of_interest", "establishment", "food"].includes(t))?.replace(/_/g, " ") || "",
    rating: p.rating ?? null,
    reviews: p.user_ratings_total ?? null,
    openNow: p.opening_hours?.open_now ?? null,
    closedPermanently: p.business_status === "CLOSED_PERMANENTLY",
  })).filter((p) => p.name && p.lat && !p.closedPermanently);
}

async function fromOSM(cat, lat, lng) {
  const c = OSM[cat];
  const q = `[out:json][timeout:20];${c.query}(around:${c.radius},${lat},${lng});out center tags 80;`;
  let lastErr = "no server answered";
  for (const url of OSM_SERVERS) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "NearMe/1.0" }, body: "data=" + encodeURIComponent(q), signal: AbortSignal.timeout(22000) });
      if (!r.ok) { lastErr = `${url} -> ${r.status}`; continue; }
      const j = await r.json();
      return (j.elements || []).map((e) => ({
        name: e.tags?.name, lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon,
        kind: (e.tags?.cuisine || e.tags?.amenity || e.tags?.shop || e.tags?.tourism || "").replace(/_/g, " "),
        rating: null, reviews: null, openNow: null,
        hours: e.tags?.opening_hours || null,
      })).filter((p) => p.name && p.lat);
    } catch (e) { lastErr = `${url} -> ${e.message}`; }
  }
  throw new Error(lastErr);
}

module.exports = async (req, res) => {
  const cat = req.query.cat, lat = Number(req.query.lat), lng = Number(req.query.lng);
  if (!OSM[cat] || !isFinite(lat) || !isFinite(lng)) return res.status(400).json({ error: "bad request" });
  const key = process.env.GOOGLE_API_KEY;
  try {
    let places = key ? await fromGoogle(cat, lat, lng, key) : await fromOSM(cat, lat, lng);
    places = places.map((p) => ({ ...p, dist: Math.round(haversine(lat, lng, p.lat, p.lng)) })).sort((a, b) => a.dist - b.dist).slice(0, 15);
    res.setHeader("Cache-Control", "s-maxage=180");
    res.status(200).json({ source: key ? "google" : "osm", places });
  } catch (e) { res.status(502).json({ error: e.message }); }
};
