# Seedance 2.5 Draft: preview inside the existing workspace

## Local checkpoint

The visual preview now uses the actual `/app` route, model selector, composer,
settings toolbar and workspace shell. Open:

`http://localhost:3106/app?engine=seedance-2-5&draftPreview=1`

- A single native checkbox, `Activer Draft · 480p → final 1080p`, sits on a
  dedicated line below the settings/generation toolbar, immediately before its
  explanation. It does not participate in the toolbar's horizontal layout.
  The prompt has no separate mode-choice question or two large cards.
- Checking it adds a compact `Mode Draft` badge to the existing model strip and
  changes the resolution label to `Draft 480p 🔒`. The existing resolution is
  locked to 480p and the output count to one. Unchecking restores the prior
  resolution and normal action label.
- The action reads `Draft 480p`, keeping the generation button compact.
  A short note distinguishes a Draft
  eligible for linked finalization from an ordinary 480p video, and explains the
  optional, separately paid 1080p final.
- Prompt, duration, aspect ratio and audio remain editable before the Draft.
  The mode stays selected when the idea changes. After the simulated result,
  duration, aspect ratio and audio are disabled; the final uses their snapshot.
- The result offers `Finaliser ce Draft en 1080p · supplément` and `Nouveau Draft`.
  Starting a new Draft unlocks setup while keeping the mode selected and 480p
  locked. It discards old reference prices and invalidates pending responses.
- Final confirmation reads both current normal 480p and 1080p references from
  `/api/pricing/quote`, inheriting duration, aspect ratio and audio from the Draft.
  It displays the first amount, final supplement and combined total. These are
  explicitly reference prices for the mockup, not approved Draft/final tariffs.
- A missing reference, currency mismatch or unsafe sum prevents confirmation.
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
- Native checkbox: `_components/SeedanceDraftLocalPreviewMode.client.tsx`.
- Existing composer and shell own the action and placement respectively.

The full provider workflow, separately priced Draft and final quotes, actual
jobs/payments, ownership/expiry checks and provider canaries remain governed by
`docs/superpowers/plans/2026-09-28-bytedance-direct-draft-workflow.md`. This visual
checkpoint does not complete those release gates or activate new tariffs.

## Verification

The focused Draft preview, workspace composer and layout contracts pass
(27 tests). The new restart regression was first observed failing, then passing:
late quote responses cannot repopulate a new Draft setup. TypeScript, frontend
lint, public exposure lint and `git diff --check` also pass.

Browser acceptance on the actual local workspace covers the checked mode,
480p/output locks, inherited duration/format/audio locks after the simulated
result, final quote confirmation, cancellation and returning to setup. The
4 s / 21:9 / audio-enabled form uses normal 480p / 1080p references of
$1.35 / $6.83, totalling $8.18. These are not newly activated Draft tariffs.
No provider generation or billing action is submitted.

After moving the checkbox below the toolbar, browser review at the current
1064 px viewport confirms the duration and generation controls share the same
y-coordinate (515 px); the checkbox begins below them (586 px). No horizontal
space in the settings row is reserved for the Draft option. Both checked and
unchecked states remain interactive. A pre-existing local CookieBanner warning
about an unconfigured cookie policy is unrelated to this layout change.
