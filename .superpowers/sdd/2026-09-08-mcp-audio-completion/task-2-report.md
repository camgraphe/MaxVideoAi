# MCP Audio Task 2 — exact preparation and confirmation

Task 2 adds private focused services for `prepare_audio_generation` and `confirm_audio_generation`. They are intentionally not registered in the MCP server; public transport, result readers and presentation remain Task 3.

## Implemented contract

- Preparation requires a client-bound OAuth principal, the paid-generation gate and an unrestricted account. It normalizes version 1, resolves exact owned library assets or completed job outputs, runs the existing Audio preparation owner outside a transaction, checks the real capability variant and canonical current price, checks shared spending controls, then stores a 45-minute wallet quote. It returns exact price, currency, expiry, balance/top-up facts and explicit confirmation requirement without creating a job, charge or provider attempt.
- Private quote evidence retains the request hash, exact original reference identity/facts, measured source probe, resolved duration/aspect and an account-bound input key under a versioned integrity hash. Confirmation re-resolves and compares this evidence; no client URL or provider field is trusted.
- Confirmation accepts only the exact quote ID plus `confirmed: true` from the same OAuth user/client. Under one quote transaction it checks expiry, restriction, request/catalogue/exact variant, current pricing policy, reference removal/change and cumulative spending, then composes `buildAudioRunReservation`, `createInitialAudioJobInExecutor` and quote claim. Job, wallet debit and claim therefore commit or roll back together.
- The transaction winner alone invokes the existing reserved Audio executor after commit. Claimed/accepted/failed replay returns the durable Audio job status without another debit or provider call. Failure/refund remains terminal. A completed job is not changed to failed if only the post-execution quote acceptance mutation needs reconciliation.
- Top-up retains the shared Task 1 handoff: the old quote is invalidated and funding leads to fresh Audio preparation and approval.

## Evidence

Focused unit and architecture tests cover strict OAuth/client approval shapes, exact variant availability, no public Task 3 registration, execution outside the transaction, replay and acceptance-mutation failure. A disposable PostgreSQL suite exercises the actual services/repositories/ledger with provider/media boundary fixtures: owned `ToolAssetRef` originals/facts, prepare side effects, same-quote concurrency, distinct-quote wallet serialization, rollback, expiry, catalogue/price/reference drift, restriction, wrong owner/client/surface, per-generation and mixed video-plus-Audio daily limits, insufficient funds, provider failure, exact refund and replay.

Final composed validation passed 91 tests with zero failures or skips, including the real disposable-PostgreSQL service, Task 1 reservation/executor, video/image wallet and trial regressions. Frontend TypeScript, public-exposure and diff checks pass. Full frontend lint reports zero errors and the one unchanged `react-hooks/exhaustive-deps` warning in the excluded Audio workspace UI.

## Runtime limit

The runtime remains synchronous. A process crash after claim commit is an ambiguous retained job for status/manual reconciliation; replay does not resubmit it. This task adds no durable worker or automatic provider recovery, performs no real paid call, and changes no public MCP registration.
