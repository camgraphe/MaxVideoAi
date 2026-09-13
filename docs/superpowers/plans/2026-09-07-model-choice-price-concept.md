# Model Choice and Price Concept Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans task by task. Keep one visual owner in the already isolated branch; the user has authorized execution and asked to retain important existing functions.

**Goal:** Make model choice, comparable settings and price before generation visible in the accepted Create composition.

**Architecture:** Extend the isolated prototype with a read-only projection of the existing public catalogue and canonical public estimates. The browser selects a complete, precomputed scenario; it has no pricing formula, account connection or generation API. Production integration keeps the existing server preflight, model schemas and workspace hooks.

**Tech Stack:** HTML/CSS/JavaScript prototype, TypeScript catalogue exporter using existing pricing owners, Python preview preparation.

**Spec:** `docs/superpowers/specs/2026-09-07-app-concept-reset.md`, latest acceptance and preservation requirements.

## Global constraints

- Work in `codex/app-experience-first-lot`; no merge, push, deployment or paid generation.
- The visual direction is accepted for exploration. Functional completeness and production integration are not yet validated.
- No authored prices or new pricing formula. Display Member/USD versioned catalogue estimates, not an account-specific payable quote.
- The first price demonstration covers text-to-video, six explicitly identified catalogue models. Image/audio and reference-conditioned quotes remain visibly unconnected, never assigned a text-only price.
- Reference scenarios retain their explicitly illustrative status and existing add/replace/remove/undo/create-return interactions. They do not assert the selected real model's input capabilities.
- Compare identical duration, resolution, aspect ratio and sound requirement. Incompatible candidates require explicit adjustment and confirmation. Closing a candidate panel preserves the original draft.
- Keep essential mobile controls named and at least 44 × 44 px; maintain keyboard focus, reduced motion and horizontal containment.
- Record important existing features as integration acceptance criteria; omissions from the prototype do not authorize product removals.

## Task 1 — Public catalogue projection

**Files:** Create `docs/design/global-app-concept/export-catalog.ts`; modify `preview.py`; generate ignored `prototype/catalog.generated.js`.

**Interface:** Export `catalogue = { scope, models: [{ id, label, durations, resolutions, formats, audio, quotes }] }`. Each `quotes` row is `{ duration, resolution, audio, totalCents, currency }` for `mode: 't2v'`, `membershipTier: 'member'`. No provider costs or internal margin details reach the browser.

- [x] Select six app-enabled, available text-to-video entries with `listFalEngines()`: Veo 3.1 Fast, Veo 3.1, Kling 3 Pro, Sora 2, Wan 2.6, Seedance 2.5. Throw if an entry is missing or no longer available.
- [x] Derive options using `buildEngineOption(entry, entry.engine, entry.engine, getPricingKernel(), {})`. Calculate scenarios through `buildAudioAddonPayload`, `buildPublicPricingFacts({ ..., useStandardDefinitionFacts: true })` and `quotePublicPricing({ ..., compatibilityProfileId: 'public-rounded-vendor-current' })`, matching the public estimator.
- [x] Make `preview.py --prepare-only` run the exporter with the frontend tsconfig and copy only named prototype modules. Reject invalid/nonpositive totals; write only the ignored catalogue projection.
- [x] Validate exported sample scenarios against the public owner and run the existing public-pricing authority tests; no change to registry or commercial policy.

## Task 2 — Model selection and price in Create

**Files:** Create `docs/design/global-app-concept/model-choice.js`; modify `app.js`, `app.css`.

**Interfaces:** `initialModelChoice()`, `modelFor(choice)`, `matchingQuote(choice, referenceCount, missingSource)`, `adaptChoice(model, previousChoice)`; presentation helpers receive escaped local model data. The per-kind draft retains `modelChoice` through the existing structured-clone return flow.

- [x] Place the selected model and a named Compare command above the media; put compact duration/resolution/format/sound options and a visible estimate next to the simulation action.
- [x] Compare all six models under the same settings. Show an exact estimate only for a matching row and supported format/sound. Otherwise show the specific settings to adjust, with no numerical comparison under different conditions.
- [x] Open a candidate editor with compatible retained values and explicitly listed proposed changes. Only Apply updates the draft; Cancel/Escape preserves it. Price updates when options change.
- [x] Replace the amount with a reference-quote placeholder whenever references or a required missing source invalidate the text-only scope. Keep image/audio estimate absence explicit.
- [x] Preserve all current reference, library and account interactions, and verify the new command layout on desktop and mobile.

## Task 3 — Acceptance and preservation record

**Files:** Update spec, previous concept plan, README and review; create `docs/design/global-app-concept/integration-contract.md`.

- [x] Record the user's acceptance of the visual direction and demand for model choice, upfront price and continued improvements without losing important features.
- [x] Record concrete integration gates for existing model/mode controls, real quotes, references, output/history actions, library, preferences, billing, audio and MCP/Studio, using current owners as evidence.
- [x] Exercise model comparison, candidate cancellation/application, option changes, missing quote after reference insertion, return-draft preservation, keyboard and 320/390/1440 layouts. Run syntax checks and `git diff --check`.
- [x] Open the updated prototype and report what is demonstrated and what still requires real application wiring.

## Self-review

This lot makes the approved composition reviewable with actual public catalogue estimates. It does not imply all production controls or quote modes are already integrated. The preservation contract governs the next application integration plan.
