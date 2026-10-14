# NearMe v1.3

## Deploy this update
Replace the old deployment with this entire folder, including public, api, lib and server.js. Remove old live-location scripts/endpoints from your deployed project if they came from a different version. Redeploy/restart, then hard-refresh Chrome (Ctrl+Shift+R). The visitor header must say **v1.3**. This ZIP did not contain the live-sharing banner shown in the supplied screenshot.

## Changes
- No live-sharing button, banner, location watcher or background tracking.
- One-time location lookup for nearby results. Optional unchecked consent checkbox controls saving a visit for admin; nearby search works without saving it.
- Every place card shows rating, opening hours, open/closed status and crowd information, with explicit unavailable labels when missing.
- Google integration uses Places API (New), including rating/review count and current or weekly hours. Set GOOGLE_API_KEY server-side, enable Places API (New), configure billing and appropriate restrictions. Provider requests may incur charges. No key is included.
- Default OpenStreetMap source supplies opening_hours where available, but no star ratings. Complex OSM schedules are displayed as published; open-now is not guessed.
- Admin can publish Quiet / Moderate / Busy / Crowded reports. Copy the Place reference from a visitor card into the admin form. Reports are labelled Admin report, timestamped, and expire after one hour. Cards refresh these reports every minute. No automatic crowd measurement is configured.
- Google-sourced places are shown in cards; OSM map markers are only used for OSM places.

## Run
Node.js 18+; run `node server.js`, open http://localhost:3000 and /admin.
Set ADMIN_PASSWORD before deploying (legacy default is admin123). On Vercel use the included api routes and vercel.json. Configure KV_REST_API_URL and KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN) for shared persistent storage. Local Node uses data/*.json; Vercel without Redis uses temporary instance storage.

## Validation
Run `node --test test/*.test.js`. Tests mock provider responses; actual Google/OSM calls require network access and your configured key. Browser location requires HTTPS except localhost. No code can continue tracking through this page after the browser closes.

## v1.2: latest location per device and directions
- A random first-party browser ID is saved only when the visitor opts in to storing a visit. Subsequent consented visits update that device’s latest record.
- Admin map, table, counts and CSV show one latest record per browser ID. Previously saved duplicates sharing an ID are collapsed. Older records created with a different random ID on every visit cannot be reliably merged; clear old records from admin if needed.
- Directions opens Google Maps with the saved location as destination. Google Maps lets the admin use their current location or choose an origin.
- This identifies a browser profile, not a physical person: different browsers, private mode, clearing site storage or blocked storage can create separate entries. IP addresses are not used to merge people.
- Last recorded time is shown explicitly. No continuous or background location collection is added.

## v1.3: admin device names
Use Add name / Edit name in the admin table. Names appear in the table, map popups and CSV exports. They persist when the same browser/device submits a newer consented location. Leave the name blank to remove it. Clear all removes device records and names. Names are private admin labels, not verified identities. Redis saves names in a dedicated hash; local storage uses data/device-names.json.
