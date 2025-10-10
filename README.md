# MaxVideoAI — Generate Page Mock & Frontend

This repo contains:

- Product & UX spec (`max_video_ai_generate_page_spec_v_1.md`).
- Mock API (`mock-server.js`) that serves deterministic responses for `/api/engines` and `/api/preflight` using `fixtures/`.
- Docker support so the mock can run in isolation.
- A Next.js frontend scaffold in `frontend/` that consumes the mock API and demonstrates the capability-driven UI skeleton.

## 1. Prerequisites

- Node.js 20+
- Docker (optional but recommended for the mock API)

## 2. Mock API

### Local (Node)

```bash
npm install
npm start
```

The server runs on `http://127.0.0.1:3333` by default.

### Docker

```bash
docker build -t maxvideoai-mock .
docker run --rm -p 3333:3333 -e CORS_ORIGIN="*" maxvideoai-mock
```

Or with Compose:

```bash
docker compose up --build
```

Health checks:

```bash
curl -s http://127.0.0.1:3333/api/engines | jq
curl -s http://127.0.0.1:3333/api/preflight \
  -H "Content-Type: application/json" \
  -d '{"engine":"veo3","mode":"t2v","durationSec":8,"resolution":"1080p","aspectRatio":"16:9","fps":24,"addons":{"upscale4k":false,"audio":true},"user":{"memberTier":"Plus"}}' | jq
```

## 3. Frontend (Next.js)

Inside `frontend/`:

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_BASE` in `.env.local` to match the mock base URL.

Key behaviours implemented:

- Engine selection updates capability-driven controls instantly.
- Composer sits below the preview, with dropzones that appear only for `i2v`/`v2v` modes supported by the engine.
- PRICE-BEFORE pill fed by `POST /preflight`, refreshes (<200 ms debounce) when core settings change.
- Overlays for Upscale 4K & Audio respect engine capabilities.
- Basic badges (PAY-AS-YOU-GO / PRICE-BEFORE) and membership hints inline with the spec.

## Licensing & Repository Layout

- **Licence**: Business Source License 1.1 (BUSL 1.1). See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).  
- **Change Date**: 10 October 2028 → Apache 2.0.  
- **Usage**: Non-commercial evaluation of the UI and marketing assets only.

Only marketing/UI modules remain in this public repo. Backend services, pricing logic, Fal.ai integrations, and monetisation code live in a private repository. Refer to [`docs/public-vs-private.md`](docs/public-vs-private.md) for the checklist used before mirroring changes; the `private/` folder (ignored by Git) is a temporary staging area before pushing code to the internal repo.

Before syncing the public mirror, run:

```bash
npm run lint:exposure
```

The script (`scripts/check-public-exposure.mjs`) fails if sensitive folders or `.env*` files are still present.

### Commercial Licence Track

MaxVideoAI offers a separate commercial licence for partners that need production rights, backend access, or support. The operating model and contract checklist are described in [`docs/licensing/dual-license.md`](docs/licensing/dual-license.md).  
Contact `licensing@maxvideo.ai` to initiate the commercial process.

## 4. Switching to Real Backend

- Keep the same interface: `/api/engines`, `/api/preflight`.
- Adjust `NEXT_PUBLIC_API_BASE` to the live endpoint.
- Preserve the mock by running it on a different port (e.g. 3334) and toggling via env.

## 5. Known Limitations

- The mock API runs in-memory; persistence/job streaming left to the real backend.
- No automated tests yet (awaiting backend contract confirmation).
- Preview/gallery content is placeholder; real media wiring is pending asset APIs.

## Deployment Overview

- **Public marketing site** → GitHub (`maxvideoai-public`) → Vercel project `maxvideoai-marketing`.  
- **Internal application** → private repo (`maxvideoai-internal`) → Vercel project `maxvideoai-app` (or alternative infrastructure).  
- Deployment guidelines and checklists live in [`docs/deployment/github-vercel.md`](docs/deployment/github-vercel.md).
