# Project budget planning

Use this reference when a user wants a plan for a multi-shot video, a cost
comparison, or a production allowance for creative iteration.

The host designs the proposal; `calculate_project_budget` validates and
estimates it. Give each proposal a useful name tied to the user's goal, then
describe each line by its real purpose: for example, a hero opening, a dialogue
shot, or a set of product cutaways. A proposal may use one model for continuity
or combine models where the creative rationale is clear. Respect a model the
user already chose. Use a mixed plan only when the brief or budget benefits,
and give every model a shot-specific factual rationale; do not force diversity
or dilute a quality-first plan merely to show a cheaper option.

When model choice is open, make the best executable fit the creative baseline.
Seedance 2.5 may lead a quality-first proposal only when the live recommendation
and model details support that fit; do not encode a permanent model ranking.
Compare the baseline with genuinely different model families rather than
several sibling variants. Only describe a proposal as cheaper or lower-cost
after `calculate_project_budget` has returned comparable current totals for the
same intended output and creative-attempt assumptions.

Use whole, concrete quantities. Each line needs the selected public model and
mode, output duration per clip, clip count, settings that matter to the
request, declared reference use, and attempts per clip. One attempt is the
base production pass. Additional attempts are an intentional creative
allowance, not an automatic retry or a promise that every variation will be
used.

Use the selected mode details literally. When its `aspectRatios` list is
non-empty, include one supported `aspectRatio`, including for i2v. When that
list is empty, omit `aspectRatio`. Never infer this from the mode name or copy
the setting from another mode. Omit `audio` for `always_generated` and
`unavailable`; include it only for an `optional` audio policy.

For `t2v`, `i2v`, `ref2v`, `fl2v`, `v2v`, `r2v`, or `extend`, derive reference
use and counts from the selected model’s live mode details. Preserve the user’s
first/last frame roles, private image/video/audio kinds, required source video,
ordered reference videos, and ordered extension clips in the proposal. Do not
copy limits between modes.

Present the returned base production and creative-attempt allowance separately.
Explain the assumptions and differences between named proposals so the user can
choose. Do not replace a user preference with a generic tier, and do not derive
figures yourself from remembered model information.

The returned `pricingScope` identifies the estimate as belonging to the
connected environment. Do not compare a staging estimate to a production UI
price as if they shared one live pricing catalog.

An estimate is not a reservation and does not create a generation. When the
user chooses a concrete request, return to the skill and obtain a fresh exact
quote through `prepare_generation` before asking for confirmation.
