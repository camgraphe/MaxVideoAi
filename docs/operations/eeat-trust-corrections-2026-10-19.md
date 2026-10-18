# Public trust corrections — 19 October 2026

The contact and blog pages linked mailboxes on `maxvideo.ai`, a domain the operator confirms is unrelated to MaxVideoAI. They now use the operator-confirmed `admin@maxvideoai.com`. Localized contact copy describes administrator-published service notices and no longer promises unsupported response deadlines or a latency dashboard.

The legal identity correction uses the operator's existing administrative records and the official French enterprise register checked on 19 October: Adrien Millot, sole proprietor trading as MaxVideoAI, SIREN 753 467 414. The VAT number is taken from the existing confirmed fiscal records, not calculated. The public address is unchanged. The terms/privacy correction concerns operator identity only; rights, retention and legal registry/reconsent versions are unchanged. Security-document enquiries no longer promise SOC documentation without established availability.

The historical Sora/Veo/Pika comparison is revised in EN/FR/ES. Existing URLs and original publication dates are preserved. Unreproducible price estimates, obsolete Sora generation instructions and unsupported claims are removed. Its real revision date is 19 October 2026. The previously rewritten Sora access article receives its established 21 September 2026 revision date in front matter so the visible byline, Article schema and social metadata agree. About links to two existing productions, identified as English-language sources in FR/ES.

## Brand presentation and legal disclosure

The operator requested that MaxVideoAI lead the public presentation, with personal identification limited to legal disclosures. About, the shared editorial profile, blog bylines, Benchmark Lab, editorial standards and the podcast case study now use the brand. Article, TechArticle and benchmark authors are typed as Organization rather than Person, matching the visible attribution. No staffing, scale, credentials or customer claims are added. The historical About fragment remains a compatibility anchor; new links use `#maxvideoai`.

The full verified identity and address remain legible in Legal Notice. Terms and Privacy keep a short operator/controller identification and a direct localized Legal Notice link; repeated SIREN/location information is removed from those headers. The Terms header no longer repeats French law/Paris courts. The existing substantive law/jurisdiction section, legal versions and acceptance records are unchanged. This is a presentation correction, not a full legal compliance certification. The podcast retains its original publication date and gains the actual 19 October revision date.

## Public latency contract v1.1

`benchmark-lab-metrics.ts` reads the existing `generation_timing_samples` table; it does not create or backfill data. Required migration 45 captures one immutable timestamp when a video becomes completed with an output URL. Migration 46 preserves that application-delivery timestamp when adding provider-only duration data.

The public interval is `completed_at - started_at` for `source=job_completion` only. Provider execution durations and historical provider/log completion records measure different intervals and are excluded. Only finite, positive intervals completed within the last 30 days qualify. Current jobs must still be successful video jobs with an output and a non-admin owner. Both the 30-sample and five-distinct-user thresholds apply after these filters. Cohort counts and identifiers remain private under the existing public-data contract.

The measure includes queues and delayed first detection by the application. It is neither provider-only execution time nor a controlled comparison at equal settings. It covers successful measured deliveries, not failures or the probability of success. If the table is unavailable or a cohort is insufficient, no latency is fabricated. A deployment to an environment without migration 45 therefore degrades to unavailable metrics rather than running schema changes on a read path.

Editorial numeric scores are unchanged. Their record-update dates are not described as test dates. Public comparisons state MaxVideoAI's commercial relationship. Benchmark score rows preserve historical models and identify those whose application-generation surface is disabled.

## Verification and release

The PostgreSQL regression reproduces a two-minute delivery incorrectly reported as 23 hours by the previous mutable timestamp query, then verifies that later media repairs do not change the result. It also covers missing/historical evidence, distinct-user and admin thresholds, and the rolling window. The strengthened public-contact contract covers every locale and the blog fallback.

A read-only check of the configured product database confirms that the timing table exists and the candidate returns qualified cohorts. No migration, job, media, billing, consent or provider setting was mutated.

Use the normal GitHub PR, Quality CI and Vercel Git release process. After delivery, check Contact, Blog, About, legal pages, revised articles, Benchmark Lab and a comparison in EN/FR/ES, including canonical URLs, language links and Article dates. A local patch or read-only query is not a production release. Remaining processor/retention/marketing-consent alignment is a separate factual review; no general legal-compliance claim is made here.
