# Contributing to MaxVideoAI

## Ground Rules

1. **Keep secrets out of source control.** Never commit `.env` files, API keys, or credentials. Use Vercel/GitHub secrets instead.  
2. **Run the exposure guard before pushing:**
   ```bash
   npm run lint:exposure
   ```
   The script fails if any forbidden paths or `.env*` files are present.  
3. **Stay production-safe.** Review changes for anything that could leak pricing terms, partner contracts, or user data.

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
