# Multi-shot project budget planning

Load this reference for a multi-shot video, a cost comparison, or a production
allowance for creative iteration.

The host designs each proposal; `calculate_project_budget` validates and
estimates it. Give every proposal a useful name tied to the user's goal and
describe each line by its real purpose, such as a hero opening, a dialogue shot,
or product cutaways. Respect a model the user already chose.

When model choice is open, make the best executable fit the creative baseline.
Compare it with genuinely different model families rather than several sibling
variants. Only call a proposal cheaper or lower-cost after live budget results
exist for the same intended output and creative-attempt assumptions.

Use whole, concrete quantities. Each line needs the selected public model and
mode, output duration per clip, clip count, settings that matter, declared
reference use, and attempts per clip. One attempt is the base production pass.
Additional attempts are an intentional creative allowance, not an automatic
retry or a promise that every variation will be used.

Use the selected mode details literally. Include a supported aspect ratio when
the returned list is non-empty and omit it when the list is empty. Send an audio
choice only for an optional audio policy. Derive reference kinds, roles, counts,
and duration limits from that exact mode; never copy limits between modes.

Present base production and creative-attempt allowance separately. The returned
`pricingScope` belongs to the connected environment, so do not compare a staging
estimate to a production UI price as though they shared a live pricing catalog.

An estimate is neither a reservation nor a generation. A selected request must
receive a fresh exact quote in the generation workflow before any approval.
