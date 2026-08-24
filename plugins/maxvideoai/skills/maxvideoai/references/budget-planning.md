# Project budget planning

Use this reference when a user wants a plan for a multi-shot video, a cost
comparison, or a production allowance for creative iteration.

The host designs the proposal; `calculate_project_budget` validates and
estimates it. Give each proposal a useful name tied to the user's goal, then
describe each line by its real purpose: for example, a hero opening, a dialogue
shot, or a set of product cutaways. A proposal may use one model for continuity
or combine models where the creative rationale is clear.

Use whole, concrete quantities. Each line needs the selected public model and
mode, output duration per clip, clip count, settings that matter to the
request, declared reference use, and attempts per clip. One attempt is the
base production pass. Additional attempts are an intentional creative
allowance, not an automatic retry or a promise that every variation will be
used.

Present the returned base production and creative-attempt allowance separately.
Explain the assumptions and differences between named proposals so the user can
choose. Do not replace a user preference with a generic tier, and do not derive
figures yourself from remembered model information.

An estimate is not a reservation and does not create a generation. When the
user chooses a concrete request, return to the skill and obtain a fresh exact
quote through `prepare_generation` before asking for confirmation.
