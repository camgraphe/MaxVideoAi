# MaxVideoAI GitHub visual style and rhythm

GitHub readers should encounter useful proof continuously, not a long,
text-only sales page. Pair each major idea with current product proof, a useful
screenshot, a short demonstration, a compact comparison, an install block, or
another genuinely informative visual format.

## Enforceable rhythm

For every principal README and acquisition page:

- Put a real visual or install block within the first **60 README lines**.
- Do not allow more than **220 consecutive prose words** without a useful visual
  break.
- Do not allow more than **two consecutive H2 sections** that are text-only.
- Give every image descriptive alt text. `screenshot`, `image`, and `demo` on
  their own are invalid.

The checker recognizes a Markdown image, fenced code block, Markdown table,
video or GIF, explicit `<picture>` element, or a concrete example as a useful
break. Run it by path when preparing a README:

```bash
node scripts/check-github-content.mjs README.md plugins/maxvideoai/README.md
```

It is a review aid until the principal READMEs are rewritten; it is not yet a
production README enforcement script.

## Proof before decoration

Screenshots and short motion proof must be current, safe to publish, and tied
to the claim beside them. Product proof includes a current host installation,
model plan, exact quote and approval boundary, returned result, library,
reference flow, or recovery state. A compact install command or a comparison
table can break a dense explanation, but does not replace proof where the claim
needs proof.

ImageGen can support editorial backgrounds, release cards, and visual-direction
exploration. Label decorative ImageGen art **Editorial illustration**. It must
not satisfy a proof requirement for host compatibility, installation, quotes,
prices, balances, approvals, model rankings, benchmarks, or product UI.

## Placement and source sizes

| Asset | Source size | Place it where it answers |
| --- | ---: | --- |
| README proof hero | 1600×900 | The first viewport, beside the product promise and installation path |
| Install proof | 1600×1000 | Directly after the relevant platform install step |
| Workflow sequence | 1600×900 composite | `See it work`: brief → quote → approval → result |
| Multi-model proof | 1600×900 | `Plan a production` |
| Library continuity | 1600×900 | The result-recovery and reuse explanation |
| Repository social preview | 1280×640, under 1 MB | GitHub repository settings |
| Release card | 1200×630 | GitHub releases and launch posts |
| Directory thumbnail | 1200×675 | Registry and directory listings |

Use a semantic filename and freshly capture or explicitly revalidate every
public screenshot against the current host and MaxVideoAI release. Keep the
host identity and MaxVideoAI action/result visible, remove personal or secret
data, and keep surrounding light/dark treatment intentional.

## Mobile crop check

Before publishing, view each asset at its rendered mobile width. Confirm that:

- the named host remains recognizable;
- the MaxVideoAI action or returned result remains visible;
- price, approval state, and essential interface text are readable;
- no private reference, email, token, notification, unrelated tab, or staging
  hostname is visible; and
- the crop still supports the adjacent claim without relying on unreadable
  tiny text.

If the proof no longer reads on mobile, recrop or use a focused companion
image—do not shrink the same dense screenshot further.

## Alt-text examples

| Avoid | Use |
| --- | --- |
| `![screenshot](assets/quote.png)` | `![ChatGPT conversation showing a MaxVideoAI quote before approval](assets/chatgpt-quote-before-approval.png)` |
| `![demo](assets/library.png)` | `![MaxVideoAI library showing a completed launch-film generation and its reusable reference](assets/library-completed-launch-film.png)` |
| `![image](assets/editorial.png)` | `![Editorial illustration: one creative brief branching to several model options](assets/editorial-one-brief-many-models.png)` |

Alt text explains what a non-visual reader needs to understand from the asset;
it is not a filename, a generic media label, or decorative copy.
