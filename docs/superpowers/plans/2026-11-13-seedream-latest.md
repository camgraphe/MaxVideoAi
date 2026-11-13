# Seedream latest models implementation plan

> **For agentic workers:** use superpowers:executing-plans for coordination and
> dispatch independent marketing, pricing and surface work with the applicable
> dispatching-parallel-agents skill. No shared-file edits across assignments.

**Goal:** Integrate Seedream 5.5 and 5.0 Flash coherently across generation and discovery.
**Architecture:** Extend the existing BytePlus adapter and registry. Preserve the
canonical quote owner and stable Seedream SEO routes.
**Tech stack:** Next.js, TypeScript, PostgreSQL, Node test runner, BytePlus ModelArk.
**Spec:** `docs/superpowers/specs/2026-11-13-seedream-latest-design.md`.

## Global constraints

Exact new IDs/slugs: `seedream-5-5`, `seedream-5-0-flash`. One output, ten references,
1K/1.5K/2K. Preserve all existing Seedream URLs, paid receipts and prices. No
production writes, deployment bypass or paid generations.

## Review focus

- Custom provider endpoint IDs retain model-specific single-output constraints.
- Explicit ratios use valid pixel sizes and the same supplier price tier.
- Every 5.5 reference counts, including the primary edit source.
- Transparent output survives settings transport and requires PNG.
- Existing localized Seedream routes retain their canonical and indexation.

## Tasks

- [ ] Provider/runtime: add failing payload/readiness/model tests, then extend
  `frontend/lib/image/seedream.ts`, direct BytePlus payload/execution/environment
  owners and a focused new raw-engine definition file. Preserve Lite/Pro behavior.
- [ ] Registry: author both identities in `frontend/config/model-registry.json`;
  regenerate runtime, engine catalogue and rosters with documented commands.
- [ ] Pricing: validate official LIST/input pricing; add canonical new-offer tariff
  coverage and bounded migration through established ownership. Test reference
  counts, all output tiers and unchanged historical/other prices on disposable PG.
- [ ] App/MCP/Studio: share model helpers, validation and settings; update bounded
  preflight resolutions, exact model prompting sources and Studio certification.
  Test both modes, rejection paths, background transport and quote consistency.
- [ ] Marketing/SEO: create all three locales for both new pages with strict
  decision/prompting/examples content and registered templates. Add relevant links
  to existing pages, accurate illustrative media and canonical/hreflang tests.
- [ ] Integration/review: run related suites, registry/launch assets, lint,
  typechecking, integration/database checks and local browser/SEO smoke tests.
  Independently review the full change, resolve findings, prepare a draft PR.

Focused runner: `TSX_TSCONFIG_PATH=frontend/tsconfig.json node --import tsx --test <files>`.
PostgreSQL tests use `scripts/run-postgres-tests.mjs`, preserving PG17 validation.
