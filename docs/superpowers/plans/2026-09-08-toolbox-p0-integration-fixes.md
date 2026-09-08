# Finish the Toolbox P0 integration

Requirements: the preserved source document `b6ea6b36a:docs/plans/2026-09-08-toolbox-finishing-tools.md` and independent root review `.superpowers/artifacts/2026-09-08-toolbox-p0-integration-review.md`. Import the disabled checkpoint `b6ea6b36a`, then documentation `2d55db286`, preserving the separate current Audio pricing policy. The review's three findings must be fixed before execution-quality acceptance.

## Global Constraints

- Keep Restore Video, Denoise, Fix Blur and Smooth Motion; Standard/Pro only where defined, Fix Blur Standard only. Do not add providers or alter existing Upscale/Background Removal.
- `FINISHING_QUALIFICATIONS` stays empty. No actual provider submission, paid benchmark, production policy change, activation or migration rollout. Qualified provider quality and invoice reconciliation remain explicit release dependencies.
- Preserve exact owned originals, canonical ToolAssetRef, measured facts, source cadence/audio, selected settings, canonical quotes and result lineage. No client metadata as authorization.
- Finishing remains ×2.5; Audio remains ×3 with its approved five-cent upward rounding. Preserve original charge snapshots and exact refund amounts.
- Use disposable local PostgreSQL with an explicit isolated environment for lifecycle proofs. No inherited remote connection.
- Keep the existing visible UI; this corrective tranche concerns lifecycle integrity and delivered output validation, not a new redesign or global refactor.

### Task 1: Close terminal-state and output-contract defects

Files: `frontend/src/server/tools/finishing-jobs.ts`, `finishing-status.ts`, `finishing-output.ts`, their focused tests; `frontend/server/fal-poll.ts` and its tests for the shared cron boundary. Add a focused pure dimensions helper only if the provider request and output validator need the same actual contract. Update the finishing guide with actual reconciliation behavior.

- [ ] Reproduce the three review findings using the provided targeted proof and actual owner functions: generic provisional expiry creates a failed paid job without refund; completion races with refund; a selected Restore 4K accepts unchanged 720p.
- [ ] Keep finishing jobs out of generic Fal endpoint selection and generic provider-ID-less failure updates. Route eligible tool rows through their own status/finalization owner in the existing bounded cron, using the stored account and profile. Do not create another scheduler or redispatch interrupted submissions. A failed or absent provider request follows the finishing timeout/refund policy; one owner decides the terminal state. Preserve video/audio polling behavior and bound per-run work.
- [ ] Serialize completion and refund under the same transaction/job lock, or one equally atomic terminal transition. Verify the transition before side effects and ensure only completed/no-refund or failed/exactly-one-refund is possible. Cover both concurrent orders, replay, already terminal rows and rollback with actual disposable PostgreSQL connections.
- [ ] Validate the selected Restore resolution as well as duration/audio/cadence/aspect. Confirm the provider's primary API documentation and actual request mapping. Reject unchanged 720p for a 4K request; cover landscape/portrait and supported aspect/rounding behavior. Do not invent a quality claim or accept provider status in place of measured dimensions.
- [ ] Test the real cron ownership boundary with an interrupted reservation and submitted tool row. Prove no generic endpoint call/update touches these jobs and that eventual finishing reconciliation/refund is possible without revisiting the page.
- [ ] Run covering tests and affected contracts/types/lint through the sanitized launcher, concurrency at most 4. No repeated full suite/build while the principal app is being edited. Self-review and commit exact files.
- [ ] Independent scoped review verifies these findings and new breakage only. Keep qualification/activation limits explicit in report; root performs the final composition tests and visual QA.
