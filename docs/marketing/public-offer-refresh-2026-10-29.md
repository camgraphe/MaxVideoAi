# Public offer refresh and Milo app guidance — 29 October 2026

Continuation explicitly authorized after the account change. Work remains on
`codex/prompt-director-composer`, draft PR #555. No production merge, migration,
tariff write, worker activation or paid media generation was performed.

## Delivered

- Pricing requests current canonical quotes for compatible presets, including
  models with no legacy numeric price. It reads the configured enabled catalog
  once, excludes disabled models before quoting and fails closed on catalog
  errors. The bounded queue, deduplication and separate video projection remain.
- Duration choices are constrained by the selected mode, configured fields and
  effective maximum. A stale static option or another mode cannot reopen a
  duration. A missing current quote never falls back to an old price.
- Pricing, PAYG and general EN/FR/ES discovery reflect FLUX 3 Max, MiniMax H3,
  Kling 4.0 and Seedance 2.5. General Pika promotion was removed; historical
  media, source identities and comparison/archive URLs were preserved.
- PAYG now explains Milo for prompt help and Studio for project planning.
  Comparisons describe the lowest quoted option for the displayed settings;
  differing 4K durations are explicit. No market-wide savings claim is made.
- Kling 4 pricing publication is enabled in the authored registry. Its actual
  approved customer tariffs remain authoritative. Legacy percentage previews
  and historical audits cannot invent an old Kling tariff. Immutable fixtures
  stay unchanged; ten new offline discovery rows explicitly contain no price.

## Milo understands the current workspace

The server now supplies an explicit app guide in addition to technical model
guides and current context. Video, image and audio composers have distinct
instructions; Studio retains its own project/tool guidance.

For example, a help question in Modify should direct the user to **Video to
modify**, explain Upload / Choose from Media, and distinguish that source from
optional references. Extend follows the selected model's actual constraints:
some models require an eligible owned generation and cannot use a phone upload.
Advice about duration, resolution, framing, audio or references must use the
current capabilities. The assistant does not apply settings or generate media.

Navigation-only help returns no replacement prompt. **Use prompt / Use script**
applies a suggestion; generation remains a separate user action. Current context
supersedes stale conversation values. These are model instructions, not a
deterministic guarantee of every future answer.

Three actual synthetic API exchanges were checked: Lite/Seedance Modify,
Standard/Ray Extend and Max/Studio. All gave the expected workflow guidance;
generator help returned `text: null`, and no tools or generation were invoked.
Recorded usage: 12,449 input and 1,460 output tokens, including reasoning.
This is a bounded functional sample, not a broad quality benchmark. Paid media
spend remains **$0 of the $10 allowance**; LLM usage is separate and not claimed
to be free. Private logs and account screenshots remain unpublished.

## Qualification evidence

- Application build at `3bdcd5990` succeeded from a clean clone. The following
  audit correction at `7d29853b2` changes audit collectors, additive evidence and
  tests, not generation or billing behavior.
- Pricing/admin duration suite: 103/103; PostgreSQL pricing/PAYG: 25/25; marketing
  expectation updates: 36/36; native-tariff/public-baseline audits: 58/58.
- App-guide context/scope checks: 19/19. Earlier resumed discovery: 118/118.
- Clean-clone connected browser and Git-dependent checks: 25/25. Isolated Studio
  lane: 4/4. Additional browser and initial-cutover results are recorded below
  when complete.
- Nine live local HTTP checks passed: Pricing, PAYG and comparison hubs in
  EN/FR/ES, with successful responses, correct canonical/hreflang and valid
  JSON-LD. Pricing/PAYG show the current models plus Milo/Studio, without Pika 2.2
  promotion. `/app` also returned HTTP 200 after development compilation.
- TypeScript passed. The first final lint found one newly unused helper, which
  was removed; the final lint result is recorded below. Public-exposure checks
  passed. No private QA screenshot was staged.
- An initial full run from an archive had 11,196 passes, 26 failures and four
  skips. It is **not** a green full-suite run. Failures identified stale editorial
  expectations, the Kling historical-audit boundary, and tests requiring Git
  history that an archive does not contain. Corrections and clean-clone reruns
  are reported separately; required final Quality CI remains the merge gate.
- Manual Codex browser control is disabled on the new account. Earlier visual
  evidence is retained; fresh automated browser checks and HTTP checks are not
  presented as a new manual visual sign-off.

## Review decisions and limits

One fresh independent final review found one Important issue: configured
durations could leak through stale static mode options. Two tests reproduced it
before the fix and passed afterward. No Critical findings or deferred minors.

Decisions, in order:

1. Publish Kling pricing discovery because app/model publication already exists
   and current offers were requested. A row may show live quote instead of an
   amount when the approved price is unavailable; it must never invent one.
2. Add a bounded composer app guide: technical model fiches did not explain UI
   controls. The risk is stale directions after a UI change; ownership, versioned
   context and provider-envelope tests make that dependency explicit.
3. Preserve earlier independent reviews rather than re-reviewing every older PR
   change. Older interactions can still escape the incremental review; required
   full-PR CI and release qualification remain necessary.
4. Leave production schema/config/provider/worker operations outside this
   increment, as requested. Delivery still requires the documented rollout.
5. Treat three synthetic replies as bounded evidence and retain the manual
   visual limitation. Broader model quality and some visual issues remain to
   qualify; no general reliability or savings guarantee follows from the tests.
6. Keep retention/deletion/customer-information policy as an activation gate.
   Admin tooling alone does not establish that policy, so expanded review
   capture is not yet authorized for production.
7. Rerun Git-dependent tests in a clean clone with history instead of an archive.
   This costs additional local test time; original failures remain in the record.
8. Retain the ignored ledger and pause evidence for the requested cross-account
   handoff. They consume local disk space and remain outside published assets.
9. Preserve immutable financial fixtures and separate Kling native tariffs from
   historical percentage audits. Offline and current quotation evidence could
   otherwise diverge; current-quote and PostgreSQL parity tests remain required.

For schema/flags/workers, customer disclosure, rollback and final domain checks,
follow [the rollout procedure](milo-launch-delivery-2026-10-29.md). Main must be
refetched and deployment alignment rechecked before any future merge. The public
promise must launch together with functional assistance.
