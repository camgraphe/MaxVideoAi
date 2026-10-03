# Studio release readiness

User-directed implementation, 3 October 2026. Work stays on `codex/studio-creative-workspace`; production deployment requires the user's final review. All Create assistant work remains deferred.

## Experience

- Public pages retain their fixed light design. App appearance follows the device on first use, with light fallback; explicit choices persist across app and Studio. A compact sun/moon control lives in the shared menu.
- `/app/studio` opens the most recent connected conversation. If there is none, the client creates one through the existing authenticated, idempotent POST while showing the chat opening state. Server GETs never create projects. Access errors must not masquerade as an empty project collection.
- The chat remains centered, with its serif welcome, sparse controls and real, gently tilted media. No artificial generated decorations or response mascot.
- Projects open in an accessible top-right dialog, with search, current-project identity, new conversation and links to saved conversations. Classic/local projects and explicit starter/media handoffs retain their existing Canvas route.
- Media can be mentioned in chat or explicitly added to the timeline. Those are different actions. Timeline insertion uses existing owned-media and measured-duration rules; no generation is automatically inserted.
- Timeline controls explain add, preview, inspect and export with compact accessible labels. Saved state, source limits, linked audio, request recovery and generation confirmation remain authoritative.

## Economics and observability

Implement the companion economics design: Sol default, a bounded included trial, explicit paid wallet budget, or sponsored Luna continuation. Luna is not restricted to finishing a conversation. Contextual reminders distinguish the assistant from the generation model and never turn media generation into free work.

Initial beta policy is versioned and gated: $1 supplier-cost Sol allowance, $0.25 supplier-cost Luna allowance per account, $100 aggregate sponsored campaign. Paid Sol tariff uses noncached input $7.50/M, cached input $0.30/M and output $30/M, rounded cumulatively per client request. A maximum of $20 additional authorized spend is offered at one time. These are proposed launch defaults for review, not activated production prices. Client allowance indicators must not present provider-cost dollars as redeemable wallet money.

Durable reservations precede provider dispatch; settlement is idempotent and ambiguous outcomes retain exposure until reconciled. No real customer balance, provider call or production schema is changed during implementation. Preserve independent cost and charge facts and the learning strategy's limits on external host conversation visibility.

## MCP and public promises

Audit discovery, instructions, model publication, mode parity, quote/confirmation contracts and update procedures. Run executable offline checks and explicitly distinguish those from real-host evaluations. Public Studio copy is chat-first, accurately localized and tied to implemented features; it must not advertise disabled unlimited free assistance or unverified artistic superiority. Use real UI captures.

## Release evidence

Focused unit/DOM/Postgres checks, TypeScript, lint, exposure and diff checks; browser checks on desktop/mobile, light/dark, keyboard dialogs, media mentions and timeline interactions; production build if supported by the isolated fixture. Record remaining deployment prerequisites and untested external integrations. A feature flag being off is not proof the enabled path works.
