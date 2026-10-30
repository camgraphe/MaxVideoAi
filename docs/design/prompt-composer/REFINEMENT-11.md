# Draft discoverability and model-control audit

2026-10-29 · draft PR #555.

The Seedance 2.5 Draft option was absent from the local composer because this
development server does not enable the native workflow. Both
`SEEDANCE_2_5_DRAFT_ENABLED` and `PRICING_SANDBOX` were unset; its database is not
local. The composer still forwarded the original Draft settings notice and the
workflow still owned the separate quote, 480p constraint and recovery state.
No environment, server activation or paid generation was changed for this review.

The development-only prompt-assistance preview now retains a disabled Draft
checkbox for compatible setups when the real workflow is unavailable. Its tooltip
and accessible description explain that Draft generation is not enabled in this
local preview. This display-only control never reaches pricing, resolution or
generation handlers. Real controls take precedence when available. Ordinary
production rendering still hides the control when its server switch is off.

Scenario compatibility is shared with the existing native workflow: Seedance
2.5, one output, supported creation/Modify/Extend modes and framing. Other models
and multiple-output setups do not receive this placeholder. Active Draft copy,
settings locks, restoration and finalization remain unchanged.

## Verification

- Reproduced the missing checkbox with a failing browser assertion before the
  change; the new regression passes on Chromium and WebKit at 390 and 1440 px.
  It covers Prompt/AI assistant, Create/Modify/Extend, inactive/live controls,
  normal-generation labels, resolution restoration, incompatible models/output
  count, and the production activation boundary.
- Existing native Draft tests cover its own quote, source/reference inputs,
  ordinary/Draft toggling and same-attempt recovery in all five supported modes.
- Catalog audit: every published engine remains reachable through its family;
  supported Modify/Extend actions retain mode-specific controls and reference
  fields. Existing matrices also check source framing/duration, audio settings,
  image/audio/video reference roles and model-specific options.
- Real compact-selector browser tests retain short model names/logos, eligible
  and disabled variants, keyboard interaction and prompt preservation. Composer
  browser tests cover source references in both tabs, character-library actions,
  audio text-field selection, scrollable conversation and manual fallback.
- Focused suites passed; TypeScript, scoped ESLint and whitespace checks passed.
- The general fast validation reported 9,749 passes, one skip and two failures
  in older test fixtures: the image-picker lifecycle fixture did not stub the
  newly imported composer CSS, and a source contract still expected the old
  mode-header condition. Both expectations were updated to the existing preview
  integration and their affected suites passed on a focused rerun. No product
  behavior was changed to satisfy these two tests.

This is an interface/contract audit, not a paid generation test for every model.
No additional missing control was found in these checks. Server feature switches
must be included when comparing the local preview with production.
