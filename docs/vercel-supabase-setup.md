Vercel + Supabase setup via CLI

Prereqs
- Vercel CLI: `npm i -g vercel` then `vercel login`
- In this repo, frontend lives at `frontend/`.

Link project
- From `frontend/`: `vercel link`
  - If `.vercel/project.json` exists, it should auto‑link. Otherwise pick org/project.

Environment variables
Add Supabase envs to Vercel for all envs (development, preview, production).

Interactive adds
- `vercel env add NEXT_PUBLIC_SUPABASE_URL development`
- `vercel env add NEXT_PUBLIC_SUPABASE_URL preview`
- `vercel env add NEXT_PUBLIC_SUPABASE_URL production`
- `vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY development`
- `vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview`
- `vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production`

Optional server‑only key (API routes only; never expose client‑side):
- `vercel env add SUPABASE_SERVICE_ROLE_KEY development`
- `vercel env add SUPABASE_SERVICE_ROLE_KEY preview`
- `vercel env add SUPABASE_SERVICE_ROLE_KEY production`

Non‑interactive (pipe values)
Replace VALUE… with actual values.

```bash
echo "https://YOUR-PROJECT.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL development
echo "https://YOUR-PROJECT.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL preview
echo "https://YOUR-PROJECT.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL production

echo "YOUR-ANON-KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY development
echo "YOUR-ANON-KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
echo "YOUR-ANON-KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production

# optional service role (server only)
echo "YOUR-SERVICE-ROLE-KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY development
echo "YOUR-SERVICE-ROLE-KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY preview
echo "YOUR-SERVICE-ROLE-KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY production
```

Pull envs locally
- From `frontend/`: `vercel env pull .env.local`
- Then run: `npm run dev`

Supabase dashboard configuration
- Project Settings → API → copy Project URL and anon public.
- Authentication → URL Configuration:
  - Site URL: `https://your-site.vercel.app`
  - Redirect URLs: add
    - `https://your-site.vercel.app/`
    - `https://your-site.vercel.app/login`
    - `https://*.vercel.app` (for previews)
  - OAuth providers: add same redirect domains.

Notes
- Keep `SUPABASE_SERVICE_ROLE_KEY` server‑only. Do not expose to the browser.
- `frontend/.env.local.example` defaults `NEXT_PUBLIC_API_BASE=/api` for Vercel.
- Rotate any secrets that were ever committed locally.

