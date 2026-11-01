# Milo settings focus implementation plan

Scope/design: [response focus ownership](../specs/2026-11-01-milo-settings-focus.md).
Root approved synchronous Send focus and reply-time restoration only from the
proposal reader being closed, following the independent 7698 review. Work only
in the isolated codex/milo-preserve-settings-focus branch, based on fresh main.

1. Establish the existing panel DOM baseline; add a real-browser regression on
   actual Panel/CoreSettingsBar/SelectMenu with delayed synthetic completion.
   Observe RED for a menu/focus interaction and keyboard Send return.
2. Share a synchronous focus-before-onSend callback between button and Enter.
   Keep reply-time focus only when the exact proposal body contains activeElement,
   captured before closing it. Keep pending/IME/form guards.
3. Run the new browser regression, existing panel keyboard/form and relevant
   input/audio/layout browser checks; TypeScript, lint, exposure and diff. Preserve
   the initial full build as historical; Git CI/Vercel build gate the final candidate.
4. Review and commit a clean diff; record exact base/head/tree and evidence in
   the private handoff. Root owns independent review, publication, CI and delivery.

No production UI/SQL/provider calls, paid replay, merge or manual deployment.

Review delta: reproduce editor/Copy reader-unmount focus loss on 7698 in both
Chromium and WebKit (four RED cases), then verify conditional restoration and the
existing menu/persistent-control/Send checks together. Do not overwrite the closed
7698 handoff or logs; record the second commit and verification separately.
