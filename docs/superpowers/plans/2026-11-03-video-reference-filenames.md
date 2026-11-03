# Video filename propagation plan

1. Confirm the API-to-picker loss on fresh main and establish focused baseline.
2. Add a failing regression using the real library hook and modal, with only local HTTP responses controlled.
3. Preserve optional trimmed names in the payload and selection adapters; keep existing fallbacks and identities.
4. Run the regression and adjacent adapter/account/selection tests, TypeScript, lint, exposure and diff checks. Save evidence under the assigned F directory, commit locally and hand over for independent review. No push or deployment.
