# Milo access and exhausted credits

Studio and generation composers require an authenticated account to chat. Lite uses the existing free assistance policy (fair use and availability apply). Standard and Max use the existing shared monthly and purchased Milo credits; no new grant or tariff is introduced.

All levels remain selectable. Selecting a level does not buy credits. When a paid request cannot reserve its bounded maximum cost, the application preserves the message and offers **Send with Lite** or **Add credits**. Opening the existing credits panel does not send the message or buy a pack. Purchases retain their separate confirmation. A positive balance can still be insufficient for the next bounded request.

The free-send action first selects Lite, then submits one fresh identity with the accepted assistance model/revision. The server verifies that pair under the account lock. An intervening selection in another tab rejects the send before dispatch and restores the draft. New writing takes precedence over restored text, including after reload. Unknown/dispatched outcomes keep the existing request recovery path: they cannot be replaced by a fresh free call.

A new Studio task records `explicitLiteChoice: true` in its immutable resource snapshot. Funding exhaustion pauses that task. **Continue with Lite** is a revisioned, idempotent approval: it atomically selects Lite and opens a new segment while preserving the original task authorization, recorded costs, completed work and global resource limits. It neither buys credits nor authorizes media generation. Historical snapshots retain their original fallback/recovery behavior. This increment needs no additional migration.

Lite remains selected until another explicit choice. Reference editing stays available when sending is blocked. A funding-paused task owns its notice; an empty next-message composer does not repeat it. Lite availability is checked for the task action and rechecked by the server. Existing video/audio analysis requires the appropriate Standard/Max analysis path and its explicit credit confirmation; switching chat level does not initiate an analysis or media generation.

## Validation

Qualification uses actual browser components and disposable PostgreSQL with injected provider responses. No real provider call, wallet purchase or production operation is needed for these scenarios.

- Regression cases: unauthenticated chat, failed maximum reservation with positive balance, edited-draft preservation, duplicate click, account switch, cross-tab tier switch, unknown usage, rejected recovery after reload, unavailable Lite, owned task continuation and completed-work preservation.
- Existing historical task fallback and low-credit completion recovery remain covered separately.
- Whole Studio QA and connected browser results are recorded in the PR validation notes. The earlier connected task fixture was updated from the old two-level/automatic-fallback expectations to the current three-level, explicit-choice behavior.

2026-10-29 checks: 47 focused checks passed. `npm run qa:editor` in the isolated snapshot passed with 1,453 tests and one optional skip; TypeScript passed and ESLint reported 0 errors / 7 existing warnings. The broad `test:editor:e2e` run reported 89/91 passing: the reference-button gating failure was corrected and the obsolete two-level task test was rewritten. Both affected connected tests subsequently passed, along with mobile chat. The full browser command was not repeated as one green run. No production migration or deployment was performed.
