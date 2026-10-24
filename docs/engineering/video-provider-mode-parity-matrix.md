# Independent video provider mode matrix

Reviewed2026-10-24 against the captured38-entry provider audit, exact schemas and current/legacy MCP baselines. The expected list is authored in `tests/fixtures/video-provider-mode-parity.ts` independently of workspace availability helpers. Tests require exact engine modes, public canonical aliases and Studio conversation certification. They separately assert every expected Site source action, including the four entry gaps closed by Task6A. Live browser qualification remains a separate gate.

`Site` below describes expected canonical modes and records application integration and remaining live qualification. Creation modes may be selected by their ordinary input flow. `MCP/Studio` means code projection/certification, not enabled production execution, active tariff or paid render proof. The default MCP list remains30current models; the8legacy exact IDs stay discoverable/executable according to their existing gates. No lifecycle republishing occurred.

| Model | Expected native modes | Site status | MCP / Studio canonical projection |
| --- | --- | --- | --- |
| pika-text-to-video | t2v, i2v | Source actions projected; live browser QA pending | t2v, i2v |
| veo-3-1 | t2v, i2v, ref2v, fl2v, extend | Source actions projected; live browser QA pending | t2v, i2v, ref2v, fl2v, extend |
| veo-3-1-fast | t2v, i2v, ref2v, fl2v, extend | Source actions projected; live browser QA pending | t2v, i2v, ref2v, fl2v, extend |
| veo-3-1-lite | t2v, i2v, fl2v, extend | Source actions projected; live browser QA pending | t2v, i2v, fl2v, extend |
| gemini-omni-flash | t2v, i2v, ref2v, fl2v, v2v, extend, retake | Source actions projected; live browser QA pending | t2v, i2v, ref2v, fl2v, v2v, extend (Retake deliberately unavailable) |
| lumaRay2 | t2v, i2v, v2v, reframe | Source actions projected; live browser QA pending | t2v, i2v, v2v, reframe |
| lumaRay2_flash | t2v, i2v, v2v, reframe | Source actions projected; live browser QA pending | t2v, i2v, v2v, reframe |
| luma-ray-3-2 | t2v, i2v, v2v, reframe, extend | Owned-generation Extend picker implemented; live QA pending | t2v, i2v, v2v, reframe, extend |
| kling-2-5-turbo | t2v, i2v, i2i | Source actions projected; live browser QA pending | t2v, i2v, i2v_standard |
| kling-2-6-pro | t2v, i2v | Source actions projected; live browser QA pending | t2v, i2v |
| kling-3-pro | t2v, i2v | Source actions projected; live browser QA pending | t2v, i2v |
| kling-3-standard | t2v, i2v | Source actions projected; live browser QA pending | t2v, i2v |
| kling-3-4k | t2v, i2v | Source actions projected; live browser QA pending | t2v, i2v |
| kling-o3-standard | t2v, i2v, ref2v, v2v | Source actions projected; live browser QA pending | t2v, i2v, ref2v, v2v |
| kling-o3-pro | t2v, i2v, ref2v, v2v | Source actions projected; live browser QA pending | t2v, i2v, ref2v, v2v |
| kling-o3-4k | t2v, i2v, ref2v, v2v | Source actions projected; live browser QA pending | t2v, i2v, ref2v, v2v |
| kling-3-turbo-standard | t2v, i2v | Source actions projected; live browser QA pending | t2v, i2v |
| kling-3-turbo-pro | t2v, i2v | Source actions projected; live browser QA pending | t2v, i2v |
| happy-horse-1-1 | t2v, i2v, ref2v | Source actions projected; live browser QA pending | t2v, i2v, ref2v |
| happy-horse-1-0 | t2v, i2v, ref2v, v2v | Source actions projected; live browser QA pending | t2v, i2v, ref2v, v2v |
| seedance-2-0 | t2v, i2v, ref2v, v2v, extend | Source actions projected; live browser QA pending | t2v, i2v, ref2v, v2v, extend |
| seedance-2-0-fast | t2v, i2v, ref2v, v2v, extend | Source actions projected; live browser QA pending | t2v, i2v, ref2v, v2v, extend |
| seedance-2-0-mini | t2v, i2v, ref2v, v2v, extend | Source actions projected; live browser QA pending | t2v, i2v, ref2v, v2v, extend |
| seedance-2-5 | t2v, i2v, ref2v, v2v, extend | Source actions projected; live browser QA pending | t2v, i2v, ref2v, v2v, extend |
| wan-2-6 | t2v, i2v, r2v | Source actions projected; live browser QA pending | t2v, i2v, r2v |
| ltx-2-3-fast | t2v, i2v | Source actions projected; live browser QA pending | t2v, i2v |
| ltx-2-3 | t2v, i2v, a2v, extend, retake, reframe | Reframe action implemented; live QA pending | t2v, i2v, a2v, extend, retake, reframe |
| minimax-h3 | t2v, i2v, ref2v | Source actions projected; live browser QA pending | t2v, i2v, ref2v |
| minimax-h3-max | t2v, i2v, ref2v, v2v | Source actions projected; live browser QA pending | t2v, i2v, ref2v, v2v |
| minimax-hailuo-02-text | t2v, i2v | Source actions projected; live browser QA pending | t2v, i2v |
| wan-3 | t2v, i2v, ref2v, v2v, extend | Source actions projected; live browser QA pending | t2v, i2v, ref2v, v2v, extend |
| wan-3-prime | t2v, i2v, ref2v, v2v, extend | Source actions projected; live browser QA pending | t2v, i2v, ref2v, v2v, extend |
| ltx-2-5-fast | t2v, i2v, a2v | Source actions projected; live browser QA pending | t2v, i2v, a2v |
| ltx-2-5-pro | t2v, i2v, a2v | Source actions projected; live browser QA pending | t2v, i2v, a2v |
| grok-imagine-video-1-5 | t2v, i2v, ref2v | Source actions projected; live browser QA pending | t2v, i2v, ref2v |
| flux-3 | t2v, i2v, fl2v, extend, ref2v, v2v | Keyframes and FAST compatible-copy UI implemented; live QA pending | t2v, i2v, fl2v, extend, ref2v, v2v |
| flux-3-max | t2v, i2v, fl2v, ref2v | Source actions projected; live browser QA pending | t2v, i2v, fl2v, ref2v |
| flux-3-draft | t2v, i2v, fl2v, extend, ref2v, v2v | Keyframes and owned Draft/cache picker implemented; live QA pending | t2v, i2v, fl2v, extend, ref2v, v2v |

## Deliberate pending and distinct provider variants

- H3 Max Recast/Relight are implemented; new Extend/Insert/Reframe remain pending by human decision on unanchored customer cost domains. Existing H3 modes are preserved.
- Gemini Omni Retake needs an owned private provider interaction resolver before public MCP/Studio exposure. Its10versus30second edit-source ambiguity remains unresolved; existing policy is unchanged.
- FLUX Draft Extend remains native and priced by its existing contract; its cache does not qualify for Enhance until exact cache/artifact/segment mapping is proven. Base FAST Edit is not Max quality. Max keyframes/Create remain separate.
- LTX2.3 standard Reframe/Extend/Retake evidence does not apply to2.3Fast or2.5Fast/Pro. LTX2.5Draft is not introduced.
- Pika2.2 creation is distinct from older PikaEffects1.5 endpoints; effects are not silently exposed as arbitrary video editing.
- Kling MotionControl Pro/Standard belongs to its specialized motion-control workflow, not arbitrary Edit. Kling3 and O3/Omni versions/tier endpoints remain distinct; O3 reference and explicitEdit are separate operations/tariffs.
- HappyHorse1.0 editing evidence does not establish1.1 editing. Wan2.6reference-to-video and its specialized flash variant are not Wan3 editing.
- Grok base Edit/Extend is not Grok1.5. Hailuo Pro/Fast variants are not H3Max aliases.
- Veo tests target actual Vertex Standard; Gemini API duration restrictions do not remove supported Vertex combinations or Lite Extend. Production access flags and exact active tariffs require separate verification.

Final qualification must test the four newly integrated Site entries, FAST compatible-copy preparation, Enhance owner/cache recovery and source reuse, measured quantity through quote/confirmation/reservation, current/legacy discovery, and exact active cells. This matrix does not waive those checks.


## Task6A application evidence

The four entry gaps are covered by positive workspace actions and shared keyframe editor integration. `tests/video-provider-mode-fields.test.ts` exercises the actual `/api/engines` handler for ordinary/admin contexts against a separately authored 38-entry mode/source-field inventory, plus operation-specific prompt/timing/settings. Create deliberately exposes cross-mode references for mode inference; Modify/Extend/Reframe remain scoped. The private Gemini Retake UI remains supported and its MCP exclusion is unchanged. Existing native Seedance2.5 Draft is exercised in all five modes and FLUX Draft Extend remains available.

Kling's new Modify action selects explicit Edit, while a new Create video reference selects explicit Reference. Old omitted-operation v2v settings/links keep Reference semantics. Public example recipes remove only private source job/output binding; authenticated personal recall retains it and the server reauthorizes ownership. No public media migration is required.

Offline DOM, HTTP/storage-IO-injected and PostgreSQL tests establish application behavior; they do not establish live Vercel import, mobile layout, active customer prices, or paid output quality. Controller and Task6B retain those gates.
