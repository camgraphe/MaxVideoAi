# Seedance 2.5 capabilities — option B implementation QA

The previous comparison scorecard report is retained in `docs/design-qa/comparison-scorecard-2026-10-17.md`.

## Scope and visual truth

- Selected source: `/Users/adrienmillot/.codex/visualizations/2026/11/17/model-workflow-mockups/selected-b.png` (2304 × 3072).
- Inspection copy: `/tmp/selected-b-inspect.png` (1152 × 1536, 50% scale).
- Implementation: http://localhost:3116/models/seedance-2-5#capabilities
- User direction: retain B's visual composition, but preserve the broader Create/Modify/Extend explanations. Reference-based creation is the example, not the definition of Create.
- Existing hero, public films, gallery, Draft workflow, model identity and commercial content are unchanged by this iteration. The new visual module uses explicitly labelled Sunburst illustrations, not claimed Seedance video outputs.

## Capture normalization

Evidence folder: `/Users/adrienmillot/.codex/visualizations/2026/11/17/model-workflow-mockups/qa/`.

Desktop CSS viewport: 1063 × 1115, reported DPR 2. The browser screenshot API exports at 1 capture pixel per CSS pixel (1063 px full-page width), so no additional DPR multiplier was applied. Mobile CSS viewport: 390 × 844, DPR 1, capture width 390 px. Full-page screenshots were cropped to the measured module bounds. Bounds and full-page originals are saved for every state.

- Desktop module captures: `create-desktop-module.jpg` (968 × 751), `modify-desktop-module.jpg` (968 × 743), `extend-desktop-module.jpg` (968 × 762).
- Mobile module captures: `create-mobile-module.jpg` (346 × 1026), `modify-mobile-module.jpg` (346 × 1085), `extend-mobile-module.jpg` (346 × 1069).
- Full-view combined inputs: `create-comparison.jpg`, `modify-comparison.jpg`, `extend-comparison.jpg`. Each places the matching B tab state on the left and the rendered module on the right, normalized to 968 px region width. The source board shows three alternate states; the implementation renders one selected tab.
- Additional states: `prompt-drawer.jpg`, `create-details-open.jpg`.
- Earlier evidence: `modify-before.jpg`, combined with B in `modify-comparison-before.jpg`.

The source has no mobile version. Mobile checks therefore assess content order, readability, touch targets, cropping and overflow rather than claiming pixel fidelity. The implementation is intentionally taller than B because the user requested the complete workflow scope and retained technical details. Captions sit beneath the imagery, following the existing page convention.

## Comparison history and findings

1. Initial review: [P2] Modify's cover crop removed the subject's face; the heading also used a lighter weight than B. Evidence: `modify-comparison-before.jpg`. Fixed equal image layers to use the top crop and restored the 600-weight headline. Extend's preview was also reframed to keep the face visible.
2. Post-fix review: `modify-comparison.jpg`, `create-comparison.jpg`, `extend-comparison.jpg` were opened as combined source/render inputs. Faces, reference thumbnails and the image divider remain readable. The filmstrip allocates room explicitly for its toggle. The comparator shows a visible keyboard focus ring.
3. Disclosure review: [P2] global open-details styling introduced a white rectangle with flush text inside the warm module. Scoped the open disclosure background to transparent. Post-fix evidence: `create-details-open.jpg`, with computed transparent background and readable full details. Closed-state comparison captures are unaffected by this open-state-only change.

No actionable P0/P1/P2 finding remains for this scoped implementation.

## Required fidelity surfaces

- **Typography:** existing site sans-serif; 600-weight, tight headline tracking and responsive hierarchy follow B. Longer Create and Modify copy is intentional. English, French and Spanish titles fit the tested desktop width. Mobile titles wrap without clipping.
- **Spacing/layout:** editorial copy left, dominant visual right; Create has two references alongside one result; Modify has a single full-area image comparison; Extend has a preview and expanding timeline. A single row of tabs replaces repeated mockup headings. Mobile stacks copy, illustration, actions and optional details. No horizontal document overflow at 390 px. The native page header/footer and warm page background remain.
- **Colors/tokens:** ivory surface, dark navy actions and restrained blue-grey timeline accents; no new orange/purple palette. Selected tabs and CTA treatment use the current site system. Open details now blend into their parent.
- **Image quality:** Create uses image-region crops from selected B, with readable captions authored in HTML. Modify/Extend use existing Sunburst still pairs at their own provenance. They are intentionally different working assets from B, not fabricated native videos. All seven files are hash-named WebPs with measured dimensions and lazy responsive delivery. Both comparison layers use identical geometry; the divider clips only the reveal.
- **Copy/content:** all original capability body text, three uses and limits remain in SSR HTML in all locales. Text-to-video, image-to-video, multimodal references and first/last frames remain explained. Modify includes character, wardrobe, background, light and scene elements; Extend includes before/after/between-shot directions. Technical precision lives in compact disclosures. Prompts and captions distinguish illustrations from completed outputs.

Full-view combined inputs are readable at native size, including the divider, tags, captions and CTA icons; those regions were inspected at native size rather than judged from reduced thumbnails. The source has no open drawer/disclosure state; those were checked against the existing site UI and accessibility behavior.

## Interaction and technical evidence

- Create/Modify/Extend tabs, arrow-key navigation, Home/End selection; only one visible tab panel.
- Modify defaults to 50%; pointer drag changed it to 77%; keyboard Home/End reached 0/100 and PageUp returned it to 50. Both layers stay full-size.
- Extend reset/preview toggles the continuation and its accessible expanded state. The transition has a reduced-motion override.
- Prompt drawer opens; Escape closes; reuse and Milo links carry the correct Seedance 2.5 model, mode, example ID and locale. Copy displayed its Copied feedback. Host clipboard readback did not independently confirm the copied bytes; no new clipboard implementation was introduced.
- All use/limit text is retained in the server-rendered module, including collapsed details and unselected panels.
- EN `/models/`, FR `/fr/modeles/` and ES `/es/modelos/` returned 200, one H1, three panels, correct canonical/hreflang and five parseable JSON-LD scripts. Localized browser smoke showed no broken visible proof images or overflow.
- 28 targeted cinematic/media/migration/preset tests passed; one additional Seedance-specific composer hydration case passed with the existing preset tests (29 distinct cases overall).
- TypeScript passed. Full frontend lint passed with seven warnings in unchanged files. Public exposure and diff checks passed.
- Browser console: no capability-module runtime exception. Local navigation reported existing shared-header React warnings for popovertarget/popoverTarget and popovertargetaction/popoverTargetAction, plus a cookie-policy-version load warning. These owners are unchanged.

## Remaining boundaries

This is a local design implementation, not a production release certification. The new capability examples remain illustrations. Real reference/result videos must follow the reviewed public-media workflow and shared manual/comparison playback owners before replacing them. No paid generation, publication or new SEO ranking claim is part of this change. No production CWV comparison or physical-device test was performed.

## Implementation checklist

- [x] Apply B while retaining the full workflow content.
- [x] Full-frame Modify slider and extendable timeline.
- [x] Reuse / copy / Milo prompt panel and model-specific handoff checks.
- [x] Desktop/mobile, locale and metadata checks.
- [x] Preserve evidence and media provenance; document replacement ownership.
- [ ] User visual review; then plan and approve real renders separately.

final result: passed

## Native Draft section — 17 November 2026 follow-up

Scoped result: passed for the explanatory design; native Draft/final quality proof remains pending.

The user's annotated section is the before-state: a large isolated Library control screenshot followed by three boxed steps. The revision removes that screenshot, places one source frame in a small Draft stage and a dominant final stage, and explains Create → Library → separately quoted finalization in an unboxed row. The 1080p/4K buttons select the illustrated destination; they do not simulate resolution improvement or make a provider request. Exact-model frame identity lives in `model-draft-workflow-illustration.json`, not in the renderer. The source is excluded from the compact gallery rail to prevent repeated visual placement.

Reviewed captures (same final state, 4K selected) under `/Users/adrienmillot/.codex/visualizations/2026/11/17/model-workflow-mockups/qa/draft/`:
- `desktop-section.jpg`: full section at 1063 px viewport width.
- `mobile-section.jpg`: full section at 390 px viewport width.
- Original full-page captures and DOM bounds are retained alongside them. The initial `mobile.jpg` clip contains sticky-header capture overlap; use the section crop from the full-page capture for review.

Visual review: images preserve the complete 16:9 composition; no fake blur/sharpening or 4K pixels are manufactured. Contrast, focus, caption and disclosure are readable on the navy section. Desktop horizontal path becomes a vertical path on mobile, with no document overflow (1063/1063 and 390/390). The controls retain rectangular geometry and the existing arrow/plus icons. The closed factual disclosure preserves inherited settings, separate pricing and the provider source in SSR HTML.

Verification: both resolution choices respond to pointer/keyboard; 1080p is the default; the disclosure opens/closes; the CTA targets `/app?lang=en&engine=seedance-2-5&mode=t2v` without auto-submit. Both images load lazily; no video is mounted. A fresh browser reload produced no section errors (a transient HMR error while changing props did not recur). English, French and Spanish routes return 200 with one H1, correct canonical/hreflang and five parseable JSON-LD blocks. The 25 focused cinematic/architecture tests, TypeScript, exposure check and diff check passed. Full lint has zero errors and seven existing warnings outside this change. No CWV gain is claimed; no paid render or deployment was performed.

Release/proof follow-up: the 4K integration candidate documents 1080p/4K finalization but does not establish production activation or a verified linked example. Replace the explanatory frame with reviewed native Draft/final originals and measured output facts before describing this as a quality comparison.

## Native Draft: Sunburst direction and Mediterranean camera choices — 17 November 2026

This pass supersedes the train-based Draft illustration above. Scope: the user selected the Sunburst composition, explicitly removed repeated background images, and requested a new, more colorful human scene with three different camera angles. Built-in ImageGen produced three stills; these are workflow illustrations, not native Seedance outputs. No paid Sunburst rerun, video render, publication or deployment was performed.

Source visual truth: `/Users/adrienmillot/.codex/visualizations/2026/11/17/model-workflow-mockups/qa/draft-sunburst/sunburst-draft-savings.png` (3072 × 2048).

Implementation evidence: `/Users/adrienmillot/.codex/visualizations/2026/11/17/model-workflow-mockups/qa/draft-terrace/`:
- `comparison-final.jpg`: both reference and implementation in one comparison input; source normalized to 1063 × 709, implementation section 1063 × 863. Different heights are intentional for readable real-page controls/captions; no browser chrome in the comparison.
- `desktop-section.jpg`, `desktop-viewport.jpg`: native 1063 × 1115 CSS viewport, default close two-shot / 1080p state.
- `mobile-section.jpg`: full 390 × 1454 section, 390 × 844 CSS viewport. No mobile reference was supplied; this checks responsive adaptation rather than a claimed pixel match.
- Original full-page captures and DOM crop bounds are retained. Capture density was normalized to one screenshot pixel per CSS pixel.

Comparison history: the first board (`comparison.jpg`) showed looser outer spacing and missing step pictograms relative to Sunburst. Reduced desktop outer padding and composition row gaps, added the existing Lucide library's Clapperboard/GalleryHorizontalEnd/MonitorUp icons, and re-captured both breakpoints. The final combined input was opened and reviewed. Focused controls were also inspected in the browser at native scale: selection badge, angle names, 1080p/4K buttons, plus disclosure and rectangular CTA.

Required fidelity surfaces:
- Typography: existing site font, large ivory two-line headline, restrained supporting text and readable captions; mobile wraps without truncation.
- Layout: Sunburst's editorial headline, three-choice strip, connecting arrow, dominant final, three compact steps and bottom action/disclosure are retained. One large final replaces the source mockup's redundant full-bleed background, as requested. No document overflow at 1063 or 390 px.
- Colors/tokens: navy, ivory and cool blue-grey controls remain MaxVideoAI; coral, turquoise and gold come from the scene rather than new brand tokens.
- Images: three distinct full-frame compositions. Only the selected choice repeats as the final preview. No fake blur, resolution improvement, video controls or model-generation claim. Immutable WebP display copies use lazy responsive Next Image sizing and fixed geometry; no new initial-loading or CWV gain is claimed.
- Copy: savings on exploratory trials, separate Draft/final quotes, inherited settings, source citation and exact-model Create handoff remain readable HTML. EN/FR/ES angle copy is authored and validated against manifest identities.

Interaction checks: pointer selection of wide / close / high angles; Enter activation; selected image and caption follow the angle; 1080p/4K selection; disclosure opens/closes; CTA resolves to the correct model and language without spending. Final selection reset to close two-shot / 1080p. Console retains only the existing header `popovertarget` / `popovertargetaction` React warnings, unrelated to this section.

Verification: 25 focused cinematic/migration/media tests passed; TypeScript passed; full lint has 0 errors and 7 existing unrelated warnings; exposure check and diff whitespace passed. Localized HTTP/SEO smoke checks recorded separately in the task output. No pricing, registry, SEO route/schema or runtime capability ownership changed.

Follow-up: a real Draft/final output comparison still requires verified native lineage. Current 4K marketing content remains a pre-activation candidate under the existing release coordination.

final result: passed

### 2026-11-17 — Prompt placement and compact guidance

- Moved the opening visual's existing prompt drawer from Specifications to a single 44px plus control on the hero. The glyph is geometrically centered. Original prompt/provenance and reuse/Milo actions are preserved; no expanding block changes the hero layout.
- Folded the extra prompt recipes into Prompt writing tips. Unrendered Seedance templates are labelled as starting points with Copy template; actual FLUX examples keep their exact job, replay and Milo links. No illustration or output settings are invented for a text template.
- Restored 10-bit HEVC beside both final-resolution options in the Draft illustration, consistent with the staged 1080p/4K editorial specification. Illustration attribution remains visible.
- Specifications use the localized section label to avoid repeating the model name.
- Verified desktop 1063px and mobile 390px, image/video prompt drawers, Escape and focus return, no horizontal overflow, and current FLUX public-job links. Four cinematic EN routes plus Seedance FR/ES: HTTP 200, one H1, correct canonical, five JSON-LD scripts, one hero prompt, none under specs.
- Validation: 50 focused tests passed; TypeScript passed; full lint 0 errors / 7 pre-existing warnings; exposure and whitespace checks passed. Existing production activation gate is unchanged; no paid generation or deployment.
- Screenshots: `/Users/adrienmillot/.codex/visualizations/2026/11/17/model-workflow-mockups/qa/prompt-cleanup/guide-transition.png` and `hero-prompt.png`.

### 2026-11-17 — Seedance 2.5 looping hero preview

- Exact existing opening clip, 28.04s / 854×480, muted and looping inside the established hero composition. No new generation or media alteration. This is a local design preview, not a 4K output or a production performance sign-off.
- Opt-in belongs to the media bundle; only Seedance 2.5 enables motion. Image heroes and other cinematic bundles retain their current stills. Playback delegates rendition/fallback to the shared public-video owner.
- Browser: initial SSR/post-hydration cover remained the same AVIF with the same desktop 1063×569.06 hero geometry. Observed media request started 1.74s after the poster request. Pause/resume, offscreen suspension and deliberate-pause persistence verified. Mobile 390px initially mounted no video, explicit Play worked muted, and controls do not overlap the byline; no horizontal overflow.
- Tests: 20 focused tests passed, including autoplay deferral, loop/mute, hidden-tab resume, persistent user pause, retry, mobile, reduced-motion and Save-Data behavior. TypeScript and targeted lint passed, as did whitespace validation.
- No production LCP/CLS result is claimed: the raw PerformanceTimeline endpoint is unavailable in this browser bridge. Production-build performance review remains separate from this visual trial.
