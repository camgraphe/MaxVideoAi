# Milo launch implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement the approved direction in the existing isolated worktree.

**Goal:** Make Milo understandable, discoverable and reviewable for launch.
**Architecture:** Route-local localized copy, server page/schema, small interactive example; shared composer deep-link/help and existing consent analytics.
**Tech Stack:** Next.js App Router, React, TypeScript, CSS modules, Node tests.
**Spec:** ../specs/2026-10-29-milo-launch-design.md

## Global Constraints
Current PR #555; no production activation. English product direction with complete FR/ES marketing. Paid generations ≤ $10. Keep media pricing separate from assistance. Never expose private account content in assets.

## Review Focus
Verify CTA opens the right assistant without sending; invalid query parameters do not change state. Inspect locale paths/canonical/schema/sitemap; no fabricated performance claims or unsupported reference analysis. Preserve main’s duration and read-only Studio safeguards. Check keyboard/mobile layout and no personal data in examples or analytics.

## Task 1: Reconcile main
Resolve WorkspaceComposerSurface by retaining sourceControl plus videoDurationBlocked; retain shared Milo scope plus main Studio read-only instructions; preserve combined guidance budgets. Run director/source-picker/duration/Draft tests and tsc. Commit merge only after they pass.

## Task 2: Public Milo page
Create route-local `_lib/milo-copy.ts`, `_components/MiloMarketingPage.tsx`, `MiloWalkthrough.client.tsx`, CSS module, page/schema and English wrapper. Use existing public asset with clear illustration label. Add routing/middleware registration. Test localized metadata, truthful offer, example interaction and routes.

## Task 3: Entry and discovery
Add validated `assistant=milo` composer entry without overwriting draft or submitting. Link compact help, home discovery, Studio, pricing and EN/FR/ES getting-started. Reuse existing consent CTA tracking; document full result attribution as a separate measurement dependency rather than inventing outcomes. Test deep-link and page contracts.

## Task 4: Qualification and release preparation
Run focused tests, tsc, lint, public exposure and build. Inspect rendered desktop/mobile pages and entry. Document migration/config/recovery order with remaining decisions. Fresh independent review, fix material findings, commit/push current PR, inspect required CI. No merge or production mutation.
