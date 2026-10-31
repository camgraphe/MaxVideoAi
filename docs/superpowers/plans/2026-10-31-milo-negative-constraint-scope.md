# Milo Negative-Constraint Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preserve the intended scope of negative creative constraints without losing requested exclusions or reasonable creative choices.

**Architecture:** Add a bounded clarification in the existing shared composer instructions; keep request transport and destination decoding unchanged.

**Tech Stack:** TypeScript, existing provider request builder, Node tests through tsx.

**Spec:** `docs/superpowers/specs/2026-10-31-milo-negative-constraint-scope-design.md`

## Global Constraints

No public schema, parser, recovery, proof, settings, storage, billing, model-selection or UI changes. No lexical filtering, additional provider call or live QA. Root owns independent review and publication/delivery coordination; user authorization for this correction is already supplied.

## Review Focus

Narrow versus total bans; requested blank areas versus other lettering; supported setting constraints; retained broad exclusions; follow-ups after an assistant introduced an excessive restriction. Offline fixtures must not masquerade as model outputs.

### Task 1: Clarify scope and preserve the transport boundary

**Files:** `frontend/src/server/prompt-assistance/provider.ts`, `tests/prompt-assistance-negative-constraints.test.ts`, and `docs/engineering/milo-workflow-chats.md`.

- [ ] Run the existing pure context/conversation/destination contracts on the clean base.
- [ ] Add a failing shared-policy contract plus synthetic real-builder/lossless-decoder boundary cases; establish the missing scope instruction without a model call.
- [ ] Add only the shared scope clarification and corresponding ownership documentation; keep runtime parameters and all other policy unchanged.
- [ ] Run focused tests, TypeScript, frontend lint, exposure, diff checks and a credential-free local source build when feasible. Record limits separately from green checks.
- [ ] Review the complete diff and commit a clean candidate. Report exact base/head/tree to root before any coordinated publication; root owns fresh independent review, CI, exact Preview and Git delivery gates.
