# Header hydration reproduction — 2026-11-12

The candidate and the previous main snapshot reproduce the same hydration warning in the unchanged connected Header. No retained application or test source modification was made during this triage.

## Real browser reproduction

From the isolated worktree, Node 22 and the installed frozen dependencies:

```
STUDIO_PROOF_DIRECTORY=/private/tmp/assistant-conversation-hydration-triage pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/connected-studio-conversation-browser-integration.test.ts
```

- Candidate c9c0249a4: FAIL, 0/1, 77.6 seconds; /private/tmp/assistant-conversation-hydration-triage.log.
- Main 371ee9e: FAIL, 0/1, 77.3 seconds (77.9 seconds total); /private/tmp/assistant-conversation-hydration-baseline.log. The identical current fixture called startStudioIntegrationRuntime with revision 371ee9e; that helper Git-archives the committed frontend into a unique disposable directory. No shared checkout or baseline worktree was modified. Temporary test copy was removed afterward.
- Both warnings occur at the first document reload, phase restore session selection. AppSiteMenuButton's aria-labelledby/h2 id is server _R_2linebn5ritqitpeuiitulb_ versus client _R_linebn5ritqitpeuiitulb_. AppMcpShortcuts also changes from server _R_clinebn5ritqitpeuiitulb_ to client _R_35inebn5ritqitpeuiitulb_. The issue is a shared parent-path discrepancy, not just one dialog attribute.
- Both runs have no pageerror. The existing browser fixture captures hydration console errors before initial navigation and asserts that they remain empty. Its assertions, accessible clicks and dev overlay were not suppressed or bypassed.
- git diff 371ee9e HEAD is empty for HeaderBar.tsx, AppSiteMenu.client.tsx, AppMcpShortcuts.client.tsx and the Studio conversation page.tsx.

## Narrower observations

The actual HeaderBar, its account hook, AppSiteMenu and AppMcpShortcuts were SSR-rendered/hydrated using the Next-vendored React renderer in JSDOM, including a deep parent path. IDs match without hydration errors. Only Next navigation/image/link and NextIntl boundary scaffolding was replaced. This probe is evidence against an unconditional initial-render divergence; it is not an end-to-end regression test.

Adding temporary component-ID logs to the exported snapshot made the browser reduction pass (see /private/tmp/assistant-conversation-hydration-trace.log). Server and client both calculated wallet _R_1inebn5ritqitpeuiitulb_, dialog _R_2linebn5ritqitpeuiitulb_, shortcuts _R_clinebn5ritqitpeuiitulb_. This timing sensitivity prevents interpreting that instrumented pass as a fix.

A CDP logpoint, with unchanged application sources, saw HeaderBar's first hydration call useId counter 1 and consistent child positions. The diagnostic script subsequently failed on its own duplicate breakpoint registration after reload; that result is not counted as an application failure or a passing reproduction. Log: /private/tmp/assistant-conversation-hydration-cdp.log.

## Unresolved cause

The baseline reproduction establishes that this warning predates the candidate. It does not identify the exact application trigger or prove an upstream dependency cause. No speculative dependency or layout change was included.

## Preserved boundary

No Header/AppSiteMenu change, ID hardcoding, warning suppression, forced browser click, dependency update or production action. No additional exploratory browser series planned. All temporary fixture/helper copies in the worktree were removed. The canonical browser result remains 328/329 with a separately reproduced baseline failure, rather than an artificial green.
