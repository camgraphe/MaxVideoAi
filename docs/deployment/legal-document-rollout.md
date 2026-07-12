# Legal document rollout

## Terms 2026-07-12

1. Deploy the code containing the localized Terms body.
2. Verify `/legal/terms`, `/fr/legal/terms`, and `/es/legal/terms`, including `#generated-media-rights`.
3. In Admin → Legal documents, update Terms to version `2026-07-12`, public URL `/legal/terms`, and the actual publication timestamp.
4. Confirm Admin reports `SOFT` re-consent with a 14-day grace period. Do not change the re-consent mode to `hard` for this release.
5. With an account that accepted the previous Terms, call `/api/legal/reconsent` and confirm `needsReconsent: true`, `mode: "soft"`, and the expected grace deadline.
6. Accept the update in the re-consent prompt and confirm the Terms mismatch disappears.
7. Verify a new signup records Terms version `2026-07-12`.

The Admin version update occurs only after the new Terms body is live. Never publish the new registry version before the matching body is deployed.
