# Reference Names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Display real private picker names and retain Image names after selection/reload.
**Architecture:** Reuse the existing API name and shared picker. Add optional name metadata through the existing Image slot/persistence owners; preserve all identity and functional-label code.
**Tech Stack:** React/TypeScript, Playwright desktop, existing DOM fixtures.
**Spec:** ../specs/2026-11-02-reference-names.md

## Global Constraints

- No automatic restoration of URL-only identities; no phone tests or production/paid operations.
- Existing Image 1/2 reference labels, canonical refs and ownership checks stay unchanged.

## Review Focus

- Blank/missing names retain localized fallback and old snapshots remain readable.
- Chosen names outrank URL leaves; API priority remains server-owned.
- Long names remain readable without increasing card width.
- Name-only changes survive ordinary Image snapshot hydration.
- Search and confirmation select the exact existing asset, never by display name.

## Task 1 — picker and name metadata

Files: shared ReferenceLibraryPicker.client.tsx; Image slot types, selection/import hooks and persistence parser/writer. Tests: desktop picker browser test; existing Image identity DOM fixture and private-name priority suite.

- [x] Write failing picker display/search/confirmation/fallback test and Image selection→snapshot→real hydration test.
- [x] Observe failures, then add only name presentation and optional metadata copying.
- [x] Run focused tests, desktop browser evidence, TypeScript, lint/exposure/registry and diff checks.
- [x] Record result and create clean local commit; no push/PR/merge.

Validation: initial RED caught missing picker text and lost selected name; final focused43/43 PASS, TypeScript and lint/exposure pass. Desktop Chromium1440×1000 only. Existing server name priority and Image 1/ref identity guards pass. ROOT owns review/delivery.
