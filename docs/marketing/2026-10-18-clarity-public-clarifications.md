# Public purchase and creation clarifications — 18 October 2026

## Scope

Three bounded changes from the owner-provided Clarity brief: correct n8n
publication copy, explain distinct credit balances before purchase, and add an
existing product-video case to the ads guide. No billing rule, tariff, generation
workflow, model ranking or public URL is changed. No paid generation, template
submission or suspended campaign was started.

The Clarity panel is directional GPT5.3/WebIQ evidence (3 cited questions, 56
without a citation, 1 error out of 60). It measures neither actual demand nor
adoption and supports no guarantee of citations or revenue. The source
`OUTREACH/sources/2026-10-18/clarity-panel-review/` contains `AMELIORATIONS.md`,
`README.md` and `public-provenance.json`. Prior PAYG delivery is recorded in
`OUTREACH/sources/2026-10-11/payg-delivery-final/LIVRAISON.md` (PR #423).

## n8n

- `/mcp` and `/integrations/n8n` FAQs now describe the approved public template
  19591 in EN/FR/ES, keeping manual OAuth, self-hosted 2.38.7 MCP Client,
  a fresh exact quote, human approval of that quote, then confirmation.
- The canonical n8n page returned HTTP 200 on October 18. The October 12
  approval/parity evidence is `OUTREACH/sources/2026-10-12/n8n-approval/CONTROLE.txt`
  and its `json-parity.json`: the public 21-node object matches the corrected
  October 11 submission semantically. Byte-level upload identity is not claimed.
- `mcp-integrations.json` changes only the store state from `submitted` to
  `listed`. Host statuses and September 14 checkpoint dates are unchanged.
  The distribution evidence log and registry guide now distinguish these dates.
- Availability is not a new compatibility test. n8n Cloud and AI Agent invocation
  remain unvalidated. `/docs/mcp` already described availability correctly.

## Credit facts and remaining policy decision

The new server-rendered notes sit beside the minimum-top-up/budget explanation
on PAYG and the credit-purchase cards on Pricing. Each route retains its own
complete EN/FR/ES copy. `CreditPurchaseNotes` is presentation only and provides
explicit localized terms links, the existing English refund procedure (labelled
as English in FR/ES), contact and Studio links. Terms gain a stable wallet anchor
and an explanation of the existing refund distinction; the return policy gains
the same clarification and a review-procedure anchor. Contract versions and
commercial rules are unchanged.

| Category | Evidence and implemented explanation | Unresolved decision |
| --- | --- | --- |
| Purchased media wallet | `frontend/src/server/wallet-summary.ts` sums funded receipts without age/inactivity filtering; `frontend/src/lib/wallet.ts` retains the same ledger. Unused balance persists between projects without a subscription. | The existing Billing FAQ and messages say credits do not expire while the account is active, but neither Terms nor the return policy defines “active”, an expiry period or an inactivity deadline. No authoritative durable commercial definition was found. The public note states that omission and offers support before purchase; it does not promise perpetual validity. The product owner must define retention/expiry and what inactivity or account closure does before a stronger claim is published. |
| Promotional/bonus/free media credits | The return policy excludes cash value and refunds. No universal promotional validity duration was found. | Define validity per offer (and precedence where multiple grants coexist); do not apply the purchased-media or Sol rules by inference. The note directs readers to the offer and support when unspecified. |
| Included Studio assistance | `studio-assistance-economics.md`, `assistance-contract.ts`, `assistance-credit-ledger.ts`, migration 63: GPT-6.1 Sol includes 500 credits per UTC calendar month; no carryover. Older reserved grants settle to their original lot. | None for these documented rules. |
| Purchased Studio assistance | The same approved policy explicitly defines cumulative packs without expiry or automatic refill; purchases debit the media wallet once, usage consumes the lots. GPT-6 Luna has no extra assistance fee, subject to limits and availability. | No new validity decision for purchased Sol packs. This must not be generalized to other credit categories. |

A technical-failure recredit restores the wallet; it is not an automatic card or
bank refund. Completed but disappointing outputs still consume credits, and a
new attempt needs its own current quote. Payment-refund/unused-balance requests
remain subject to review under `/return-policy`, including existing consumer
rights and promotional exclusions. No refund eligibility or banking timeline
was broadened.

## Ads case and provenance

`content/{en,fr,es}/best-for/ads.mdx` adds the owned watch case inside the existing
guide. Source: [the September demo record](2026-09-05-mcp-project-demo.md).
That record contains the generated starting image's public-use approval, the
model choice, exact quote approval, the accepted job and the owner's acceptance
after playback. The guide publishes neither private library assets nor account
identifiers.

- Public reference: `/media/mcp/project-demo/watch-static.webp`.
- Exact original result: `https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/0df5ede1-5a37-4b32-b4bf-2a8c67b69448.mp4`.
- Wan 3 Prime, same reference in first/last-frame roles, 16:9, six seconds,
  1080p, audio off. Direction is labelled as a requested motion, not an assertion
  that the output perfectly obeyed it.
- Approved historical media quote: USD 2.08. Earlier completed FLUX.3 attempt:
  USD 2.16, rejected for motion quality. Total: USD 4.24. These are not current
  quotes, a comparison benchmark or assistance charges.
- The local published derivative probes as H.264, 1920×1080, 30 fps, exactly
  six seconds and no audio stream. The exact original was also probed and played
  through the guide link: it is **1918×1080**, six seconds, 30 fps, with no audio
  stream. The guide distinguishes the requested 16:9/1080p settings from those
  original dimensions, rather than borrowing the display derivative’s width.
  Six sampled display frames retain the recognisable
  strap/case and show the coloured light sweep. Fine dial details still require
  inspection. The source has no brand logo, so it cannot prove logo fidelity.
- Reference and both original/derived public videos responded HTTP 206 to a
  bounded Range request. The original returned `video/mp4` and a total length of
  10,902,083 bytes; the existing local display copy is 4,221,289 bytes.
- Localized Studio links explain the existing Open Studio → sign-in → product-ad
  conversation path. The current marketing entry uses `starter=product-ad`.
  Readers attach their own authorized image, review current reference support,
  approve a fresh exact quote and download an individual clip. No assembled
  timeline-film export is promised.

The guide adds ordinary links, not another video reader or download. Existing
media bytes, posters, loading policy, rankings, canonical URLs and schema owners
are preserved. No loading-performance improvement is claimed.

## Verification

Review: [PR #458](https://github.com/camgraphe/MaxVideoAi/pull/458). This is a
review candidate; it has not been merged or deployed to production. The media
expiry/inactivity and unspecified promotional-validity decisions above remain
with the product owner.

Evidence logs and screenshots are retained under
`.reports/clarity-public-clarifications/` in the isolated
`clarity-public-clarifications` worktree.

- Complete `pnpm test:validate` rerun passed: 8,785 standard tests plus six
  isolated Studio integration scenarios, four standard skips and zero failures.
  Both exhaustive financial cutovers passed on the stable application commit.
- 200 focused contract tests passed. The corrected n8n/return-policy contracts
  passed all 14 tests; the final model-choice explanation passed all 13 ads-guide
  tests.
- Frontend TypeScript, exposure, i18n parity, SEO/internal links/public-media
  guard and diff checks passed. Frontend lint passed with six existing warnings.
  The architecture audit was run; no global size-cleanliness claim is made.
- The local production build passed, including prebuild gates and 932 generated
  pages. Vercel also built application commit `e0977e23d` successfully.
- All 19 touched public routes responded HTTP 200 on that protected Git preview:
  MCP, n8n, PAYG, Pricing, Terms and the ads guide in EN/FR/ES, plus the existing
  English return policy. The 77 JSON-LD blocks parsed, canonical/hreflang paths
  and main-region counts matched the live baseline, and browser checks found no
  horizontal overflow or JavaScript page errors. Preview-origin URLs were
  normalized only for comparison, consistent with `resolveSiteOrigin()`.
- Desktop EN and mobile FR/ES screenshots were inspected. The five translated
  routes that looped under the standalone local server passed on Vercel.
  All 15 marketing paths were present in the generated localized sitemaps.
- Reference and original-result links were checked over HTTP; the original
  video also played through its guide link. Existing Studio pages and their
  product-ad entry links were inspected without starting a generation.
- Independent review of the implementation and its factual corrections found
  no actionable issue.

The first complete validation attempt had 8,782 passing tests, four skips and
three failures: two stale editorial assertions, now corrected, and one
financial fixture invalidated by committing while it was running (the fixture
binds its release to Git HEAD). The complete rerun passed on a stable commit.
The final follow-up changes only the model-choice explanation and this evidence
record. The latest required Quality CI state is recorded in PR #458 and must
pass before any merge. No financial assertion or CI requirement was weakened.
