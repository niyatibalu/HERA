# Deploying HERA

| Service | Host | Why |
|---|---|---|
| `backend/` (FastAPI) | Railway | Keeps demo state in memory, so it needs one long-running process, not serverless functions |
| `map/` (stdlib Python) | Railway | Same, plus it serves the interactive map page |
| `frontend/` (Vite) | Vercel | Static site on a CDN |

All data is synthetic, and the MyChart connection is simulated. Nothing secret is deployed.

## Railway (backend + map)

Each service has a `railway.json` (start command + `/health` health check) and a `.python-version`.

```bash
npx @railway/cli login
npx @railway/cli init --name hera
npx @railway/cli add --service backend
npx @railway/cli add --service map
(cd backend && npx @railway/cli up --service backend --detach)
npx @railway/cli domain --service backend          # → https://backend-xxxx.up.railway.app
npx @railway/cli variables --service map --set HERA_API_URL=https://<backend domain>
(cd map && npx @railway/cli up --service map --detach)
npx @railway/cli domain --service map              # → https://map-xxxx.up.railway.app
```

## Vercel (frontend)

`frontend/vercel.json` builds with Vite and rewrites every path to `index.html` (client-side routing).
The `VITE_*` URLs are baked in at build time:

```bash
cd frontend
npx vercel login
npx vercel link --yes
npx vercel env add VITE_HERA_API_URL production   # https://<backend domain>
npx vercel env add VITE_HERA_MAP_URL production   # https://<map domain>
npx vercel deploy --prod
```

## After deploying

- Check it: `python3 map/tools/preflight.py --backend https://<backend> --map https://<map> --frontend https://<vercel url>`
- Reset the demo between rehearsals (restores MyChart, journeys, symptom notes, consent):
  `curl -X POST https://<backend domain>/demo/reset`
- If the backend is down, the frontend and map fall back to synthetic demo data automatically.
