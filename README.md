# NearMe — location-gated website with admin visitor map

**Visitor side:** the site is blocked by a full-screen gate. The visitor must press *Allow location & enter* and approve the browser's location prompt. If they deny it, the site stays closed. Once allowed, a map opens on their exact position with the nearest **food**, **shopping** and **hotels** (from OpenStreetMap, no API key needed), sorted by distance, with directions links.

**Admin side (`/admin`):** password protected. Shows every visit on a map and in a table — exact latitude/longitude, accuracy, readable address, time, device, IP, and a link to open the spot in Google Maps. CSV download and clear-all included. Visitors never type anything; only their location is collected.

## Project layout

```
public/index.html   visitor site (gate + map + nearby places)
public/admin.html   admin page
api/visit.js        POST /api/visit   – browser sends location
api/visits.js       GET/DELETE /api/visits – admin reads/clears (needs password header)
lib/                storage + shared logic
server.js           local test server (node server.js)
vercel.json         /admin rewrite
```

## Deploy on Vercel (your farwell-even-website project)

1. Push this folder to a GitHub repo and import it in Vercel (or run `npx vercel` inside the folder). No build step — Framework preset: **Other**.
2. In Vercel → Project → **Settings → Environment Variables** add:
   - `ADMIN_PASSWORD` = a strong password for `/admin` (default is `admin123` — change it).
3. **Add permanent storage** (Vercel functions have no disk, so without this, visits disappear after a while):
   Vercel → Project → **Storage → Create Database → Upstash Redis** (free tier) → connect it to the project.
   This automatically adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`; the code picks them up with no changes.
   Until you do this, the admin page shows an orange "Storage is not connected" bar.
4. Redeploy. Open `https://farwell-even-website.vercel.app/` → the gate appears → allow location → map and places load.
   Open `https://farwell-even-website.vercel.app/admin` → enter the password → see the visitor's location.

Vercel serves HTTPS, which the browser requires for location sharing.

## Run locally

```
node server.js
```
Visitor site: http://localhost:3000 · Admin: http://localhost:3000/admin (password `admin123`). Locally, visits are saved to `data/visits.json`.

## Notes

- Nearby places come from the free OpenStreetMap Overpass API (restaurants/cafés/fast food within 2 km, shops and malls within 2 km, hotels within 3 km). OSM has no star ratings, so "best" is ranked by distance. To rank by Google ratings instead, swap the Overpass call in `index.html` for the Google Places Nearby Search API (needs a billing-enabled API key).
- Each browser gets an anonymous device id so repeat visits from the same phone group together in admin.
- Since you store people's exact location, add a short privacy notice to the site (the gate already states that the position is recorded).
