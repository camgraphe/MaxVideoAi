# Public proof review — 15 November 2026

Reviewed against production revision `3d49f113fbebb2471395fc42e4a1fcaffec2e616`
at 18:40 UTC during the authorized tool-delivery release. The release owner's
preceding `pnpm deployment:check` confirmed both public domains on this Git-backed
revision (`dpl_D9Ao8uAmhRCb4n9h8Xy5wC9SawRy`). Reviewer: Codex. The existing
MaxVideoAI owner approvals remain attributed as recorded; this review does not
claim a new human approval, native-host certification or paid generation.

The 30-day guard correctly rejected fifteen expired publishable proof records.
All fifteen retained images were opened and visually inspected individually.
Their stated claims were then compared with actual rendered public pages,
including DOM text, images and the relevant visible sections. All seven routes
returned HTTP 200. Neither the 30-day review limit nor the 90-day capture limit
was changed.

| Public source | Result and bounded decision |
| --- | --- |
| `/` | Pay-as-you-go, Create a video and Explore examples remain. The default film is now FLUX 3 Max, so `maxvideoai-workspace-live` was recaptured. The separate September 16 MiniMax JPG remains an explicitly dated composite source, without claiming the current default model or navigation. |
| `/examples` | Four opening cards now show Wan 3 Prime, Seedance 2.0 Fast and two Kling 4.0 examples, with prompt excerpts. Recaptured `maxvideoai-examples-gallery-live`; removed the obsolete FLUX opening-card description from both READMEs. |
| `/ai-video-engines/minimax-h3-vs-seedance-2-5` | The 8.5/9.1 scores remain, now explicitly labeled editorial scores. Higher-rated-area wording and the independent example selection changed. Recaptured `maxvideoai-engine-scoreboard-live`, retaining the visible different-prompts/settings qualification. These are not identical-prompt benchmark results. |
| `/models` | Browse models, Compare engines, price-before-render, pay-as-you-go and specification cues, plus the MiniMax/Kling artwork, still match the retained hero. Kept `maxvideoai-model-directory-live` pixels and narrowed its claim/alt to the September 16 capture; this does not freeze the current catalogue. |
| `/pricing` | The first scenario is now Dreamina Seedance 2.0 Mini at $0.39; the two Kling 3 Standard scenarios remain $1.10/$1.64. The summary shows 31 current-generation engines, and 4K entries now expose duration/audio qualifiers. Recaptured `maxvideoai-pricing-comparison-live`. These are dated preset display prices, not a quote for a new request. |
| `/tools` | The featured character-sheet artwork has become a Character Studio portrait. Camera-angle/upscale examples and tool entry actions remain. Recaptured `maxvideoai-tools-workflow-live` and updated its direct descriptions; presentation artwork does not certify an actual tool run. |
| `/mcp` | Five public paths and four in-preparation clients remain. Claude and ChatGPT eligibility/test labels have changed, so `maxvideoai-assistant-workflow-live` was recaptured. These labels describe public-page copy and are not independent host requalification. The page still displays the same controlled Claude Desktop staging result, now prominently dated August 26, 2026, with an explicit historical-$0.95 disclaimer, saved-to-Library label and first-party action. The September 16 `maxvideoai-library-continuity-production` JPG remains a dated view of that specific demonstration. |

Six standalone screenshots were genuinely recaptured at 18:38:55–18:39:19 UTC
using Chromium `147.0.7727.15`, viewport 1268×713, device scale 1, reduced motion
and rejected optional cookies. Captures are direct rendered-page screenshots
encoded as WebP at quality 90 without resizing, retouching, annotation or interface
synthesis. Their individual capture timestamps, production source revision and
measured SHA-256 values were updated in the manifest.

Nine other publishable images retain their original September 16 capture dates,
source revision `5423599b472ae6d6e31beb3e8a5c59e23d3a1a83` and byte hashes:

- `maxvideoai-workspace-production`: dated MiniMax home source; current home
  proposition and primary actions were revalidated, not the old default film.
- `maxvideoai-library-continuity-production`: dated public view of the explicitly
  historical Claude staging result still disclosed on `/mcp`.
- `maxvideoai-model-directory-live`: matching directory hero and bounded cues.
- `readme-proof-hero`, `brief-to-video-workflow`, `model-choice-and-budget`,
  `library-continuity`, `github-social-preview` and `directory-thumbnail`:
  individually inspected composites of the unchanged dated home/Claude JPGs.
  Their source-proof IDs, composition provenance and decorative pixels remain
  unchanged. Claims and alt text now state the dated scope. The composites do
  not certify the current interface, a current quote, approval or execution in
  every named client. The public five-client paths remain as listed on `/mcp`.

Only these fifteen previously expired publishable records receive the new
`lastReviewedAt` and `lastReviewedRevision`. Fresh proof records are untouched.
The six archival native-host records remain `reference_only`, with their original
null provenance. The cancelled `release-0-3-4` historical card is also untouched.
No application route, pricing policy, model configuration, host status or package
version was changed. README edits only correct directly associated image
descriptions and dates.

Verification:

```sh
node scripts/check-github-assets.mjs --release
TSX_TSCONFIG_PATH=frontend/tsconfig.json node --import tsx --test tests/github-assets.test.ts
git diff --check
```

The release guard passed, all 14 focused tests passed, and `git diff --check`
passed. The equivalent direct Node loader was used because the sandbox refused
the `tsx` CLI's IPC pipe; no validation assertion was skipped or changed.
