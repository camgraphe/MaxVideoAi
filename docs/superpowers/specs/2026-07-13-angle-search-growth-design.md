# Angle search-growth landing update

## Goal

Increase qualified organic reach for the existing Angle tool without changing
its URL, generation workflow, or conversion path. Search Console shows that
the current page earns a healthy 5.5% CTR but has a small query footprint:
273 clicks from 4,949 impressions over the trailing three months, with an
average position of 9.3.

## Scope

- Keep `/tools/angle` as the canonical English URL and preserve the existing
  EN, FR, and ES localized routes.
- Add an intent-led visual section that demonstrates three practical camera
  angle changes: product, storyboard, and ad/creative use.
- Use generated source images and genuine Angle outputs for the added visual
  examples; do not use stock placeholders or imply unsupported controls.
- Expand localized copy and FAQs with the language people use to find the
  tool: change camera angle, camera angle change, video camera angle change,
  alternate viewpoints, product shots, and first frames for image-to-video.
- Add contextual inbound links to Angle from relevant first-frame,
  storyboard, or image-to-video marketing surfaces where such a link is a
  natural fit.
- Preserve canonical metadata, hreflang behavior, existing CTA destinations,
  analytics attributes, JSON-LD, and the production tool workflow.

## Non-goals

- No new backend, generation API, billing, or workspace behavior.
- No new thin SEO URLs until a follow-up Search Console review demonstrates
  sufficient demand for a dedicated use-case page.
- No changes to unrelated local work already present in the worktree.

## Design

### Visual and content structure

Create a standalone landing-section module, keeping the existing section
orchestrator below its architecture line limit. The new section presents a
small before-and-after gallery. Each card names the user intent, explains the
angle outcome, and links to the Angle workspace CTA. The gallery copy stays
concrete: it describes a changed viewpoint, rather than claiming the scene,
subject identity, or image details are perfectly preserved.

The existing hero and problem/solution remain intact. New copy complements
them by covering broader but relevant intents in natural language. FAQ entries
answer the key variants people search for and retain FAQ schema automatically
through the existing dictionary-driven renderer.

### Assets

Generate three clean source-image assets using an image engine, then use the
logged-in Angle tool to produce their alternate viewpoints. Store approved
web-ready assets in the existing public tool-assets convention and reference
them through the Angle landing asset module. Each asset requires descriptive,
localized alt text from the dictionary.

### Internal linking

Use only existing route destinations. Add links where the surrounding copy
already discusses first-frame preparation, image-to-video, or storyboarding;
the anchor describes the Angle task, not a generic "learn more" label.

## Validation

- Extend the focused tool-marketing architecture test to protect the new
  section boundary and preserve the landing architecture constraints.
- Run the focused architecture test, lint, exposure lint, and `git diff
  --check`.
- Smoke-test English, French, and Spanish Angle routes for metadata,
  canonical/hreflang behavior, JSON-LD, CTA destinations, and responsive
  rendering.
- Capture matching desktop screenshots before and after the update. The
  baseline screenshot has been captured before implementation.

## Rollout and measurement

Monitor the Angle page in Search Console for four to six weeks. Compare
non-brand impressions and clicks for the camera-angle query cluster, average
position for the three leading terms, localized traffic, and CTA engagement.
Only then consider dedicated pages for the highest-demand use case.
