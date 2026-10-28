# Prompt assistance — first app integration plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. Keep work in the existing isolated worktree and draft PR.

**Goal:** Evaluate and refine the compact prompt/Milo interaction inside the real video, image and audio generators before connecting paid assistance.

**Architecture:** Keep route-owned drafts, references, quotes and generation handlers authoritative. Add small controlled presentation components shared where the UX matches, with route adapters for media-specific fields. The first increment exposes a labelled, simulated Milo conversation only in opt-in local development; ordinary and production behavior remain on the existing path until the live service is implemented.

**Tech Stack:** Existing Next.js, React, TypeScript, CSS modules/product tokens, Node test runner and existing DOM/browser fixtures; no new UI, state or agent framework.

**Spec:** [Prompt and Milo design](../specs/2026-10-28-prompt-director-design.md), especially revision 3; [current prototype evidence](../../design/prompt-composer/REFINEMENT-3.md).

## Global constraints

- Keep branch `codex/prompt-director-composer` and its dedicated worktree. Update the same draft PR after each reviewable increment; do not merge or deploy as part of this plan.
- Preserve manual paste/editing, model/mode capabilities, reference ownership and mention guards, generation eligibility, real quotes, saved drafts and account boundaries.
- Keep `Composer.tsx` below its contractual 500-line limit. No state ownership or framework migration.
- Preview copy and examples are English. Production copy must use the existing EN/FR/ES localization owners before release.
- Keep Milo distinct from Studio. Reuse existing Sol/Luna modes and assistance credits in the later service increment; Terra evaluation is separate.
- A suggestion never generates media. Applying is explicit, revision-checked and undoable only while no intervening draft edit has occurred.
- Two preview lines, expand/collapse, action in the proposal header outside both text and transcript scrolling. References use short role/type labels, 32 px thumbnails and comfortable hit targets. Keep current heading sizes and restrained focus/hover styles.
- UI reference identities do not authorize provider asset bindings. Keep provider-specific mention translation and changed-reference checks; do not send preview aliases blindly.
- Local preview activation: `NODE_ENV === 'development'` and `NEXT_PUBLIC_PROMPT_ASSISTANCE_PREVIEW === '1'`. No authentication bypass, provider call, billing call or schema mutation from the simulated assistance path.

## Review focus

- A long conversation plus a 4,000-character prompt in a narrow app column: history remains reachable, the proposal stays compact, and its action is outside expanded text scrolling (tasks 1 and 4).
- A reference removed/replaced while a suggestion is displayed: it cannot silently retarget or overwrite a newer draft (tasks 1 and 2).
- Mode/model/account changes during a delayed sample response: no stale application or cross-account conversation display (tasks 1–3).
- Audio voice text versus music style, lyrics and delivery: applying to one field cannot overwrite or insert reference tokens into another (task 3).
- Keyboard, IME and mobile input: Enter sends only from Message Milo, Shift+Enter inserts a newline, composition cannot submit, and no chat action triggers generation (tasks 1 and 4).

## Delivery sequence for the same draft PR

1. **This plan:** real app layout with a clearly labelled, development-only sample conversation. Review actual page widths, results rail, long content and mobile scrolling. This is not a live assistant.
2. **Next implementation plan:** authenticated prompt-assistance context, model/mode guides, typed and revision-checked proposals, durable idempotent calls and existing Milo credit accounting. Inspect the ledger ownership before implementation; do not impersonate a Studio project or reuse its endpoints with a fabricated actor. Test with provider fixtures and disposable PostgreSQL 17, including Studio billing regressions.
3. **Completion:** enabled live path only after its service and billing checks pass; EN/FR/ES, model/mode coverage, access and account-transition checks, browser QA and required Quality CI on the current candidate. Refresh main before merge according to the delivery guide.

Only step 1 is executable from this file. The service increment needs its own bounded plan using the already agreed spec; the present HTML sample is not a provider or billing implementation.

## Task 1 — shared panel and safe local interaction state

**Create:**
- `frontend/components/composer/PromptAssistancePanel.client.tsx` — transcript, suggestion header/preview/editor and labelled message field; no provider, pricing or generation imports.
- `frontend/components/composer/prompt-assistance.module.css` — scoped layout using existing tokens; separate transcript/editor scrolling.
- `frontend/components/composer/prompt-assistance-copy.ts` — copy through the existing locale conventions.
- `frontend/src/lib/prompt-assistance/preview-state.ts` — pure reducer for the local sample session.
- `frontend/components/composer/usePromptAssistancePreview.ts` — opt-in development fixture controller; no network calls.
- `tests/prompt-assistance-preview-state.test.ts`, `tests/prompt-assistance-panel-dom.test.ts`.

**Interfaces:** `PromptAssistancePanelProps` contains `messages: readonly {id:string; role:'user'|'assistant'; text:string}[]`, `proposal: {text:string; target:'prompt'|'script'|'lyrics'; stale:boolean}|null`, `message:string`, `pending:boolean`, `onMessageChange(text)`, `onSend()`, `onProposalTextChange(text)`, `onApply()`, `onCopy()`, and `references: ReactNode`. Presentation has no Generate callback. The preview controller takes `scopeKey`, `revision`, `target`, `draftText` and `onApplyText(text, expectedRevision)`; it exposes these panel props plus writing mode and an undo action. It clears on scope changes, invalidates on revision changes and uses the existing draft callback only after checking the expected revision.

- [x] Install locked dependencies inside this worktree with `pnpm install --frozen-lockfile` before running the component tests. Keep its mutable build and database test state separate from other checkouts.
- [x] Write reducer tests for a response captured at revision 3 arriving after revision 4 (application rejected); account/model/mode scope change (messages and pending result retired); apply then edit then undo (undo rejected); full 4,000-character application (not a two-line excerpt).
- [x] Run `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/prompt-assistance-preview-state.test.ts`; confirm failure for the missing reducer, then implement it and rerun to PASS.
- [x] Build the controlled panel and development fixture controller. Keep a visible “Sample conversation” note in the opt-in path; no simulated credit balance. Copy and apply the complete edited proposal. Expanded text has a bounded height; its action and stale warning sit outside it. Do not scroll the transcript on user edits or passive renders.
- [x] Add DOM tests for collapse/expand/action visibility, apply/undo, disabled stale action, re-entry focus, Enter/Shift+Enter/IME, and zero Generate calls. Run `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/prompt-assistance-panel-dom.test.ts` to PASS.
- [x] Commit the panel and local interaction boundary together.

## Task 2 — integrate video and image without replacing their state owners

**Modify:** `frontend/components/Composer.tsx`, `frontend/components/composer/composer-types.ts`, `frontend/components/composer/WorkspaceReferenceSection.client.tsx`, its inventory/popup children as required, `frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx`, and `frontend/app/(core)/(workspace)/app/image/_components/ImageWorkspaceComposerSurface.tsx`.

**Create if needed to meet the existing line contract:** `frontend/components/composer/ComposerPromptEditor.client.tsx`, containing only the existing manual input/header/prompt-counter rendering with unchanged refs and callbacks.

**Interfaces:** add an optional `assistance` presentation prop to `ComposerProps`, populated only by the development adapter from task 1. Pass the actual engine ID, active operation/mode, draft revision and account scope into the controller at route level. Keep `useWorkspaceComposerState`, image route state and existing asset hooks as the source of truth. Single-text help is available only where a writable prompt exists. Multi-prompt scenes retain their current editor; disable the preview helper there with an explicit explanation until structured scene proposals are supported.

- [x] Extend `tests/workspace-reference-mentions-browser.test.ts` and the fixture in `tests/helpers/workspace-reference-browser-fixture.ts` to cover the new opt-in presentation alongside the default path. Assert selection replacement, changed-reference review, source-before-optional-reference ordering, no original video/audio loads for thumbnails, and no extra generation request.
- [x] Integrate the panel into the actual composer flow. Reuse asset import/library actions and role compatibility. Keep required source hints, excerpt editing, advanced controls, negative prompt, model-specific directives and pricing status accessible. The plus opens existing reference actions; it must not become a second uploader.
- [x] Apply compact reference and settings styling only in the opt-in workspace presentation. Separate display aliases from the provider mention payload using the existing reference identity/mapping; retain existing provider numbering and review guards in this preview; stable display aliases require a submission adapter in the service increment.
- [x] Run the updated reference browser test and `tests/workspace-reference-mentions.test.ts`, `tests/workspace-composer-surface-contract.test.ts`, `tests/workspace-first-viewport-contract.test.ts`, `tests/workspace-composer-generation-split-contract.test.ts`, `tests/composer-quote-layout-browser.test.ts`, `tests/workspace-source-settings-browser.test.ts`, and `tests/image-workspace-split-contract.test.ts` with `pnpm exec tsx --tsconfig frontend/tsconfig.json --test <files>`. Update intentional presentation assertions where the opt-in DOM differs, while retaining the protected responsibilities and default-density behavior.
- [x] Commit the video/image adapter and checks together.

## Task 3 — integrate the current audio editor

**Modify:** `frontend/app/(core)/(workspace)/app/audio/_components/AudioCreationEditor.tsx`, `frontend/app/(core)/(workspace)/app/audio/AudioCreationWorkspace.tsx`, its `_lib/audio-creation-copy.ts`, and `_components/audio-creation.module.css`. Extend `tests/audio-creation-workspace-dom.test.ts` and `tests/audio-creation-state.test.ts`.

**Interfaces:** reuse task 1's panel. `voice` targets `draft.script`; `music`, `ambience`, `sfx` and song style target `draft.prompt`; song lyrics remain a distinct `draft.lyrics` field with an explicit target if offered. The existing `onChange(Partial<AudioCreationDraft>)` is the only mutation path. Include account, intent and selected audio model in the scope. Keep the video-soundtrack path (`intent=video`, `AudioWorkspace`) unchanged for this first local preview and record it as separate adapter work for the service increment.

- [x] Add tests that Use script changes only `script`, leaves voice/delivery/reference untouched, and never inserts `@Audio1` into speech. Verify changing intent/account retires a pending suggestion, and music style edits leave lyrics untouched.
- [x] Run both audio tests to see the new assertions fail, then integrate the opt-in panel using the real draft callbacks. Preserve per-field limits, reference ownership/upload cancellation, selected voice preview, generation and quote freshness. Reference mentions belong in the Milo message, never automatically in spoken text.
- [x] Rerun those tests plus `tests/audio-workspace-architecture.test.ts` to PASS; commit the audio adapter and tests together.

## Task 4 — review the real app and preserve rollback

**Update:** `docs/design/prompt-composer/REFINEMENT-4.md` with app screenshots and actual limitations; `docs/engineering/prompt-assistance.md` with ownership, preview activation and the unfinished service boundary. Add a real-component browser regression `tests/prompt-assistance-layout-browser.test.ts`, using existing browser-fixture conventions and product CSS.

- [ ] Use this worktree's own dev-server port and build directory. Configure required local settings without printing or committing secrets. Do not share another task's mutable `.next` or database test state.
- [ ] Run `NEXT_PUBLIC_PROMPT_ASSISTANCE_PREVIEW=1 pnpm --dir frontend dev --port 3018` (choose another free port if occupied). Inspect `/app`, `/app/image` and `/app/audio` with the real sidebar, model controls, preview and results rail. Use authenticated test access normally; do not bypass it. Never click a paid generation merely to verify layout.
- [ ] Check widths 320, 390, 768, 1024 and 1440 px, plus short-height desktop, 200% zoom, dark mode and reduced motion. Exercise ten exchanges, a 4,000-character video prompt, several references, opening/closing the full prompt and an active mobile keyboard where available. Confirm history remains reachable without scrolling a long prompt first; add a conversation expand view only if the actual layout demonstrates that it is needed.
- [ ] In the browser regression, assert no horizontal document overflow; apply action outside the editor's scroll area in both states; bounded transcript independent of proposal length; keyboard focus returning to Message Milo; and no automatic generation. Confirm a production build and the flag-off local path cannot display the simulated assistant.
- [ ] Run frontend lint, TypeScript, `npm run lint:exposure`, i18n checks, the focused tests above and the new layout regression. Run the full frontend build when the local prerequisites are available. Record unavailable checks honestly; intermediate pushes need not wait for the full CI suite.
- [ ] Push the reviewed increment to the same draft PR. Rewrite the PR summary around the actual delivered behavior, attach before/after app screenshots and leave service/billing tasks unchecked. Keep the worktree for continued iteration.

## Current status

Tasks 1–3 implemented and verified. Task 4 app/browser checks and documentation are implemented; final branch review, build and PR update are in progress. The live assistance service is not implemented. See REFINEMENT-4.md and docs/engineering/prompt-assistance.md for the delivered scope and limits.
