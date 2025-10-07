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

## 4. Switching to Real Backend

- Keep the same interface: `/api/engines`, `/api/preflight`.
- Adjust `NEXT_PUBLIC_API_BASE` to the live endpoint.
- Preserve the mock by running it on a different port (e.g. 3334) and toggling via env.

## 5. Known Limitations

- The mock API runs in-memory; persistence/job streaming left to the real backend.
- No automated tests yet (awaiting backend contract confirmation).
- Preview/gallery content is placeholder; real media wiring is pending asset APIs.
