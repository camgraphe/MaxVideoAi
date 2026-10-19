# Data transparency correction — 19 October 2026

This candidate updates factual public information in EN/FR/ES. It does not change
generation routing, storage permissions, retention settings, the generated-media
licence, or the publication approval workflow. It does not execute erasure.

## Verified basis

- Base: `66c83120ab8e86c5ef2b02493853aa843eab14b1` from current `origin/main`.
- Vercel production configuration read on 19 October: SMTP host
  `smtp-relay.brevo.com`, S3 region `us-east-1`, Studio assistance enabled with
  policy `studio-credits-2026-10-05-v2`. Auth SMTP was separately verified as Brevo
  on 15 October in the private company records. No credentials are in this report.
- S3 read-only lifecycle/versioning check on 19 October, bucket matched against
  production configuration: `NoSuchLifecycleConfiguration` (404), versioning not
  enabled. This establishes no bucket lifecycle rule, not the absence of every
  application cleanup or separate backup.
- `video-providers/router.ts` and the image/audio adapters select conditional
  inference services. The public table describes those conditions, not all
  providers receiving every request. Existing Fal research remains paused.
- `studio/conversation-director.ts` and `studio/media-analysis/provider.ts` use
  OpenAI with `store:false`. This is not Zero Data Retention: supplier abuse logs,
  caches and exceptions have separate rules. See the official API data-controls
  documentation; no account-specific ZDR approval has been established here.
- New generation paths set `visibility=private,indexable=false`. Admin visibility
  and moderation routes can publish/remove listings. These flags and gallery
  removal do not by themselves erase S3 objects, supplier copies or third-party
  downloads. The existing licence already covers marketing selection; this patch
  grants no additional right and does not invent per-media customer consent.

## Account deletion HTTP correction

`POST /api/account/delete` previously returned `hardDeleteScheduledAt` computed as
now + 30 days even though it only updated a profile. No consumer of that response
field was found in the repository. The response now reports `status=requested`,
`deletionCompleted=false` and the persisted `markedAt`. Repeated requests retain
the original timestamp; missing profiles return 404 rather than false success.
Marketing opt-out, authentication and database availability guards are preserved.
There is still no general account-erasure worker. Do not describe this correction
as completion of a deletion request or GDPR-compliance certification.

## Delivery and legal versioning

1. Review the exact changed text and merge through the normal PR/Quality CI path,
   including the financial and integration lanes selected for the final candidate.
2. The factual information revision is 19 October 2026. Accepted legal versions
   and re-consent configuration are unchanged in this candidate. The generated
   media licence and withdrawal rights are unchanged. Do not silently relabel
   historical acceptances with this information-revision date.
3. If a new legal document version is chosen for this publication, update the
   fallback version and shared signup contract together, deploy the matching body,
   then update Admin → Legal documents. Follow `docs/deployment/legal-document-rollout.md`;
   never update the production registry before the matching body is live and do
   not introduce hard re-consent as part of this factual correction.
4. Verify all nine public routes (terms/privacy/subprocessors × EN/FR/ES), canonical
   and hreflang, mailto hydration, the rights anchor, and mobile table readability.
5. Exercise the deletion handler only with isolated test accounts/data. No live
   account request, provider call, paid generation or deletion was used for this
   preparation.

## Remaining operational work (not completed by copy changes)

| Owner/scope | Concrete follow-up | Closure evidence |
| --- | --- | --- |
| Account erasure | Implement or document the operator process from `profiles.marked_for_deletion_at` across Auth, application data, Studio, media and processors, with legal exceptions. | One isolated end-to-end request; dated completion record and remaining exceptions. |
| Retention | Set and implement durations for quotes/prompts, Studio history, media, technical logs and backups; preserve admitted work, shared owners and accounting records. | Per-category policy mapped to real cleanup/backup settings, dry-run and successful bounded tests. |
| Providers/transfers | Match the active account entities, processing countries and applicable contractual safeguards to existing agreements. Confirm Auth SMTP freshness before publication. | Account-specific evidence, not a default endpoint or a generic vendor marketing page. |
| Public media withdrawal | Verify removal from galleries, model/home selections and search surfaces; handle storage/caches/provider copies separately for an erasure request. | Isolated fixture proving public surfaces no longer expose the removed media, followed by a separate storage-erasure receipt where requested. |

The legacy privacy section on international-transfer safeguards remains unchanged
and still needs account-specific substantiation. New text does not certify it.
The public retention explanation removes unsupported short-window/backup claims;
it does not establish missing numeric retention limits. These remain open EAT-003
items, not release evidence supplied by this patch.

## Sources

- [CNIL — retention](https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees), consulted 19 October 2026.
- [CNIL — concise information](https://www.cnil.fr/fr/passer-laction/rgpd-exemples-de-mentions-dinformation), consulted 19 October 2026.
- [Service Public — accounting retention](https://entreprendre.service-public.gouv.fr/vosdroits/F10029), consulted 19 October 2026: accounting documents retained 10 years from financial-year close; this is not a universal media-retention period.
- [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data), consulted 19 October 2026.

Sanitized evidence and exact-text review are kept in OUTREACH:
`sources/2026-10-19/eeat-data-transparency/`.
