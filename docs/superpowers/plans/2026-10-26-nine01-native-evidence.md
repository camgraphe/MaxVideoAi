# NINE-01 native evidence admission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Correct the two actual NINE-01 evidence admission gaps while retaining immutable native provenance and the existing network/ownership boundaries.
**Architecture:** One explicit native evidence profile selected only by the Kling manifest. Pure validation of a typed private bundle, bounded local source reads, and exact-object renewed private storage GETs feed the existing verifier and immutable import provenance.
**Tech Stack:** Existing TypeScript/Node, zod, crypto/fs, existing storage signer and node:test/tsx; no new dependency.
**Spec:** docs/superpowers/specs/2026-10-26-nine01-native-evidence-design.md

## Global Constraints
- Worktree/branch separate from9a05/420b; base9a05b273559d1b6f048f6dc64ff194333f63b50a.
- Existing raw native files/journal/accepted input stay byte-identical; no real IDs, grants, bucket, source paths or secrets in tests/commits.
- No generic S3 URL acceptance or fal.media guard relaxation. Explicit target, exact object scope, no redirect, bounded GET only.
- Profile limited to actual NINE-01 Kling base operations; Nano ignored as evidence, malformed/conflicting journal fails.
- No generation, upload, DB apply/migration, admin mutation, remote merge, publication, pricing or playlist policy patch.
- Studio linkage uses delivered hashes/bytes and existing decode evidence; bank retake is versioned separately and not substituted.

## Review Focus
- A valid-looking local bundle with mismatched app owner/staging owner token must fail before source reads.
- Historical grant expiry must allow retained exact-object recovery, but invalid-at-submission or fresh expired grants must fail.
- URL userinfo/ports/encoded paths/bucket-region aliases/redirects must never produce arbitrary fetches.
- A valid chain containing Nano and duplicate/wrong-operation acceptances cannot lend evidence to a Kling result.
- Actual provider response header absence remains absent; compact proof and replay bind native input/result/plan without fabricated SDK IDs.

### Task 1: Native journal and private source admission (one coherent import contract)

**Files:**
- Create: frontend/server/external-fal-import/nine01-evidence.ts (typed native bundle/chain/source verification)
- Create: frontend/server/external-fal-import/private-staging-source.ts (exact target/key/grant validation and bounded GET source reads)
- Modify: frontend/server/external-fal-import/kling-v4.ts (opt-in profile field only)
- Modify: frontend/server/external-fal-import/evidence.ts (profile branch, legacy default untouched)
- Modify: frontend/server/external-fal-import.ts (immutable native proof summary)
- Modify: frontend/scripts/import-external-fal-results.ts (explicit trusted signer/target wiring only when profile selected)
- Test: tests/external-fal-nine01-evidence.test.ts plus existing import/reference/PG suites
- Update: docs/engineering/external-fal-import.md

**Interfaces:**
- Consumes: existing ExternalFalImport, canonicalImportJson/importDigest, verifyExternalFalEvidence, owned asset checks and existing explicit storage config.
- Produces: opt-in profile admission returning recorded native result digest, compact proof summary and independently verified slot→exact object source bindings. Existing verifier reads source bytes only from those validated bindings.
- Local source loader and private source ports are injectable at slow I/O boundaries for offline tests; CLI supplies real bounded private files and trusted storage signing.

- [ ] Write an anonymized real native fixture and a failing existing-consumer test: profile selected on Kling ref2v with a completed native journal/bundle admits the genuine input/result; current code rejects it. Record RED output.
- [ ] Implement strict typed profile/schema, original journal chain and selected operation/file validation. Add RED→GREEN adversarial tests for wrong owner, body/endpoint, raw hashes, accepted/status IDs, ordering, duplicate events, Nano confusion and missing sources.
- [ ] Write failing private reference tests: historical expired valid grant + retained exact object succeeds without fetching historical URL; substituted object/hash/target/slot/order, invalid submission interval and fresh expiry, URL tricks and redirects fail before unsafe fetch.
- [ ] Implement exact staging manifest/registration validation, explicit app-owner binding, known target/key reconstruction and renewed GET read with byte/time bounds. Default fal.media path remains unchanged.
- [ ] Integrate the profile into the existing CLI/verification/immutable provenance path; cover the actual CLI reader boundaries and no-provider-POST behavior with offline fixtures.
- [ ] Run all focused import/reference/staging/guardrail tests including disposable PostgreSQL. Run frontend types, touched lint, exposure and git diff --check. Read and retain logs.
- [ ] Commit the coherent patch with exact base/head and report only tests actually run. No old CI/Preview reused for the new head.

### Task 2: Actual media packet and independent whole-patch review

**Files:** Existing private camgraph-attachment bundle and OUTREACH model-launch-camgraph/CAMGRAPH-ATTACHMENT-PACKET.md/json.
**Interfaces:** consumes the native proof format from Task1, frozen source bindings, and exact Studio receipt hashes supplied in the delegation; produces a reviewable real-source packet without owned upload IDs or public writes.

- [ ] Verify supplied Studio receipt hashes and map all9 masters to9posters/9silent6s previews/9full copies using hashes/bytes and acquired decode proofs. Do not rerun whole decodes or claim locked-Mac playback/listening.
- [ ] Version the base bundle and reserve a separate bank-retake slot requiring its own completed reviewed receipt. Preserve original input/source/journal snapshots.
- [ ] Document current expired reference dependency: retained objects remain necessary through source verification/dry-run/apply; ordinary app library/reuse after successful adoption uses owned copies. No cleanup now.
- [ ] Dispatch one independent whole-patch reviewer with spec, base/head, bounded tests and five Review Focus entries; resolve Critical/Important findings with covering RED→GREEN tests and run the affected suite.
- [ ] Deliver reusable exact commit/patch (draft PR if appropriate), update packet and receipts, and state new-head CI/Preview qualification honestly. Preserve handoff artifacts per the user's passation request.


## Actual-source deltas confirmed during implementation

The source signer requires an explicit private --native-source-config, using the existing operator config; owned-media S3 environment is a separate target and is never reused or changed. Scope also includes exactly NINE-01-FAL-OPTION-01, the observed bank retake: canonical scene K4-JANITOR-US, dependency K4-JANITOR-US-OPTION-01, its own accepted provider identity/result, registry-v2 with14references/10dependencies. Base and retake remain separate candidates, no automatic substitution or tenth-scene adoption. Tests must cover mixed base/option evidence rejection.
