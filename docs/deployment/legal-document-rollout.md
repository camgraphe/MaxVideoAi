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


## Adult eligibility candidate 2026-11-11 — not deployed

The owner approved a minimum age of 18 (or higher local legal majority). The
candidate changes localized Terms/Privacy, signup, authenticated reconsent and
new OAuth approvals together. Existing `min_age:15` or `age_verified=true` is not
upgraded to an adult attestation. The age checkbox requires a new explicit act;
the normal document grace period is unchanged, but missing adult confirmation
keeps the reconsent prompt blocking. No account is deleted or provider removed.

1. Qualify only the dedicated review environment first. Validate localized pages,
   signup with/without email confirmation, account switching, failed consent
   storage and OAuth approval/refusal. No normal database is authorized here.
2. Deploy the matching body through the release procedure **only when authorized**.
   Then run `99_legal_adult_eligibility.sql` on the explicitly selected database
   (or make the equivalent Admin update), never before the body is available.
   `published_at` is the actual activation time. Re-running does not move it.
3. Confirm Terms/Privacy both resolve to `2026-11-11`, while Cookies and historical
   acceptances remain unchanged. Newer versions are never downgraded.
4. Existing users explicitly reconfirm adulthood. For email-confirmation signup,
   only an authenticated session can persist consent; the optional marketing
   draft stays browser/account scoped and editable. Clearing browser storage may
   discard that optional draft, never grant consent or opt the user in.
5. Confirm the new `min_age:18` record belongs to the authenticated user, and
   OAuth refusal does not depend on age confirmation. This is self-attestation,
   not an assertion of verified date of birth or a universal age-check system.

The candidate migration has been exercised only on disposable local PostgreSQL 17.
There has been no production registry change or application deployment.
