# Milo release review — 29 October 2026

Continuation of draft PR #555 after the local qualification recorded in
[the public-offer report](public-offer-refresh-2026-10-29.md). No merge,
production migration, feature activation or media generation was performed.

## Required CI finding

Quality CI run `40940086207`, at `c664e3d1b`, failed seven browser checks in
the fast lane because that job intentionally has no installed Chromium. Both
browser partitions, database/media integration and exhaustive financial
cutovers succeeded. The Git Preview was READY at the same SHA.

The five affected files select Chromium/WebKit through a variable. The test
classifier recognized direct browser launches but missed their shared fixture
imports. It now recognizes the workspace-reference and image-rail browser
fixtures alongside the existing Studio fixture. The former special case for
the post-Kling test is covered by the shared rule.

- The complete test manifest is unchanged: five files move from Fast to Browser.
  Fast has 1,530 files; Browser has 65, split by the existing disjoint partitions.
- The partition regression failed before the correction. All 48 runner,
  workflow and selection checks pass afterward.
- All seven affected visual checks pass locally on Chromium and WebKit,
  including mobile geometry, reference editing, model/tier controls and audio.
- No assertion, required check, browser installation or financial validation
  was removed or weakened. No product runtime code changes in this fix.

The corrected candidate still requires its own successful Quality CI and exact
Git Preview admission check. Read their current results on PR #555; the failed
run above is preserved as diagnostic evidence, not relabelled successful.

## Cross-platform layout follow-up

The next run, `40956269348` at `b7f5984c2`, passed Fast, database/media and
Browser 2/2, but Browser 1/2 found two geometry defects now that the previously
misclassified tests actually ran on Linux:

- Wider fallback fonts could expand the rail navigation's intrinsic minimum
  width beyond its shared column. The navigation now has an explicit zero
  minimum width and narrower spacing at the smallest desktop breakpoint.
- A reference's remove target shared a negative 4 px gutter with its neighbour;
  when it landed at the end of a full row, that target extended outside the
  form. A trailing 4 px inset now reserves its full clickable area.

Both failures were reproduced before the correction, including the reference
edge at 379 px on macOS and the rail alignment on Linux. The existing tests now
also cover wider font metrics, each navigation control's containment and the
379 px reference boundary. No assertion or tolerance was weakened, no target
was made smaller and no overflow was hidden. The two strengthened tests pass
on local Chromium and WebKit. A separate focused review found no remaining
Critical, Important or Minor issue. The PR records subsequent Linux and CI
results against their actual revisions; the earlier failed run remains failed.

All seven previously misclassified checks also pass with Chromium and WebKit
running in an isolated Playwright 1.59.1 Ubuntu Noble container. The rail failure
was first reproduced there against the old stylesheet. This is Linux ARM64
qualification, not a claim that the GitHub AMD64 runner has already passed.

## Release boundaries

Independent review confirmed the CI correction and found two Important
ambiguities in the launch instructions, now corrected: approval of customer
information/retention must precede composer activation as well as expanded Studio
capture; stopping new assistance must leave the composer endpoint and workers
available until accepted work is recovered/settled. The Studio capture flag does
not gate composer input/history storage. No Critical or deferred Minor findings.
The review was limited to this CI increment and release instructions, not a new
review of all 364 changed files or a general model-quality certification.

Current main was fetched and remains `fd6f9cbe9`, already included in this
branch. Repeat the documented alignment check immediately before any merge.
Manual local browser control remains disabled in Work settings; automated
browser coverage does not establish a fresh manual visual sign-off.

Follow [the rollout procedure](milo-launch-delivery-2026-10-29.md) for target
schema history, pending migrations 85–90, provider access, feature flags,
workers, credit recovery and the customer-information/retention decision.
The public promise must ship together with functional assistance. This review
does not authorize production capture or choose a retention policy.
