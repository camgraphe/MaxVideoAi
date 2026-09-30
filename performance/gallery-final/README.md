# Gallery release comparison

This is a reproducible **lab** comparison for the gallery release gate. It does not read production database credentials, write to production, or replace CrUX/GSC field data.

The workflow compares integrated `main` at `0c6572d8ff43803b7a7024f6c4c854b96d932953` with the PR candidate. The application files in that candidate must still match `6d406f497aa4db6b42153e33139554915d95f48d`; later test/documentation commits are permitted. Both checkouts use the same frozen 316-card public snapshot (SHA-256 in `manifest.json`) and a disposable local PostgreSQL service. The app connections are read-only. No production API or Neon credential is used. The public media origin is still fetched by Chrome and the Next image optimizer, as on real pages.

The workflow runs on a scoped push to `codex/video-discovery` when this directory or the workflow changes. `workflow_dispatch` also exists for later manual runs after the workflow reaches the default branch. The raw report artifact is kept for seven days.

The frozen database is identical for both versions; API eligibility is derived by bundling each exact checkout's authored discovery helper. Pinned main returns 251 hub videos because its legacy identifier matching omits 15 captured videos (Veo aliases, Luma Ray 2/Flash and Pika image-to-video); the candidate correctly returns all 266. Wan returns 25 in both. The first 24 hub videos must be identical, and each API must match its full expected returned order and total. `api-projections.json` records complete expected IDs, exclusions and exact source SHAs. These differences are preserved and documented, not normalized by changing application code or the fixture.

For each of four routes (hub, Wan family, landscape watch, portrait watch) on mobile 412×823 DPR 1.75 and desktop 1350×940 DPR 1, Lighthouse 12.6.1 makes three cold visits per version. Warm visits use separate persistent Chrome profiles per version/route/device; the first visit is discarded and the next two are retained. Version order alternates. A Playwright check runs before the matrix to verify both watch pages request no media before Play and reach `playing` after the user's click. A public API probe records counts and the first 24 curated IDs. Chrome version, build IDs, exact Git SHAs, fixture hash, per-run CPU benchmark index, LHR JSON, DevTools logs, selected traces and server/build logs are retained.

`metadata.json` must say `complete`. A missing route, warning, failed playback, unverified warm image/CSS disk cache, or over 20% within-group CPU benchmark drift marks the run incomplete. Compare medians in `summary.json`; inspect `runs.json` and LHRs for outliers and the actual LCP element before deciding. An incomplete run is not evidence of improvement or regression. Even a complete lab improvement cannot establish field INP or a green GSC outcome, which require post-deployment real-user data over Google's rolling window.

An early dev-server fixture/First Play smoke runs before the expensive builds; it is functional evidence only. The production-build smoke and complete Lighthouse matrix still run afterward. First Play contexts click the real **Reject all** consent button before Play; their choice is isolated from the Lighthouse profiles, whose initial banner is untouched. Failures preserve the original error and a viewport screenshot.

The first diagnostic preflight confirmed an existing pinned-main mobile defect: the control-bar gradient intercepts clicks on its center Play button. Paired First Play uses each version's actual control-bar button, without forcing a click or changing baseline application code. The candidate center button is additionally tested in fresh contexts for both routes/devices; those rows are labelled `center`, separate from paired `controls` timings. The production check therefore requires 12 successful playback rows.

Local fixture sanity checks (no browser measurement):

```bash
python3 performance/gallery-final/run.py --verify-only
python3 -m unittest discover -s performance/gallery-final -p test_runner.py
pnpm exec tsx --tsconfig frontend/tsconfig.json performance/gallery-final/seed-fixture.ts --verify-only
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/gallery-cwv-fixture-postgres.test.ts
```
