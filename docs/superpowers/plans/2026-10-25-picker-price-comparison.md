# Model picker price comparison implementation plan

> **For agentic workers:** use superpowers:executing-plans in this session.

**Goal:** Stabilize the picker and make it the workspace price-comparison surface with compact editable settings.

**Architecture:** The shared dialog renders a fixed viewport-bounded frame and route-provided control descriptors. Video owns a provisional settings scenario, canonical preparation and exact estimates; the existing transactional review owner validates and commits the final setup. Image retains its exact adapter with a stronger shared price context.

**Tech Stack:** Existing Next.js, React, CSS modules, TypeScript, node:test/jsdom.

**Spec:** User's 2026-10-25 instructions in this thread: stable popup; prominent compact price basis; editable duration/options; replace app Compare with prices in the picker. Existing authorization to implement and provide preview continues.

## Global constraints
- No generation, price-policy, registry identity or public comparison-page changes.
- Preserve prompts, references, operation, account boundaries and saved configurations.
- Provisional controls do not write the composer or storage; closing discards them.
- Real quote transport, debounce, cache, visible-only estimates and concurrency limit of three remain authoritative.
- Show effective adaptations before committing, including updates to the current model.
- Source-managed duration is read-only and never presented as an arbitrary five seconds.

## Review focus
- Old callbacks after account/source changes cannot apply a scenario.
- Same-model duration changes must commit; cancel must preserve every source field.
- Audio defaults on model change must not override an explicit scenario choice silently.
- Short mobile viewport, empty search, family expansion and confirmation keep stable outer bounds.
- Price requests must reflect the eventual committed scenario; old replies remain hidden.

## Tasks
- [ ] Add meaningful tests for scenario preparation, source duration, current-model changes and stale callback rejection; observe failures.
- [ ] Add focused video scenario helper and provisional hook state. Reuse candidate preparation and transaction guard for application.
- [ ] Add compact accessible native-select chips in a highlighted price context; use fixed dialog geometry and a clearer opener.
- [ ] Retire the separate workspace Compare entry while keeping access to saved configurations.
- [ ] Run focused behavioral/contracts, type/lint checks and production build; inspect actual desktop/mobile UI and bounded price loading.
- [ ] Review the full diff, publish a preview through Git/PR and coordinate delivery with Évaluer le potentiel du marché.
