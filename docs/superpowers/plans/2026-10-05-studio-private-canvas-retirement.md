# Studio private Canvas retirement implementation plan

> **For agentic workers:** Use superpowers:executing-plans. Read-only parallel audits cover independent dependency and data domains; implement and review the final change in this session.

**Goal:** Retire the private Canvas and its personal projects without changing supported public Studio/MCP behavior.

**Architecture:** Keep one conversational UI. Determine retained shared modules from resolved imports, relocate their owner, remove unreachable old UI and update entry points and contracts. Scope the data operation to an inventoried explicit ID set and preserve media and financial records.

**Tech Stack:** Next.js, React, TypeScript, PostgreSQL/Neon, GitHub/Vercel.

**Spec:** `docs/superpowers/specs/2026-10-05-studio-private-canvas-retirement-design.md`

## Global constraints

- No project migration; human explicitly authorizes deleting the old private projects.
- Preserve current conversations, shared media, timeline/playback/export, MCP capabilities and billing/audit evidence.
- Do not edit generated model/media catalogs.
- Retain a single Studio interface; no old editor bundle behind old links.
- Use normal Git-backed production delivery and latest-main Quality CI.

## Review focus

- A connected project may have been created by Canvas: determine candidates from actual structure/activity and protect all conversation records.
- Old URLs and published montage links must not mount Canvas or strand supported projects.
- Shared types/helpers may contain graph names yet remain required by server/worker paths.
- Missing conversation data is not sufficient permission to delete a current empty conversation.
- Data removal must preserve provider/billing receipts and library assets, and reject active work or stale plans.

## Task 1: Dependency, data and entry audit

- [x] Run current architecture audit; inspect nested guides and import/route contracts.
- [x] Produce resolved shared-retention and old-deletion manifest; inspect every external consumer.
- [x] Inventory database schema and bounded candidate IDs read-only; distinguish old/new projects.
- [x] Confirm entry/handoff/marketing and MCP montage behavior to retain.

## Task 2: Retire the UI and simplify ownership

Files: Studio routes, project picker, marketing entry, montage result URL, retained shared modules, package dependency/lockfile and architecture/behavior tests.

- [x] Add failing retirement contracts: one picker/UI, old URL redirects, no Canvas import/React Flow runtime and correct montage URLs.
- [x] Move shared modules, rewrite resolved consumers, delete editor-only files and obsolete UI-only tests.
- [x] Keep current marketing and handoff behavior through the conversational surface where used.
- [x] Run retained editor/Studio/MCP tests, TypeScript, lint, exposure and route build; inspect failures rather than weakening supported coverage.
- [x] Update Studio ownership docs and AGENTS with the new boundaries.

## Task 3: Bounded old-project cleanup

Files: operational cleanup helper/CLI, focused PostgreSQL tests, operation report.

- [x] Implement preview/explicit-ID transactional apply with activity/snapshot guards, preserve shared media and financial records, reject current projects and active work.
- [x] Rehearse deletion and idempotence on isolated data; test mixed ownership/current projects/financial associations and rollback on changed state.
- [ ] Apply only the inventoried authorized private project set; record before/after evidence without secrets.

## Task 4: Review and release

- [ ] Review diff and retained API/worker dependency closure; smoke-test new UI and retired routes locally.
- [ ] Commit, push and attach GitHub PR; pass required Quality CI on current-main candidate.
- [ ] Run deployment check, merge via GitHub, verify both domains use the merged SHA and smoke-test production.
- [ ] Record code/file/dependency reduction and data scope; report exact completed work and any practical limits.
