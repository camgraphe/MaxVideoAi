# Signup and top-up entry continuity implementation plan

1. Add failing pure and source contracts for auth-entry URLs.
2. Add shared `buildLoginHref` and `buildAuthReturnTarget` helpers.
3. Update marketing and workspace headers so labels map to the correct auth mode.
4. Pass the current workspace path and query to desktop and mobile auth links.
5. Update fixed feature gates and modals to use explicit modes and return targets.
6. Run focused auth, billing, workspace, and modal contracts.
7. Verify public login, workspace engine continuity, and Billing amount continuity in the in-app browser.
8. Run the full build and verification set, then commit and push the dedicated branch.
