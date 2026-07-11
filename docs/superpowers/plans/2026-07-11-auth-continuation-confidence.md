# Auth continuation confidence implementation plan

1. Add failing contracts for continuation derivation and rendering.
2. Add localized continuation copy to the three auth dictionaries.
3. Implement a pure route-local continuation builder.
4. Derive continuation from `safeNextPath` only after the next target is ready.
5. Render the compact confirmation in `LoginAuthSurface` outside reset mode.
6. Run focused auth, i18n, billing-intent, and redirect tests.
7. Compare source and local auth screenshots at the same viewport and verify Billing/workspace cases.
8. Run the full build and verification set, then commit and push the dedicated branch.
