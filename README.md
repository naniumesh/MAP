# NearMe — location-gated website (nearby food / shopping / hotels)

## What it does

**Visitor side (`/`)** — The site is blocked by a full-screen gate. The visitor must tap *Allow location & enter* and approve the browser prompt; if they deny it, the site stays closed. Once allowed, a map opens on their position with the nearest **food**, **shopping** and **hotels**, nearest first, with ratings, open/closed, and directions links.

**Admin side (`/admin`, password protected)** — Map and table of every visit (exact lat/lng, accuracy, address, time, device, IP, Google Maps link, CSV export). *Set base = my location* shows each visit's distance from your point.

## Ratings, opening hours & "crowd"

The places come from one of two sources, chosen automatically:

- **Google Places (recommended for ratings)** — set a `GOOGLE_API_KEY` env var and each place shows its **star rating**, **review count**, and **open now / closed**. Needs a Google Cloud key with the *Places API* enabled and billing on (Google has a free monthly credit).
- **OpenStreetMap (default, free, no key)** — works out of the box, nearest-first, and shows **opening hours** where a place has them tagged, but OSM has **no ratings**.

**About live crowd / "how busy is it right now":** Google's *Popular Times* / live busyness is **not available through any official API** — Google does not expose it to developers, and scraping it breaks their terms. So I can't put a reliable live-crowd meter on the site. The honest options are star rating + review count (how well-liked a place is) and open/closed now, both of which are included. If you ever need live busyness, it only exists inside Google Maps itself.

## Files

```
public/index.html   visitor site: gate + nearby map + place cards
public/admin.html   admin: visits table + map + base distance
api/visit.js        POST /api/visit        record a visit
api/visits.js       GET/DELETE /api/visits read/clear visits (admin header)
api/places.js       GET /api/places        nearby places (Google if key, else OSM)
lib/                storage + shared logic
server.js           local test server
vercel.json         /admin rewrite
```

## Deploy on Vercel

1. Push to GitHub and import in Vercel (preset **Other**, no build), or `npx vercel --prod`.
2. **Settings → Environment Variables**:
   - `ADMIN_PASSWORD` — password for `/admin` (default `admin123`).
   - `GOOGLE_API_KEY` — optional; add it to get ratings instead of OSM.
3. **Storage → Create Database → Upstash Redis** (free) → connect. Adds `KV_REST_API_URL` / `KV_REST_API_TOKEN` automatically; without it, visits are temporary and admin shows an orange warning.
4. Redeploy. Vercel serves HTTPS, which the browser needs for location.

## Run locally

```
node server.js
```
Visitor: http://localhost:3000 · Admin: http://localhost:3000/admin (password `admin123`).

## Note

You store people's location, so keep the privacy line on the gate and tell visitors what you collect.
