# Homepage conversion performance implementation plan

1. Add a focused contract for the default homepage client-message scope.
2. Add a pure namespace picker that preserves the full dictionary when no scope is provided.
3. Thread an optional namespace scope through the manually composed default marketing and locale layouts.
4. Select only `nav` and `footer` from the root homepage.
5. Run the focused contract and homepage/SEO architecture tests.
6. Produce a clean production build and compare `/` HTML transfer size against the baseline.
7. Verify `/` and `/fr` in the in-app browser, including CTA, navigation, language control, canonical, hreflang, and JSON-LD.
8. Run the full verification set, then commit and push the dedicated branch.
