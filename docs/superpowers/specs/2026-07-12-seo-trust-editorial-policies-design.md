# SEO Trust And Editorial Policies Design

## Objective

Strengthen MaxVideoAI's human and editorial trust signals across About, Company, the blog, and Benchmark Lab without manufacturing a larger team, adding thin credibility pages, exposing weak usage volumes, or spreading defensive caveats across commercial surfaces.

The lot must make it easy for visitors, search engines, and answer engines to determine:

1. who builds and maintains MaxVideoAI;
2. who writes and maintains its editorial content;
3. how sources, corrections, and benchmark updates are handled;
4. which statements are provider facts, product observations, or MaxVideoAI editorial judgments;
5. what users may do commercially with generated media; and
6. where the authoritative legal and privacy terms live.

This is a supporting SEO and conversion layer, not a promise of immediate ranking growth. Its strongest direct search benefit comes from truthful author identity, Article authorship markup, coherent internal entity links, and clearer provenance on existing content with search visibility.

## Evidence

The repository audit confirmed:

- `/about` currently describes the product and its independent model-routing position but does not identify a founder, operator, author, or editorial lead.
- `/company` is already a trust hub but primarily lists links and does not summarize authorship, content rights, or editorial standards.
- the legal notice already publicly identifies Adrien Millot as publishing director and locates the operation in France;
- blog Article JSON-LD currently assigns every post to the `MaxVideo AI` organization rather than a named person;
- blog articles show publication dates but no visible author or author profile;
- Benchmark Lab already separates editorial scores, sourced specifications, and observed production latency, but it does not identify a named editorial lead;
- Benchmark Lab already publishes a versioned methodology, effective date, prompt pack, limitations, and changelog;
- the Terms state that uploaded inputs remain the user's property and that generated media remains theirs subject to the licence granted to MaxVideoAI;
- the Terms do not currently state explicitly that users may use generated media commercially;
- the legal document database controls document version metadata and re-consent state, while the visible Terms body remains code-owned;
- changing the published Terms version causes the existing re-consent system to use its configured mode, which defaults to a 14-day soft grace period.

Google's current public guidance recommends making authorship clear, linking authors to identifying pages, and using `Person` for a person in Article structured data. Google also states that E-E-A-T is not a single ranking factor or a guaranteed ranking improvement. The design therefore uses only truthful identity and provenance signals and does not create decorative author or policy pages solely for search engines.

## Confirmed Public Identity

The approved public identity is:

- **Name:** Adrien Millot
- **Role:** Founder & Product Lead
- **Location:** France
- **Editorial responsibility:** primary blog author and editorial lead for MaxVideoAI benchmarks

The implementation must not imply:

- a larger editorial team than exists;
- an independent external reviewer;
- third-party laboratory certification;
- a separate legal entity or registration status beyond the current legal notice;
- credentials, awards, testing volumes, or professional affiliations that have not been verified.

## Chosen Approach

Build one compact, coherent trust layer:

1. redesign About as the human source of truth for MaxVideoAI and Adrien Millot;
2. publish one substantive Editorial Standards page covering authorship, sourcing, corrections, and benchmark updates;
3. add a visible named byline and a reusable author card to blog articles;
4. add a named editorial lead and methodology context to Benchmark Lab;
5. strengthen Company as the navigational trust hub, including a concise content-rights and data summary;
6. align the Terms with the approved commercial-use statement and publish a new Terms version through the existing re-consent workflow.

This is preferred over a minimal byline-only change because the author needs a credible identifying destination and the benchmarks need a durable provenance policy. It is preferred over a full newsroom structure because a separate profile route, three policy routes, and multiple reviewer roles would overstate the current organization and dilute the useful content.

## Scope

This lot includes:

- a redesigned localized About page;
- a central reusable editorial profile for Adrien Millot;
- one new localized Editorial Standards route;
- visible blog authorship and updated Article JSON-LD;
- an author card on blog articles;
- a compact Benchmark Lab editorial-ownership block;
- an updated Company trust hub with a content-rights and data summary;
- one explicit commercial-use clarification in the Terms in English, French, and Spanish;
- a new Terms version and an operational handoff for updating that version in Admin after deployment;
- localized metadata, canonical URLs, hreflang, sitemap, internal links, and structured-data coverage;
- focused architecture, localization, legal consistency, route, sitemap, and schema tests.

## Out Of Scope

- Case studies, testimonials, customer logos, or customer names.
- Publishing generation counts, benchmark run counts, customer counts, or other small-volume statistics.
- A separate author profile route.
- Separate Editorial Policy, Corrections Policy, and Benchmark Update Policy routes.
- Inventing a team, reviewer, advisory board, laboratory, certification, or external validation.
- Adding portraits or generated founder imagery. A real portrait can be added later if supplied and approved.
- Rewriting historical blog content or adding author front matter to every existing MDX file.
- Recalculating benchmark scores or presenting historical editorial scores as documented prompt-pack runs.
- Changing benchmark latency thresholds, metrics, data exposure, score formulas, pricing, wallet behavior, or refund automation.
- Revising the existing broad licence granted to MaxVideoAI for hosting, service operation, safety, model improvement, galleries, or marketing placements. That language needs a separate legal-policy review if it is to change.
- Claiming that MaxVideoAI never trains on, never stores, or never displays user content unless the authoritative Terms, Privacy Policy, product behavior, and provider contracts are first aligned.
- Adding repeated disclaimers to model, comparison, pricing, workspace, or generation pages.

## Editorial Profile Source

Create one server-safe editorial profile source keyed by `adrien-millot`. It contains:

- stable id;
- public name;
- role;
- country or location label;
- localized short bio;
- localized About anchor URL;
- optional future external identity URLs only when verified.

Current blog articles resolve to `adrien-millot` by default. The content contract may support an optional author id for future contributors, but the implementation must not require a mechanical front-matter edit across every current article.

The profile is the source for:

- visible blog bylines;
- the blog author card;
- Article JSON-LD author data;
- About identity content;
- Benchmark Lab editorial ownership;
- Editorial Standards authorship language.

The role must not be concatenated into `author.name` in structured data. It belongs in `jobTitle`.

## About Page

### Purpose

About becomes the canonical human explanation of who builds MaxVideoAI, why it exists, and how editorial work relates to the product.

### Page structure

The localized page contains:

1. a mission-led hero focused on making AI video models easier to compare, price, and use;
2. a restrained identity card with `Adrien Millot`, `Founder & Product Lead`, and `France`;
3. `What we build`, explaining the model-routing, price-before-generation, workspace, and comparison product without unsupported operational claims;
4. `Why model independence matters`, explaining model-agnostic comparison while acknowledging that MaxVideoAI sells access to the models it covers;
5. `How we evaluate models`, linking to Benchmark Lab and Editorial Standards;
6. a company-facts and contact area linking to the legal notice, Company, and legal center.

The section identifying Adrien uses the stable fragment `#adrien-millot`, which is also the author URL used by Article structured data.

### Tone and visual direction

- calm, premium, direct, and human;
- no oversized compliance warnings;
- no generated founder portrait;
- no startup clichés, fake origin story, or vague collective `we` where a named responsibility is more accurate;
- no repetition of every limitation already covered by the Terms or benchmark methodology.

## Editorial Standards Page

### Route

The internal pathname is `/editorial-standards`, with the approved public paths:

- English: `/editorial-standards`
- French: `/fr/normes-editoriales`
- Spanish: `/es/estandares-editoriales`

The English route has the same default-locale wrapper pattern as other public marketing routes. The page is indexable, self-canonical, reciprocal across all three locales, and included once in the localized sitemap graph.

### Page structure

The page contains:

1. **Authorship and accountability** — Adrien Millot is the primary author and editorial lead; contributor identity will be shown when that changes.
2. **Source hierarchy** — sources are labeled and prioritized as provider documentation, MaxVideoAI product configuration, observed anonymized production metrics, and MaxVideoAI editorial judgment.
3. **Editorial process** — content should be checked against current product behavior, source links, dates, and supported routes before publication or material updates.
4. **Corrections** — factual corrections can be sent to the approved support or editorial contact; material corrections update visible content and `dateModified` rather than silently backdating publication.
5. **Benchmark updates** — score definitions, formula, prompt pack, observed latency, source changes, and changelog responsibilities point to the versioned Benchmark Lab methodology.
6. **Commercial-interest disclosure** — MaxVideoAI sells access to the models it compares. This does not get framed as independence from the commercial relationship; the value is transparent separation between sourced facts, observed metrics, and editorial judgments.

The route publishes a localized `WebPage` and `BreadcrumbList`. It does not publish `Dataset`, `ClaimReview`, certification, or review-rich-result markup.

## Blog Authorship

### Visible byline

Every current localized article displays:

- author name;
- `Founder & Product Lead` role;
- publication date;
- modified date when `updatedAt` is present and differs meaningfully from the publication date;
- a link to `/about#adrien-millot`;
- a link to Editorial Standards in the author card or nearby editorial context.

The hero byline stays compact. A short author card after the article body adds the localized bio and trust links without interrupting the article introduction.

### Structured data

Article JSON-LD changes from:

- `author: Organization("MaxVideo AI")`

to a `Person` containing:

- `name: "Adrien Millot"`;
- `jobTitle: "Founder & Product Lead"`;
- a locale-correct absolute `url` targeting the About identity fragment.

The publisher remains the MaxVideoAI organization. Visible authorship and structured authorship must match. Existing headline, image, publication date, modification date, canonical, language, publisher, and main-entity behavior remain intact.

## Benchmark Lab Ownership

Benchmark Lab gains a compact ownership row or card near the hero or methodology navigation containing:

- `Editorial lead: Adrien Millot` or locale-equivalent copy;
- the current methodology version;
- the methodology effective date;
- links to the About identity fragment and Editorial Standards.

The page must not say `independently reviewed`, `scientifically validated`, or `certified`. It must not invent a second reviewer.

The existing distinctions remain unchanged:

- editorial scores are MaxVideoAI judgments;
- specifications are sourced facts;
- rolling latency is observed anonymized production performance;
- current editorial scores are not relabeled as documented prompt-pack runs;
- no low sample sizes or generation volumes are exposed merely to appear authoritative.

The Benchmark `WebPage` schema may identify Adrien as author or editorial owner only when the property accurately matches the visible page. The publisher remains MaxVideoAI.

## Company And Trust Hub

Company remains the central navigational index and gains stronger grouping rather than becoming a long policy document.

Its localized content includes:

- About and founder identity;
- Editorial Standards;
- Benchmark Lab and methodology;
- content rights and data;
- support and status;
- legal center and privacy resources.

### Content rights and data block

The block uses short positive statements linked to the authoritative documents:

- uploaded prompts and assets remain the user's property under the Terms;
- generated media remains the user's subject to the Terms;
- users may use generated media commercially under the approved rule below;
- new renders are private by default under the current Terms;
- applicable provider processing and sub-processors are explained in Privacy and the sub-processor notice.

The block must not simplify the Terms into an unconditional ownership warranty or guarantee that every provider/model has identical downstream rights.

## Commercial-Use Rule And Terms Version

The user-approved French rule is:

> Les utilisateurs peuvent utiliser commercialement leurs générations, sous réserve des droits de tiers, des lois applicables et des éventuelles restrictions propres au modèle ou fournisseur utilisé.

The English and Spanish versions must preserve the same meaning in American English and Latin American Spanish. Proposed copy for implementation review:

- **English:** Users may use their generations commercially, subject to third-party rights, applicable laws, and any restrictions specific to the model or provider used.
- **Spanish:** Los usuarios pueden usar comercialmente sus generaciones, siempre que respeten los derechos de terceros, las leyes aplicables y cualquier restricción específica del modelo o proveedor utilizado.

The sentence is added to the generated-media section of the English, French, and Spanish Terms. The same substantive rule appears in the Company summary, with a link to the relevant Terms section.

The Terms section receives a stable fragment id so trust surfaces can link directly to it.

### Versioning and re-consent

The Terms fallback version is updated to the approved release date used by the implementation. The production `legal_documents` Terms row must be updated through the existing Admin legal-document workflow after the new code is deployed.

That Admin version update intentionally activates the existing re-consent behavior:

- default mode: soft;
- default grace period: 14 days;
- a hard mode is not introduced by this lot;
- the lot does not bypass or silently mutate existing user consent records.

Deployment notes must state the required order: deploy body, verify public Terms, update the Terms document version and published date in Admin, then verify the re-consent status endpoint and prompt.

This design is content and product architecture, not a substitute for legal advice. The final legal text should be reviewed by qualified counsel when available.

## Localization

- English uses American English.
- Spanish uses Latin American Spanish and the existing `es-419` metadata region.
- French remains idiomatic French.
- Names and the approved English job title remain stable identity fields; surrounding labels and bios are localized.
- All three locales ship in the same release.
- Visible meaning, structured data, links, and dates must remain equivalent across locales.

The new route is added consistently to:

- `next-intl` routing;
- localized slug configuration where used by SEO helpers;
- metadata and hreflang helpers;
- sitemap generation;
- default-locale wrappers;
- Company, About, blog, Benchmark Lab, and footer or trust navigation where appropriate.

## Visual System

The pages reuse MaxVideoAI's current marketing tokens and the restrained visual language established by Benchmark Lab:

- generous spacing and readable line lengths;
- quiet bordered cards rather than dashboard chrome;
- typographic hierarchy before decoration;
- one restrained accent treatment for identity and provenance;
- responsive stacking without horizontal overflow;
- dark/light theme compatibility through existing semantic tokens;
- keyboard-visible focus and semantic links;
- no client component unless interaction genuinely requires it.

About and Editorial Standards should feel designed, but they must remain Server Components and avoid decorative motion, generated portraits, or heavy JavaScript.

## Architecture

- Public `page.tsx` files remain thin route orchestrators.
- Route-local copy, metadata, schema builders, and view sections live under `_lib/` and `_components/` when extraction improves responsibility boundaries.
- The editorial profile is shared and server-safe; it must not import route components or browser APIs.
- About may continue using the existing dictionary contract where that is the least disruptive path, while identity data remains centralized.
- Blog data helpers resolve the default author; blog SEO helpers build Person authorship; the view owns visible byline and author-card rendering.
- Benchmark copy remains localized in its route-local copy source; the methodology data remains in the existing versioned benchmark source.
- Legal body copy remains in the existing locale-specific Terms components.
- Existing public URLs, model routes, comparison routes, pricing routes, generation behavior, and legal URL ownership remain unchanged.

## Failure And Fallback Behavior

- If editorial profile lookup fails for an explicitly unknown future author id, article rendering fails closed to the verified default profile rather than emitting an empty or invented person.
- Missing `updatedAt` renders only the publication date and does not fabricate a modification date.
- Missing external identity URLs do not render placeholders.
- About and Editorial Standards remain fully useful without JavaScript.
- Benchmark Lab database unavailability continues to affect only the observed latency snapshot, not editorial ownership, scores, sourced specifications, or methodology.
- Legal document database unavailability continues to use the code fallback version; deployment verification must confirm production metadata is updated after release.

## Testing

Focused automated coverage must prove:

1. the editorial profile has the approved name, role, location, localized bio, and About fragment;
2. About visibly identifies Adrien Millot without inventing credentials, team members, or statistics;
3. the new Editorial Standards route exists in English, French, and Spanish with reciprocal canonical and hreflang URLs;
4. the new route appears once in the localized sitemap graph;
5. the Editorial Standards page covers authorship, source types, corrections, benchmark updates, and commercial-interest disclosure;
6. every audited blog locale renders the verified byline and locale-correct About link;
7. blog Article JSON-LD uses `Person` for Adrien and retains MaxVideoAI as publisher;
8. structured `author.name` contains only the person's name and `jobTitle` owns the role;
9. publication and modification dates come from article front matter and are not generated at request time;
10. Benchmark Lab visibly identifies the editorial lead and current methodology version/effective date;
11. Benchmark Lab keeps editorial scores, sourced specifications, and observed latency distinct;
12. Company links to About, Editorial Standards, Benchmark Lab, Terms, Privacy, and the sub-processor notice;
13. the approved commercial-use meaning appears in all three Terms locales and in the Company summary;
14. the Terms generated-media section has a stable deep-link fragment;
15. the Terms fallback version changes consistently and existing legal re-consent architecture remains intact;
16. no new route emits unsupported `Dataset`, `ClaimReview`, review, or certification schema;
17. existing blog, benchmark, legal, sitemap, schema-audit, localized-route, and marketing architecture tests continue to pass.

Manual browser coverage includes:

- English desktop and mobile About;
- English desktop and mobile Editorial Standards;
- one English, French, and Spanish blog article with visible author and date treatment;
- Benchmark Lab ownership block in all three locales;
- Company content-rights and data block in all three locales;
- English, French, and Spanish Terms deep links and commercial-use sentence;
- keyboard focus, responsive reflow, and light/dark semantic-token checks;
- canonical, hreflang, JSON-LD, and sitemap inspection;
- post-deployment Terms version update and soft re-consent verification.

## Acceptance Criteria

- Adrien Millot is visibly and consistently identified as Founder & Product Lead and editorial owner where appropriate.
- Blog Article markup no longer hides all authorship behind the MaxVideoAI organization.
- About provides a credible identifying destination for the author without creating a thin profile page.
- Editorial Standards is one substantive, localized page rather than three thin policies.
- Benchmark Lab names its editorial lead without implying independent review or certification.
- Company makes content rights, commercial use, privacy, and editorial resources easy to find.
- The approved commercial-use rule appears consistently in Company and all three Terms locales.
- The Terms change is versioned and handed off through the existing soft re-consent workflow.
- No weak generation counts, fake reviewers, unsupported credentials, or defensive caveat repetition is introduced.
- All new public URLs are localized, canonical, indexable, internally linked, and present in the sitemap.
- Existing product behavior, pricing, refunds, benchmark calculations, and public model/comparison routes remain unchanged.
