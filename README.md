# NearMe — location-gated website with nearby places + opt-in live sharing

## What it does

**Visitor side (`/`)** — The site is blocked by a full-screen gate. The visitor must tap *Allow location & enter* and approve the browser prompt; if they deny it, the site stays closed. Once allowed, a map opens on their position with the nearest **food**, **shopping** and **hotels** (OpenStreetMap, no API key), sorted by distance with directions links.

**Live sharing (opt-in, visible)** — A *Share my live location* button lets the visitor broadcast their position live. The whole time they share, a green banner tells them it's on, and a *Stop sharing* button ends it; it also stops automatically when they close the page. They're asked for a display name (their choice; can be left blank). This only works while the page is open — a web page cannot track anyone in the background or after they leave.

**Admin side (`/admin`, password protected)** — A map and table of every visit (exact lat/lng, accuracy, address, time, device, IP, Google Maps link, CSV export). Anyone **currently** sharing live appears as a moving green dot, refreshed every 5 seconds, labelled with the name they chose; the dot disappears when they stop. *Set base = my location* stores a base point so each visit and live dot shows its distance from you.

## Files

```
public/index.html   visitor site: gate, nearby map, live-share button
public/admin.html   admin: visits + live sharers + base distance
api/visit.js        POST /api/visit       record a visit
api/visits.js       GET/DELETE /api/visits read/clear visits (admin header)
api/places.js       GET /api/places        nearby-places proxy (fixes CORS)
api/live.js         POST /api/live         sharer pushes/stops their live position
api/live-view.js    GET /api/live-view     admin reads active sharers (admin header)
lib/                storage + shared logic
server.js           local test server (node server.js)
vercel.json         /admin rewrite
```

## Deploy on Vercel

1. Push this folder to GitHub and import it in Vercel (Framework preset **Other**, no build step), or run `npx vercel --prod` inside the folder.
2. **Settings → Environment Variables**: set `ADMIN_PASSWORD` to a strong password (default `admin123`).
3. **Storage → Create Database → Upstash Redis** (free) → connect to the project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`; the code reads them automatically. Without it, Vercel functions have no disk, so visits and live positions are temporary and the admin page shows an orange warning.
4. Redeploy. Vercel serves HTTPS, which the browser requires for location.

## Run locally

```
node server.js
```
Visitor: http://localhost:3000 · Admin: http://localhost:3000/admin (password `admin123`). Locally, data is saved under `data/`.

## Notes & limits

- **Background tracking is not possible from a website.** Live sharing works only while the sharing tab is open and the person sees it's on; there is no way for a web page to follow someone after they leave or when the tab is closed. Continuous tracking of a person only exists in an installed app they explicitly consent to.
- **Consent is built in.** The person starting live sharing always sees the banner and can stop anytime. Don't label or track identified people without their knowledge — besides being wrong, it's illegal in most places.
- OpenStreetMap has no ratings, so "best" is ranked by distance. To use Google star ratings, swap `api/places.js` for the Google Places Nearby Search API (needs a billing-enabled key).
- Since you store people's location, keep the privacy notice on the gate and tell visitors what you collect.
