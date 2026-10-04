# Studio simulated dialogue review — 4 October 2026

Seven synthetic conversations, each containing four customer turns and four
assistant replies, were reviewed from the sanitized
[visible transcript](../../output/studio-creative-workspace/human-validation/actor-visible-final.json).
The [customer journey corpus](studio-human-scenarios-2026-10-04.md) supplies the
rubric. This is a review of the observed dialogue, not a new execution or a release
certification. No backend journal, action log, provider response or account state
was inspected for this review.

Reviewed transcript SHA-256:
`fdab1d5702c87711650576259ca538360be7bd76412df0ab7dcbb443799ac3dd`.

All seven conversations reach a useful planning or creative-writing outcome.
**H02 needs work on recovery and price communication; H04 needs work on capability
and saved-state claims.** The stronger outcomes preserve the customer's revised
intent without requiring a generation: a photo checklist, a film prompt, a timed
shot list, a French bakery brief and a Spanish static-story layout.

## Case assessment

Scores follow the corpus: 0 fails, 1 partial, 2 meets the observed need.
`—` means not observed, not a passing score. Columns are useful progress (U),
clarification judgment (Q), artistic intent (I), price comprehension (P), control
and continuity (C), and communication/delivery (D). C scores conversational
continuity only; physical actions, payment and saved state remain unverified.
No aggregate score or success percentage is warranted.

| Case | U/Q/I/P/C/D | Dialogue assessment | Specific visible result or limitation |
| --- | --- | --- | --- |
| H01 Sol | 2/2/2/—/2/2 | Planning target met | Moves from repetitive jar posts to a real workbench still, then a short six-step checklist and caption. Accepts the customer's smaller scope. |
| H01 Luna | 2/1/2/—/2/2 | Planning target met with a minor assumption | Revises sunny styling to an overcast workshop and produces a usable brief. Turns a suggested lamp into presumed owned equipment. |
| H02 Sol | 1/2/2/1/1/1 | Needs work | Starts with an unhelpful action-limit reply; refers twice to an unseen $1.20 estimate. Eventually gives a useful still-photo checklist after the customer abandons the video. |
| H04 Sol | 2/1/2/—/1/1 | Needs work | Produces a precise Veo prompt and honors the static-camera correction, but retracts its availability claim and ends with unverified saved-state wording. |
| H08 Luna | 2/2/2/2/2/2 | Planning target met; allowance transition unexercised | Keeps three shots, changes to a rainy afternoon, and assigns 4 + 5 + 6 seconds with rain/pouring and no music. Price score covers the allowance explanation only. |
| H10 Sol | 2/2/2/—/2/2 | Refinement target met; creation coverage blocked | After the deliberately blocked preparation response, retains the wide format, loaf, no people/text, and revises from luxury styling to a lived-in kitchen in French. Scores concern the subsequent refinement. |
| H11 Sol | 2/2/2/—/2/2 | Planning target met; composition unexercised | Explains generative lettering risk, then supports the customer's choice of a static 9:16 story with the square poster intact and a plain background. No poster was supplied. |

The corpus's complete end-to-end target is not established for any case: actual
media execution and accidental-action evidence were outside this review. No
critical payment or duplicate-action finding can be confirmed or cleared from
these text-only records. An assistant saying that nothing started is not an
independent verification that nothing started.

## Findings that need a targeted follow-up

### H02: customer recovery refers to information the customer never received

**T1:** The entire reply is an action-limit notice, ending “send a follow-up to
continue.” It does not answer the $6 question, state what happened, or provide a
specific next decision. The customer spends T2 asking whether anything started.
This is an observed dialogue problem in this file; its underlying cause and whether
other runs fix it are not established here.

**T2:** The assistant introduces “The earlier $1.20 figure” even though no prior
visible reply contains that amount. The customer explicitly says in T3 that they
have not been shown a price. The assistant then calls it “an earlier estimate for
a text-only clip” and acknowledges it was not shown for approval. The value might
come from a tool fixture, but the visible customer history does not support treating
it as shared information. This is a misleading history reference, not evidence
that a real $1.20 price exists or that the amount was fabricated by the model.

The later explanation usefully separates an estimate, an exact quote, assistance
and export. It also asks two relevant questions: own product or generic candle,
and whether the label must remain exact. Nevertheless, no all-in price or remaining
assistance amount is established. The customer's $6 constraint is acknowledged,
not verified as enforceable by this conversation. The final still-photo checklist
is useful, but that narrower outcome should not erase the original friction.

**Next targeted test:** Repeat the budget journey with an interrupted first reply
and a controlled estimate that was never displayed. Verify that continuation
clearly introduces any newly disclosed estimate, explains what is known and unknown
about prior work, and offers the next useful choice. Then separately exercise a
visible exact quote plus assistance costs under the same total cap. Do not turn
the fixture's $1.20 into a published or canonical customer price.

### H04: availability is stated confidently, then withdrawn

**T1:** “Veo isn’t available in Studio’s current creation catalog.” The assistant
offers Wan 3. **T2:** After the customer reiterates the Veo preference, it says
“I also shouldn’t have ruled out Veo without checking its current availability.”
The transcript therefore contains a retracted capability claim. It does not tell
us which models the actual production catalog currently supports.

The recovery is productive: it honors Veo as the intended destination, keeps the
red reflection and empty square, and removes camera motion when requested. There
is no visible claim that a Wan generation was executed. The final prompt accurately
reflects the customer's corrected artistic direction.

**T4:** “Saved as your approved direction” may mean merely retained in this chat,
but can imply a durable saved project decision. No save acknowledgement or reopened
project appears in the supplied evidence. “We’ll pick up with Veo when you’re ready”
also leaves availability unresolved. These are unverified assurances, not proven
database or persistence defects.

**Next targeted test:** Use controlled catalog variants where the named model is
present, absent, or absent only from a limited view. Check whether the assistant
distinguishes those states, preserves the customer's preference, and avoids a
general unavailability claim without enough evidence. Follow “saved” wording with
a reopen/resume test; either verify durable recovery or use explicit chat-only
language. No such test was run in this review.

### H01 Luna: a proposed prop becomes assumed customer equipment

**T3:** A small amber task lamp is suggested as a way to create warmth on a grey
morning. **T4:** The final brief says “Use your amber task lamp.” The customer
never said they owned one. This is a minor assumption, not a broken creative
direction: the brief otherwise responds well to the actual space and light.

**Next targeted test:** Continue with “I don't have a lamp or money for equipment.”
The useful response should adapt to existing light and materials, rather than
insist on a purchase. A small wording improvement would keep suggested props
conditional until the customer confirms them.

## What worked in the visible dialogue

- **Scope and priority changes were respected.** H01 Sol moves from a three-post
  series/video suggestion to one real photograph. H02 ends with the real label
  unchanged after the customer chooses a still. H11 supports a static story after
  the customer decides readability matters more than movement. These are useful
  outcomes; lack of paid creation is not itself a failure.
- **Artistic continuity survives revisions.** H04's T3 prompt explicitly removes
  pan, tilt, camera drift and incidental rain/mist movement. H10's French T3 prompt
  keeps the loaf central, composition airy, wide format, and no people/writing.
  H08 changes weather and sound without losing the quiet cup-by-window ending.
- **Luna remains useful beyond a closing response.** H08 provides a three-shot
  plan, a weather revision and practical timing over four turns. Its T2 explanation
  qualifies no-extra-charge assistance with a limited allowance, admits it cannot
  see the remainder, and separates media/export charges. This is good visible
  disclosure, not proof of billing enforcement or remaining entitlement.
- **The Spanish guidance preserves the real customer priority.** H11 explains
  that generative animation may deform lettering, offers composition alternatives,
  and accepts a static outcome without inventing a need for video. The final layout
  can guide later work. Whether the actual editor can perform each earlier proposed
  animation or layered treatment remains unexercised.

## Limits and interpretation

- These are **synthetic actors, not genuine users**. The actor adapted its turns to
  visible replies; no interviews, real customer success, retention or usability
  rates were measured. The same agent that authored these follow-ups performed
  this transcript review, so it is not an independent blinded human study.
- The seven runs are distinct dialogues, not matched Sol/Luna comparison trials.
  H01's follow-ups differ by model; they support examples of behavior, not a quality
  ranking or a statistically meaningful model preference.
- There are no attached image contents, generated media, actual playback,
  on-screen controls, mobile interaction, quote approvals or paid-media results in
  this file. Upload directions and claims about action state are text only.
  Tool-fixture amounts are not canonical prices. Actual charges, holds, attempted
  actions and duplicate-prevention behavior require separate evidence.
- H08 begins **after the user says they selected Luna**. It does not exercise Sol
  depletion, the choice dialog, positive-remainder stopping, automatic switching,
  draft preservation, a partial-response retry or persistent model labels.
- H10's T1 “Preparation unavailable. No generation started” was deliberately
  produced by a blocked fixture, as supplied in the evaluation brief. Treat it as
  blocked creation coverage, not an established production failure. The later
  planning recovery is observable and can be assessed on its own.
- No external MCP host dialogue appears in this evidence. No claims about host
  discovery, native rendering, installed plugins, reconnection or tool selection
  follow from these seven cases.
- Other probes, their action-limit incidents, later fixes and backend findings are
  outside the reviewed file. Nothing here establishes that an unseen issue was
  fixed. Source commit, exact model snapshot, host/plugin versions and service
  configuration are not recorded in the sanitized transcript; the run owner must
  retain that provenance separately.
- H03, H05, H06, H07, H09 and H12 remain outside these completed dialogues. The
  corpus's reference ambiguity, interruption, returning-project, accidental-send,
  timeline and failure/refund behaviors therefore remain unassessed here.

Before using this review in a release decision, pair it with separate action/state
evidence and run the targeted price/capability follow-ups. Preserve the original
transcripts and findings when comparing any later correction.
