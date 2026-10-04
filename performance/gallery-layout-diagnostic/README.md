# Gallery layout causal diagnostic

Question: what changes the width/position of the continuation card implicated in
the warm desktop hub's CLS in run 36664660689?

This remote CI diagnostic pins application source 27825f70 and reuses the immutable
gallery-final snapshot. It never targets production. The server has a read-only
connection to the disposable PostgreSQL service. Both drivers reject non-CI work.

Desktop 1350×940 / DPR1 / CPU4. Two separate persistent Chrome profiles use real
visitor motion preferences: normal and reduced motion. One seed is excluded, then
six warm visits per profile alternate cohort order. There is no injected product
code, consent click, scroll or hover. The reduced-motion cohort uses the existing
product's own preference support; it is not a release benchmark.

Evidence includes resize observations, card geometry/computed flex styles, attribute
and child mutations, video events, font completion, LayoutShift source rectangles,
network cache flags, console errors and final screenshots. Instrumentation has
overhead: timing and scores must not be compared as Lighthouse acceptance results.
If the movement does not reproduce, the causal question remains unresolved.

The dedicated workflow's path trigger avoids repeating the 96-visit final matrix.
Local verification is limited to parsing, fixture hashes and process guard tests.

Run 36671633994 retained event observers but an early null HTML element interrupted
the periodic sampler. It is partial diagnostic evidence, not acceptance. The startup
contract test reproduces that error and the sampler now tolerates pre-parser startup.
