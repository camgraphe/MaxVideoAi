# Contributing to MaxVideoAI (Public Repository)

This repository intentionally contains **only** marketing/UI assets that can be shared under the Business Source License 1.1. All production logic, pricing engines, Fal.ai integrations, and monetisation code live in the private `maxvideoai-internal` repository.

## Ground Rules

1. **Do not commit sensitive code here.** Backend routes, pricing constants, provider SDKs, or API keys belong in the private repo.  
2. **Run the exposure guard before pushing:**
   ```bash
   npm run lint:exposure
   ```
   The script fails if any forbidden paths or `.env*` files are present.  
3. **No secrets in Git.** Never commit `.env` files or keys. Use Vercel/GitHub secrets.  
4. **UI contributions only.** Focus on marketing pages, mock data, and visual polish. Functional changes to the product go through the private repo.

## Development Flow

1. Fork or branch from `main`.  
2. Make UI changes, update docs as needed.  
3. Run lint/checks:
   ```bash
   npm run lint:exposure
   npm run lint --workspace frontend
   ```
4. Open a pull request. A maintainer will confirm the exposure checklist before merging.

## Commercial Features

If you need access to production code or want to integrate MaxVideoAI commercially, contact `licensing@maxvideo.ai` for the commercial licence programme (see `docs/licensing/dual-license.md`).
