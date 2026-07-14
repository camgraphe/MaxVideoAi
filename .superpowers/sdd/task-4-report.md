# Task 4 report: Technical MCP documentation

## Status

DONE

## Implementation summary

- Added complete English, French, and Spanish MCP technical guides at `content/docs/mcp.mdx`, `content/fr/docs/mcp.mdx`, and `content/es/docs/mcp.mdx`, with visible author, publication date, and update date metadata.
- Documented the canonical resource endpoint exactly as `https://api.maxvideoai.com/mcp` and kept each client/version statement tied to the checked-in compatibility evidence. Claude Desktop, Claude Code, Codex CLI, and unverified Codex app behavior are deliberately distinguished.
- Documented only the live public tool registry: `get_account_status`, `list_models`, and `recommend_models`. The tool table includes when to use each tool, read-only and destructive annotations, closed-world behavior, idempotency, authentication, confirmation behavior, and negative cases.
- Explained that generation preparation/confirmation, job status/recovery, recent generations, media listing/upload, and top-up tools are not currently public. The guide does not imply that connecting the MCP can generate video today.
- Described the current OAuth scopes, revocation path, account/spending-limit nullability, privacy boundary, current public error envelope, and troubleshooting actions without exposing provider internals.
- Kept quote, confirmation, promotional trial, reference, polling, and generation prose truthful to the current publication gates. No exact price, quote fingerprint, quote expiry, one-click setup, deep link, or directory listing is claimed.
- Added a localized docs-index card, but made both index visibility and related-doc discovery depend on the existing MCP indexation gate.
- Added a focused `TechArticle` JSON-LD builder. MCP article schema is suppressed until the existing publication state is indexable; visible authorship and dates match the structured data when it is emitted.
- Did not modify any MCP publication or feature flag. With the checked-in flags, the new documents are not public routes, index entries, related-doc links, static-build pages, or structured data.

## TDD RED evidence

The Task 4 contract was added before the documents, index wiring, or focused article-schema owner existed.

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-docs-content.test.ts
```

Initial result: exit 1; 9 tests, 0 passed, 9 failed. The failures were the intended missing behavior: absent localized MCP documents, canonical endpoint and compatibility evidence, incomplete live-tool documentation, missing quote/trial/reference/status/account/privacy/error/non-goal sections, missing localized index entries, and missing publication-gated article schema.

After the minimal implementation, the same command exited 0 with 9 passed and 0 failed.

## Evidence mapping

| Public statement | Checked-in authority used |
| --- | --- |
| Canonical endpoint | `frontend/src/server/mcp/config.ts`; `tests/mcp-config.test.ts` |
| Host names, versions, commands, and known limitations | `frontend/config/mcp-compatibility.json`; `docs/operations/mcp-host-compatibility-matrix.md`; Task 3 integration copy/contracts |
| Exact live public tool registry and annotations | `frontend/server/mcp/server.ts`; `frontend/server/mcp/tools/account-status.ts`; `frontend/server/mcp/tools/list-models.ts`; `frontend/server/mcp/tools/recommend-models.ts`; MCP registry/tool tests |
| OAuth scopes, connection state, and revocation | MCP OAuth adapter/connection modules and their focused tests |
| Account status, disabled trial, nullable spending limits, and omitted email | MCP account-status response types, implementation, and tests |
| Stable errors and private/no-store behavior | MCP error/result helpers, HTTP handler, audit logger, and focused tests |
| Quote, generation, trial, reference, status, and media availability | `frontend/config/mcp-publication.json`; approved MCP design/claims matrix; live tool registry |
| Docs visibility and article schema | `frontend/lib/mcp-publication.ts`; docs route/index owners; editorial profile and JSON-LD contracts |

## Final verification

1. Task 4 content and gate contract

   ```bash
   ./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
     tests/mcp-docs-content.test.ts
   ```

   Result: exit 0; 9 passed, 0 failed.

2. Complete MCP/docs/public-claim/SEO/schema regression set

   ```bash
   ./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
     tests/mcp-*.test.ts \
     tests/docs-index-route-architecture.test.ts \
     tests/public-product-claims.test.ts \
     tests/localized-fallback-seo.test.ts \
     tests/marketing-jsonld-schema-audit.test.ts
   ```

   Result: exit 0; 148 passed, 0 failed.

3. Localization, type, lint, SEO, exposure, and diff checks

   ```bash
   npm --prefix frontend run i18n:check
   pnpm --prefix frontend exec tsc --noEmit --pretty false
   npm --prefix frontend run lint
   npm --prefix frontend run seo:check
   npm run lint:exposure
   git diff --check
   ```

   Result: all commands exited 0. French parity is 4,156 keys and Spanish parity is 4,150 keys.

4. Production build

   ```bash
   npm --prefix frontend run build
   ```

   Result: exit 0. Registry/catalog checks, Next.js compilation, lint/type validation, generation of 727 static pages, and postbuild sitemap generation passed. The gated MCP documents were absent from the generated docs routes under the current publication state.

## Publication-gate audit

The checked-in MCP publication values remain false for public marketing, public indexation, transport, OAuth, discovery, paid generation, trial, reference uploads, and related capabilities. No flag file changed. The docs route returns not found for `mcp` until `renderPublicPage` is true; docs-index and related-doc visibility require `indexable`; MCP `TechArticle` output also requires `indexable`.

This keeps the technical material ready behind the established gates without making it discoverable or implying a public launch.

## Deliberate boundaries and remaining concerns

- Only the three currently registered read-only tools are presented as available. Future generation, quote/confirmation, status/recovery, media, upload, and top-up tools are explicitly labeled unavailable.
- The current implementation exposes no public quote fingerprint or expiry contract, so the guide does not invent either. It also contains no hard-coded price.
- The promotional trial remains disabled. The documented eligibility and fixed preset are identified as gated terms, not a live wallet credit or public promise.
- Reference-upload transport is not public. The guide distinguishes host-side prompt/reference creation from the future persisted MaxVideoAI asset-ID boundary.
- Claude Desktop token refresh and Claude Code hosted-tool smoke remain pending in the compatibility evidence. Codex CLI's default add flow remains blocked by an extra phone scope, while the explicit-scope read-only path is the verified path. The Codex app/library has not been validated.

No push, pull request, merge, deployment, external message, database change, publication-flag change, or other external mutation was performed.
