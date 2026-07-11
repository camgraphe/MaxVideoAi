# Conversion Workspace Performance Plan

1. Capture the production build baseline for `/app` and identify eager interaction-only dependencies.
2. Add a failing architecture contract for deferred Stripe and workspace-only panels.
3. Convert model-specific panels and closed modals to dynamic imports while preserving their existing gates.
4. Replace eager Stripe initialization in the shared hosted-checkout hook with an on-demand loader.
5. Run focused contracts, type checking, lint, exposure checks, and a production build.
6. Compare `/app` first-load JavaScript and smoke-test the guest composer and authentication gate.
