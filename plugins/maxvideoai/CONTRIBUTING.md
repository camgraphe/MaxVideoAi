# Contributing to the MaxVideoAI plugin package

Thanks for helping make the public package easier to install, understand, verify, and recover safely. Small, reviewable contributions are easier to validate and ship with confidence.

```text
One pull request → one clear outcome → focused verification
```

## What belongs in this repository area?

Useful contributions include:

- documentation and outcome-led examples;
- sanitized compatibility reports;
- skill instructions and package metadata;
- deterministic release packaging and checksum validation;
- focused tests for those public contracts.

Product and application code contributions belong in the [MaxVideoAI product repository](https://github.com/camgraphe/MaxVideoAi). Keep a plugin-package change separate from unrelated application work.

## What makes a contribution reviewable?

Describe the customer outcome, keep the scope small and reviewable, and explain any compatibility or paid-action claim that changes. Update the relevant guide or example when behavior changes.

**Example**: A compatibility clarification should update its guide, add focused contract coverage, and avoid changing release packaging in the same pull request.

## What must stay private?

Never commit credentials, authorization material, cookies, private media, customer prompts, internal job identifiers, private URLs, account data, or billing details. Use synthetic or fully sanitized examples.

Screenshots are acceptable only when current, sanitized, permissioned, and registered in the asset manifest with their evidence and provenance boundaries. Do not relabel a MaxVideoAI product screenshot as native Claude, Codex, or ChatGPT proof.

## What should I verify?

Run the focused tests for the files you changed, then the content and asset checks that apply. Keep commands and results in the pull-request description.

```sh
node scripts/check-github-content.mjs path/to/changed-file.md
pnpm github:assets:release-check
npm run lint:exposure
git diff --check
```

For package or skill changes, also run the repository plugin contracts and deterministic release build checks documented in the project.

## How are contributions licensed?

The package is distributed under the [Business Source License 1.1](LICENSE). By submitting a contribution, you agree that it may be included and distributed under the repository's BUSL-1.1 terms. Make sure you have the right to contribute every file and asset you submit, and preserve required notices on modified licensed files.

## How should I open the pull request?

Use the pull-request template. Explain the outcome, scope, tests, compatibility claims, paid-action safety, visual provenance, privacy review, and documentation links. The [Code of Conduct](CODE_OF_CONDUCT.md) applies to all participation.

Last reviewed: 2026-08-28.
