# Studio baseline composition — 2026-09-08

Source provenance is recorded in `committed-source.json`, `dirty-source.json`, and
`shared-source.json`. Committed files were imported by exact paths from
`6165afc34bb27b8b3dc2d05074b09cdcdb44c13f`; local certification work was copied in
a separate commit. All 32 tracked dirty files and both untracked files were hashed.
The five dirty shared files were adapted instead of overwritten. Current engine
types and server projection already preserve schema constraints/reference budgets.
The old client-declared reference count was intentionally not restored.

## Shared interfaces

- Studio routes are visitor-readable discovery surfaces using local drafts. APIs
  still authorize accounts independently. `authFetch` exposes the existing session
  hint; marketing handoff reads the server session for navigation only.
- Feature configuration enables Studio; the current app menu exposes its project
  entry. Existing primary navigation, Activity and Billing ownership are retained.
- Only `workspace.studio` localization subtrees were imported. Guide analytics
  extend the current consent-aware event allowlist with bounded semantic values.
- Angle billing-product selection and output count moved to the existing browser
  helper, with server re-exports retaining imports. There is one selection rule.
- The export resolver receives an account-filtered media-ID reader, owned storage
  prefix validation, streaming file upload, and a local-file thumbnail helper.
  Existing storage namespaces, conditional writes, cancellation, and library
  public identities remain intact. Export asset registration may explicitly disable
  a remote thumbnail fallback when it already has a local render.
- Export billing uses the source wallet advisory-lock helper. This does not establish
  shared locking with every other current paid flow; that cross-flow invariant needs
  separate financial review before deployment.
- Preflight now projects `facts.assignments` into canonical owned `inputs` with
  asset ID, exact field/slot, media kind and original URL. Current main resolves
  trusted media pricing facts server-side; the Studio cache key includes those
  inputs. The source `referenceImageCount` API addition was not imported.

## Standalone SFX correction

The historical Studio requires standalone text-to-audio SFX. Current main's
cinematic pack requires a video and is not equivalent. The source `sfx_only` pack,
validation and mixing branch were added to current shared audio owners.

Standalone SFX uses only `fal-ai/mmaudio-v2/text-to-audio`; provider failure does not
silently move to a more expensive model. Existing video sound-design fallback is
unchanged. Vendor facts are 0.1 US cent/second, passed through the existing canonical
audio commercial policy. The old source incorrectly attributed Mirelo video pricing
to standalone text SFX; that assumption was not imported.

Primary evidence checked 2026-09-08:

- https://fal.ai/models/fal-ai/mmaudio-v2/text-to-audio — $0.001 per second.
- https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai%2Fmmaudio-v2%2Ftext-to-audio
  — duration number, minimum 1, maximum 30, default 8.

The supported product intersection is 3–30 seconds. Studio connectors reject video
inputs for standalone SFX; API validation rejects source video/job, music controls,
and durations outside the supported range before billing. Provider injection tests
verify endpoint, duration and failure behavior without paid generation. Live output
quality and provider execution remain untested.

## Excluded historical suites

Four source suites were initially imported and run to characterize shared-owner
differences: `media-library-round4`, `media-library-round5`,
`media-library-security-round3`, and `wallet-render-round3` (all under `tests/`).
They yielded 4 passes and 19 failures, requiring historical global media identity,
remote-fetch and wallet rewrites outside this composition. The parent explicitly
authorized removing only these four newly imported executable files. Their original
hashes remain marked `excluded-global-owner-contract` in the manifest. Every Studio
and timeline-export suite is retained and executed.

## Environment limits

No source-worktree writes, environment-file copies, database calls, storage writes,
paid generation, deployment or push were performed. Worker launch requires its
existing configuration gate and real artifact completion. PostgreSQL concurrency,
browser qualification and export financial review belong to the subsequent tasks.
