# Nano Banana 2.1 editorial image preparation

This is preparation for the first external Vertex t2i lot. No accepted images
exist in this candidate. `frontend/config/nano21-editorial-recipes.json` remains
empty and the model publication flags remain closed. Nothing here generates,
uploads, adopts an application job, changes a tariff, or publishes a model.

The authored record is intentionally limited to Nano Banana 2.1 t2i: exact English
prompt, `gemini-nano-banana-2.1`, version 2.1, global Vertex, 1K, 16:9, MEDIUM,
candidateCount 1, numImages 1, an explicit maxOutputTokens of 4096 or 32768, no tools,
system instruction or references. The historical production recipe uses 4096;
the latest NINE-01 source packet explicitly uses 32768. Each accepted record keeps
its supplied cap through private review, hydration, estimates and the generation
body. Neither cap defaults to or aliases the other; absent/other caps are refused.
This source support grants no customer price-profile or generation approval.
The schema rejects extra fields. Native response/account/billing
data belongs in private production evidence, never in the public JSON.

An accepted public record requires its real generation and acceptance dates,
exact prompt and native-response SHA256, an original image with measured
dimensions/MIME/hash, and a display derivative with its own measured facts/hash
and the original's `sourceSha256`. Public URLs must be immutable, unsigned HTTPS
image URLs on the existing media host. Human acceptance must verify native
provenance, complete visual quality, facts and URLs before adding a record. A
schema passing alone does not authenticate a provider response or accept a render.

`?recipe=nano21-…` resolves an authored ID. It cannot carry arbitrary snapshots.
Closed publication, missing/draft/malformed recipes, references and divergent
job/tool/model links fail explicitly and block generation. Hydration only fills
the existing image settings owner. The cap is visible in Advanced settings and
travels through saved state, snapshots, SWR identity, current estimates, picker
estimate requests and the explicit Generate body. Historical Nano21 snapshots
without a cap retain their original 32768 default; Nano2 has no new cap field.
Every request still requires the current exact reviewed tariff; no cell is created
by an editorial recipe.

The image definition derives its future authored hero from the accepted source.
`projectNano21EditorialPageMedia` supplies that same image/prompt/ID handoff to the
existing model hero/examples owners without a fake app job, video or price.
The localized final Prompt Lab/Examples copy, actual derivatives and EN/FR/ES
page acceptance still await real accepted renders. Do not fill these gaps with
unrendered prompts, Nano2 media, a video gallery or stock artwork.

## Private local review

Keep future production files outside repository/publicly served directories.
Prepare a private JSON using the strict recipe fields above, with `status:
"draft"`. Replace the public `media` object with absolute `originalFile` and
`displayFile` paths. Replace provenance with `kind: "external_vertex"`, `location:
"global"`, the real `generatedAt`, and an absolute `responseFile` pointing to the
native JSON. Do not include customer/account/secret fields.

From the repository root:

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json scripts/preview-nano21-editorial.ts /absolute/private-draft.json /absolute/private-review.html
```

The command only reads local files and creates a new mode-0600 HTML file. It fully
decodes single-frame still pixels, with local review budgets of 32 MiB per image,
128 MiB for the supplied response, 16,777,216 pixels per image and 10 seconds per pixel
decode. These are review resource budgets, not provider capabilities or media-count
quotas. Animated/multipage inputs are refused. It requires the selected original
bytes to occur in an inline image part in the supplied response, computes the hashes
and embeds the supplied display image for offline review. It omits local paths and
response content. It checks both the normalized supplied path and canonical real
path for public/.next directories, including inward/outward symlinks, and refuses
to overwrite output.

The HTML separates declared model/version, settings and date from measured local
hashes, dimensions/MIME and supplied-response byte membership. Membership does not
authenticate the request, provider/model identity, settings/date, finish reason,
usage, display-to-original transformation or artistic acceptance. Those claims
require separate evidence and review.
The HTML is explicitly a private draft review, not a public record or a finished
marketing example. Do not commit it or its private inputs.

The tests use clearly synthetic records and local responses. They prove contract,
hydration, quote/payload parity and fencing, not provider access, image quality,
deployed tariffs, actual media acceptance or public page readiness.
