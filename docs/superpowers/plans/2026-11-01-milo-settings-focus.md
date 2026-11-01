# Milo settings focus implementation plan

Scope/design: [response focus ownership](../specs/2026-11-01-milo-settings-focus.md).
Root approved synchronous Send focus and no asynchronous reply focus. Work only
in the isolated codex/milo-preserve-settings-focus branch, based on fresh main.

1. Establish the existing panel DOM baseline; add a real-browser regression on
   actual Panel/CoreSettingsBar/SelectMenu with delayed synthetic completion.
   Observe RED for a menu/focus interaction and keyboard Send return.
2. Remove only the reply focus call; share a synchronous focus-before-onSend
   callback between the button and Enter paths. Keep pending/IME/form guards.
3. Run the new browser regression, existing panel keyboard/form and relevant
   input/audio/layout browser checks; TypeScript, lint, exposure, diff and build.
4. Review and commit a clean diff; record exact base/head/tree and evidence in
   the private handoff. Root owns independent review, publication, CI and delivery.

No production UI/SQL/provider calls, paid replay, merge or manual deployment.
