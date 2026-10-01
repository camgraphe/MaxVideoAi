# Seedance 2.5 Draft: preview inside the existing workspace

## Local checkpoint

The visual preview now uses the actual `/app` route, model selector, composer,
settings toolbar and workspace shell. Open:

`http://localhost:3106/app?engine=seedance-2-5&draftPreview=1`

- `Draft 480p` is an additional promoted action beside Storyboard.
- Selecting it switches and locks the existing resolution control to 480p.
- The simulated result presents `Finaliser en 1080p` above the existing composer.
- Final confirmation reads a current normal 1080p reference from
  `/api/pricing/quote`, inheriting duration, aspect ratio and audio from the
  simulated Draft. That reference is explicitly not an approved Draft-final tariff.
- Cancellation invalidates an outstanding quote, so a late response cannot reopen
  or complete the final preview.

## Boundary

This is an interactive UI preview, not a connected provider workflow. It creates
no job, receipt, provider task or payment. On this explicit preview page, the
composer's generation action always invokes the simulation, including when the
Draft option is off. Normal `/app` pages retain their existing generation action.

The server requires all of: the explicit query flag, `NODE_ENV=development`,
`PRICING_SANDBOX=1`, and a loopback Host header. The query flag alone cannot expose
the preview in production. Draft controls currently target Seedance 2.5 text to
video with one output.

## Owners and remaining work

- Pure server gate: `_lib/seedance-draft-local-preview-gate.ts`.
- Bounded simulation state: `_hooks/useSeedanceDraftLocalPreview.ts`.
- Presentational result: `_components/SeedanceDraftLocalPreviewResult.client.tsx`.
- Existing composer and shell own the action and placement respectively.

The full provider workflow, separately priced Draft and final quotes, actual
jobs/payments, ownership/expiry checks and provider canaries remain governed by
`docs/superpowers/plans/2026-09-28-bytedance-direct-draft-workflow.md`. This visual
checkpoint does not complete those release gates or activate new tariffs.

## Verification

The focused Draft preview and workspace contracts pass (21 tests). Browser review
on the actual local workspace covered activation with the existing 480p control
locked, a simulated Draft, reading a current final reference, confirmation and
returning to the Draft. The current 4 s / 21:9 / audio-enabled form returned a
normal 1080p reference of $6.83. No generation action was submitted.
TypeScript, frontend lint, public exposure lint and `git diff --check` also pass.
