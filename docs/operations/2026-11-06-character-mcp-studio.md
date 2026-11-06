# Character Studio integration — isolated preview

Scope: align `codex/character-studio-v2` with `main`, connect saved characters,
looks and dedicated Recast to MCP and conversational Studio, then qualify the
preview without ordering provider media or changing production.

## Source and environment

The branch incorporates main `f868a026bd56fc2bd75d355512e3f03417ec0853` through
merge `de9acc3b66f32a2299374925887eacb1a717cb31`, with no merge conflicts.
Main advanced during validation to `d573890f0` (Omni 1.2). Merge `37f8b53b2`
incorporates it as well. Its single conflict in the public-pricing baseline was
resolved by retaining both the Character transition and all 13 Omni scenarios;
the complete public baseline passes with 610 rows.
Implementation commits: `9be058c86` (common owner and direct continuation),
`b19059002` (MCP), `9ba51617e` (Studio), `2baeb348c` (conversation continuity and
host-independent SEO fixture), `c11544a95` (preview approval destinations).

Only custom Vercel environment `character-studio-test` has the new
`MCP_CHARACTER_STUDIO_ENABLED=1` and `STUDIO_CHARACTER_STUDIO_ENABLED=1` flags.
Its MCP resource and API host point to the exact stable test origin:
`https://maxvideoai-env-character-studio-test-camgraphes-projects.vercel.app/mcp`.
No wildcard origin was trusted. The existing isolated database, storage, account
and Recast ×2 policy remain the preview resources. No new migration is introduced.

The candidate remains in draft [PR 619](https://github.com/camgraphe/MaxVideoAi/pull/619).
Git deployment and required CI status must be read for the latest commit there;
a passing older deployment is not candidate acceptance. Production domains were
read-only checked on the same main deployment `dpl_J3cyrBWZ8JddEahWczpPdSNttCyW`.
No production merge, promotion, domain reassignment or configuration write is
part of this work.

## Implemented journey

- Find saved characters and looks by exact name or ID. Pagination does not limit
  selection to the first look page. Duplicate names remain distinct records.
- Resolve the exact owned original into Media. Character results and completed
  Recast gallery videos now expose Studio continuation with explicit film choice
  and Apply. The conversational reference picker exposes saved identities/looks.
- Prepare dedicated Recast with the chosen character, product, independent video
  and audio passages, direction/dialogue, duration, resolution and framing.
  Each transport uses the same product quote, not ordinary Wan retail pricing.
- Review and approve the exact USD amount. Scope remains user + origin + OAuth
  client or Studio project. Accepted work recovers after disconnect or execution
  shutdown without a second submission or debit.
- Reopen the completed video in its Studio project. Subsequent Recast revisions
  retain the recorded recipe; changing resolution produces a fresh unsubmitted
  quote. Bounded history discloses direction truncation and preserves exact
  dialogue within the existing text budget.

Character Builder remains the authoring surface for new character/look recipes.
MCP can save its completed original, but generic image jobs do not become valid
Character recipes. This preserves the existing lineage guard.

## Review and deterministic evidence

The common owner and direct continuation passed an independent task review and
35 independently rerun DOM/helper tests. Studio review found and corrected missing
Recast follow-up context; its scoped re-review passed. MCP review found and corrected
production spending-approval links from the preview, UUID-version/schema bounds
and ambiguous generic-versus-Recast guidance.

Focused tests cover real PostgreSQL ownership/quote/journal/wallet transactions
with substituted provider execution, SDK transport and DOM interaction. The
8-second output + 7.5-second source + 5.25-second reference-audio fixture quotes
434 cents at 720p with ×2 provider cost; repeated confirmation submits and charges
once. The 1080p follow-up changes only resolution. These are deterministic test
facts, not a new supplier invoice or a paid-render quality certification.

The full local Studio run reported 1,512 passes, one skip and two failures: an
old route architecture assertion subsequently corrected and retested, and a
browser fixture deliberately refusing existing local environment files before
startup. The clean CI browser lanes remain the authority for that browser run.
Local frontend TypeScript, focused lint and exposure checks passed. The MCP client
gate passed 203 tests with one authoring-validator skip and all 70 curated cases;
the production policy fingerprint remains unchanged. Counts overlap and must not
be added as distinct test coverage.

The first Git build exposed a prebuild robots test inheriting the preview MCP
host while assuming the production protocol host. Its fixture now explicitly
tests both configured hosts and restores its environment. The full prebuild
passed 60 SEO tests plus registry and public-media coherence gates afterwards;
runtime robots policy was not changed to obtain that result.

Hosted validation also exposed two environment boundaries. The test database's
112 connection slots were exhausted (`53300`) by direct serverless connections.
Only its custom-environment `DATABASE_URL` was changed to the existing pooled
endpoint, and only its test compute was restarted. Credentials, database contents,
production configuration and compute size were preserved. The direct local URL
remains available for migrations. This follows [Neon's connection-pooling guidance](https://neon.com/blog/postgres-support-case-recap).

The protected preview then showed that `credentials: omit` in the owned browser
transport also omitted Vercel's access cookie, redirecting Studio library requests
to hosting sign-in. Owned requests now retain same-origin deployment cookies and
explicitly require bearer-only application authentication. Missing, revoked or
invalid bearers cannot fall back to a cookie belonging to another account; this
mode returns no ambient session. Ordinary authentication retains its existing
behavior. Real Auth fixture tests cover both modes, including account mismatch.

Remaining live qualification: hosted UI and HTTP checks for the exact final SHA,
fresh real-host OAuth catalog refresh, and a separately approved provider render.
No test result here authorizes a new paid attempt. Before production, complete
the release runbook and current-main/Quality CI/deployment gates documented in
`docs/deployment/github-vercel.md`.
