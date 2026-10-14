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
  const types = {food: ['restaurant','cafe','fast_food_restaurant'], shop: ['shopping_mall','supermarket','store'], hotel: ['hotel','lodging']};
  const r = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: {'Content-Type':'application/json','X-Goog-Api-Key':key,
      'X-Goog-FieldMask':'places.id,places.displayName,places.location,places.primaryType,places.rating,places.userRatingCount,places.currentOpeningHours,places.regularOpeningHours,places.businessStatus'},
    body: JSON.stringify({includedTypes:types[cat],maxResultCount:12,rankPreference:'DISTANCE',languageCode:'en',
      locationRestriction:{circle:{center:{latitude:lat,longitude:lng},radius:OSM[cat].radius}}})
  });
  if (!r.ok) throw new Error('Place provider unavailable. Check Places API (New) and billing configuration.');
  const j = await r.json();
  return (j.places || []).filter(p => p.businessStatus !== 'CLOSED_PERMANENTLY').map(p => ({
    id:'google:'+p.id, name:p.displayName?.text, lat:p.location?.latitude, lng:p.location?.longitude,
    kind:(p.primaryType || '').replace(/_/g,' '),rating:p.rating ?? null,reviews:p.userRatingCount ?? null,
    openNow:p.currentOpeningHours?.openNow ?? null,
    hours:(p.currentOpeningHours?.weekdayDescriptions || p.regularOpeningHours?.weekdayDescriptions || []).join('\n') || null
  })).filter(p => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng));
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
        id: `osm:${e.type}:${e.id}`, name: e.tags?.name, lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon,
        kind: (e.tags?.cuisine || e.tags?.amenity || e.tags?.shop || e.tags?.tourism || "").replace(/_/g, " "),
        rating: null, reviews: null, openNow: null,
        hours: e.tags?.opening_hours || null,
      })).filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng));
    } catch (e) { lastErr = `${url} -> ${e.message}`; }
  }
  throw new Error(lastErr);
}

module.exports = async (req, res) => {
  const cat = req.query.cat, lat = Number(req.query.lat), lng = Number(req.query.lng);
  if (!OSM[cat] || !isFinite(lat) || !isFinite(lng) || Math.abs(lat)>90 || Math.abs(lng)>180 || !req.query.lat?.trim() || !req.query.lng?.trim()) return res.status(400).json({ error: "bad request" });
  const key = process.env.GOOGLE_API_KEY;
  try {
    let places = key ? await fromGoogle(cat, lat, lng, key) : await fromOSM(cat, lat, lng);
    places = places.map((p) => ({ ...p, dist: Math.round(haversine(lat, lng, p.lat, p.lng)) })).sort((a, b) => a.dist - b.dist).slice(0, 15);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ source: key ? "google" : "osm", places });
  } catch (e) { res.status(502).json({ error: "Place provider unavailable. Check server configuration or retry later." }); }
};
