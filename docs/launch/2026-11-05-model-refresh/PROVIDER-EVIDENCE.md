# Faits vérifiés — 5 novembre 2026

## Production MaxVideoAI

Lectures authentifiées Vercel `get_deployment` sur les deux domaines : `maxvideoai.com` et `api.maxvideoai.com`.

- Projet : `maxvideoai`, `prj_CA8KpDAwYzihVJZyDNnEUrDszaMu`.
- Déploiement : `dpl_7fdiAB89wbJCq6rzDMzhhhtf3vQC`, READY, source Git, branche main.
- Commit : `cd6cc4c77c7c17c352e62e62d2609b52b199f2ee`.
- Les deux domaines figurent sur ce même déploiement. Vérification à refaire avant livraison ; ce document n'est pas un verrou de release.

Les fichiers de ce commit établissent le routage :

- `frontend/src/config/fal-engines/kling-v4.ts` : quatre endpoints `kling/v4/*`.
- `frontend/src/server/video-providers/kling-direct/model-map.ts` : huit identités Kling 3/O3, aucune identité V4.
- `frontend/src/server/video-providers/router.ts` : branche `kling_direct_primary` conditionnée par cette table ; V4 ne peut pas y entrer par un simple flag d'environnement.
- `frontend/src/lib/fal.ts` : soumission V4 en queue, conservation du reçu/ID accepté.
- `docs/launch/kling-v4/PLAN.md` et `HANDOFF.md` : décision historique fal-first du 22 octobre, remplaçant le projet direct-first. Leurs états privés/noindex sont historiques, pas un constat du 5 novembre.

## Kling 4.0 Flash

Sources officielles lues :

- [T2V et prix](https://fal.ai/models/kling/v4/flash/text-to-video).
- [I2V et prix](https://fal.ai/models/kling/v4/flash/image-to-video).
- [Références et prix](https://fal.ai/models/kling/v4/flash/reference-to-video).
- Schémas OpenAPI : `https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=` suivi de chacun des trois IDs ci-dessus sans le préfixe `/models/`.
- [Guide Kling 4](https://fal.ai/kling-4) : contient encore la mention générale « API coming soon » et mentionne Flash en early access. Cette différence avec l'existence des schémas impose un essai du compte avant d'affirmer l'exécutabilité.

Faits structurants : 720p, durée entière 3–20s (défaut 5), prompt jusqu'à 26 000 caractères ; aucun `multi_prompt` dans ces trois schémas. I2V nécessite `start_image_url`, sans `end_image_url`. T2V expose quatre ratios ; REF2V ajoute auto. Références : 10 images, 5 vidéos, 7 éléments dont au plus 3 vidéo ; 20s cumulées pour vidéos et éléments vidéo. Pas de voix Flash. Les contraintes détaillées de media doivent rester dans les validations canoniques.

Prix fournisseur affichés : 0,094 USD/s en sortie seule, y compris I2V et REF2V sans vidéo. REF2V avec vidéo : 0,063 USD/s sur `output + max(input, output)`. Il ne s'agit pas de prix client MaxVideoAI. Les trois modes ont ensuite été exécutés dans le lot cinéma ci-dessous ; la facture réelle reste non vérifiée.

## GPT Image 2.6

Sources officielles lues :

- [Modèle Flare](https://developers.openai.com/api/docs/models/gpt-image-2.6-flare).
- [Modèle Sunburst](https://developers.openai.com/api/docs/models/gpt-image-2.6-sunburst).
- [Guide Images](https://developers.openai.com/api/docs/guides/image-generation).
- [Création d'images — référence API](https://developers.openai.com/api/reference/resources/images/methods/generate).
- [Conseils de prompting](https://developers.openai.com/api/docs/guides/image-prompting).
- [Prix](https://developers.openai.com/api/docs/pricing).

Identités : `gpt-image-2.6-flare` et `gpt-image-2.6-sunburst`. Les endpoints propres aux modèles sont génération et édition d'image. `complexity` vaut low/medium/high, défaut high, indépendamment de `quality`. Les taux par token sont inchangés par rapport à 2.5, mais le guide précise que les nombres de tokens peuvent différer pour une même qualité : les prix par image doivent être recalculés.

Lecture initiale du compte : GET `https://api.openai.com/v1/models`, HTTP 200 avec les deux IDs 2.6. Les quatre appels création/retouche du lot approuvé ont ensuite utilisé la clé existante. Aucune clé affichée, écrite, copiée vers le worktree ou créée. L'inventaire Vercel établit sa présence en Preview/Production, sans établir l'égalité des valeurs ni l'exécution déployée.

## Leçons des précédents

1. `docs/operations/nano21-mcp-public-routing-2026-10-27.md` : publication App/prix réussie mais modes MCP non exécutables faute d'admission provider ; configuration et nouveau déploiement ont été nécessaires. Tester les trois surfaces séparément.
2. `docs/launch/kling-v4/PUBLIC-OPENING-PREPARATION.md` : ouverture fonctionnelle, prix natifs et marketing étaient des gates distincts ; la certification de la conversation était séparée de l'ancien Canvas.
3. `docs/launch/kling-v4/seo-linking-plan.md` : menus bornés, famille historique, médias/ordre choisis par le propriétaire, comparaison ciblée, scores et hero conditionnés par des preuves réelles.
4. `tests/gpt-image-2-5-integration.test.ts` et `frontend/lib/image/gptImage2.ts` : qualité, références et tarifs 2.5 sont spécifiques au contrat fal. Ce sont des précédents de couverture, pas des tarifs ou payloads réutilisables tels quels pour OpenAI direct 2.6.

## Lecture MCP et certification Studio actuelles

Le MCP MaxVideoAI connecté a retourné le 5 novembre :

| ID | Modes | generationEnabled |
| --- | --- | --- |
| `kling-v4` | t2v, i2v, ref2v, v2v | true |
| `gpt-image-2-5-flare` | t2i, i2i | true |
| `gpt-image-2-5-sunburst` | t2i, i2i | true |

Il s'agit de découverte live, sans devis ni exécution. Dans la source de production, `frontend/app/(core)/(workspace)/app/studio/_shared/_lib/models/workspace-model-certification.ts` inclut Flare 2.5 dans `IMAGE_MODELS` mais pas Sunburst 2.5. Le précédent est également documenté dans `docs/operations/studio-model-coverage-audit-2026-10-04.md`. L'ajout 2.6 doit donc qualifier ses deux variantes dans Studio, sans prétendre hériter d'une parité 2.5 qui n'existe pas.

Les conditions d'accès, prix et schémas sont datés ; revalider les sources avant activation. Aucun test de génération ni état public nouveau n'est déduit de la présence d'une documentation ou d'un ID dans le catalogue.

### Flash contract implementation — 2026-11-05

Sanitized input schemas are pinned under `tests/fixtures/kling-v4-flash/`. The element subtype sets video subjects to 3–8 seconds (8.05s transport tolerance); flat references permit 3–20 seconds (20.05s tolerance). All submitted video occurrences share an exact 20-second total, including duplicates and subject videos. No aggregate image/subject count is documented beyond the individual arrays; the initial application envelope is conservatively 15 actual originals, including all subject views. It is not advertised as a provider maximum.

The strict adapter, owned media boundary and fal receipt transport are implemented while publication remains closed. Eight Flash tests (including disposable PostgreSQL receipt recovery) and 24 existing Kling 4 contract/ownership/queue/recovery tests pass. No paid request was made.

### OpenAI direct implementation — 2026-11-05

The Images API reference documents JSON edits with `images: [{image_url}]`. The direct adapter signs only exact owned PNG/JPEG/WebP originals after database ownership, MIME, dimensions and the application's 25 MiB reference limit are checked. The provider fetches these temporary URLs; the application does not copy credentials or expose signed references in error bodies. Generation and editing each issue exactly one POST. Successful and partial inline results are persisted as original raster files; each stored original is checkpointed before further work. Ambiguous transport, malformed success, partial output or post-response storage failure retains the paid job without an automatic retry/refund.

Masks remain unavailable in this initial contract, alongside annotation markup, GIF and SVG. The old generic mask URL setting does not establish owned-mask dimensions or alpha-channel validation. Plain prompt-guided raster editing is included.

Validation: 15 focused provider, execution, architecture and PostgreSQL paid-recovery tests passed. TypeScript passed after retaining immutable normalized input (the `systematic-debugging` workflow identified a reassigned destructured parameter that disabled reservation-union narrowing). No paid call was made.

The official image-generation page's calculator bundle `GptImageTokenCalculator.react.D6vlJVKl.js` was inspected on 2026-11-05. Its 2.6 output estimator uses grid sizes low16/medium24/high48/xhigh64/max96 and multiplies the rounded result by 4.2 for low, 3.3 for medium, and 1 for the other tiers. Its shared dimension bounds are multiples of16, 655360–8294400 pixels, max edge3840 and max aspect3:1. Output rates alone do not bound input cost. The current [vision cost guide](https://developers.openai.com/api/docs/guides/images-vision#calculating-costs) explicitly separates GPT Image from the vision patch calculator and only documents historical GPT Image1 input rules; those rules must not be applied to2.6.

## Canonical pricing implementation — 2026-11-05

All three registry records remain unpublished. Flash supplier facts use exact aggregate video timing and independent no-video/video classes. GPT Image 2.6 output tokens follow the official calculator (provenance and sample facts in `tests/fixtures/gpt-image-26-output-calculator.json`). Text/image input token bounds are not established by current documentation; estimates explicitly identify partial output components, unknown invoice/input cost and unqualified supplier budget. No GPT 2.5 fal pricing fallback is used.

The native admin previews and stages inactive exact customer cells. Tests against disposable PostgreSQL verify stale preview rejection, inactive-price rejection, continuous Flash input and public/billing parity after test-only activation. No production tariffs or paid jobs were created. GPT 2.6 normalized tariff identity ignores price-neutral complexity and redundant parsed dimensions while immutable requests retain those settings.

## Surface integration candidate — 2026-11-05

Canonical generation preserves both exact 2.6 variants, quality, complexity,
background and output format. Studio is wired for one image with at most eight
references; its three first-lot sizes have explicit 1:1, 3:2 and 2:3 framing.
Unsupported framing cannot silently select a square fallback. The App persists
complexity and restores it from the job snapshot; changing models discloses any
reset. Storyboard, Character Builder and Angle retain their fixed tool models.

Flash App references/subjects share the current V4 owners, with separate 20-second
and 15-original limits and no structured shots, final frame, Modify or Extend.
The canonical subject-video duration check survives owned-original probing.
App raw control validation rejects inherited unsupported options before pricing.
Milo gets exact-ID documented facts, without inherited measured quality rankings.
The seven mode contracts, existing V4 subjects/workspace regressions and MCP client
gate pass offline. Browser, database, tariff and account qualification remain
separate evidence gates in the release ledger.

## Environment inventory and first account evidence — 2026-11-05

Vercel env inventory was read without decrypted values. The connector response
was truncated at 100 of 395 entries, so the CLI read-only JSON inventory completed
the check: OPENAI_API_KEY, FAL_KEY, S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID and
S3_SECRET_ACCESS_KEY are all present for the general Preview and Production scopes.
This proves presence, not key equality or successful deployed execution.

The user approved seven original cinema renders within a 10 USD operational
budget, with no automatic retry. I1 Flare and I2 Sunburst both returned one valid
1024² PNG via the new direct client/payload/response owners. Output token usage
was 1758 and 1756 respectively, with 279 text-input tokens each. The official
calculator remains an estimator: its 1756-token output prediction is not an exact
invoice promise. No public admission or customer tariff was changed.

## Completed approved batch and recovery — 2026-11-05

All seven approved requests completed exactly once. `cinema-results.json` records
four PNG originals (both variants in creation and editing) and three Flash videos
with audio. The calculated supplier LIST total is 1.803869021 USD; no account
invoice or MaxVideoAI wallet charge is claimed. Flare edits reported 123 text,
1024 input-image and 1758 output tokens; Sunburst edits reported 123/1024/1756.
One square input is not evidence of a universal 2.6 input-token formula.

The private OpenAI receipt now persists accepted output bytes before object
uploads. A leased storage-only recovery cron resumes incomplete storage without
repeating the provider request. Completed output publication checks current paid
ownership and receipt lease atomically; partial responses enter manual review.
The new migration remains unapplied in production. A metadata-only Vercel CLI
inventory also confirms CRON_SECRET in general Preview and Production scopes.

Flash import preparation now retains the exact Flash identity, measured reference
limits and three-mode contract. Its separate original request/receipt/result
files are preserved in a later, explicitly identified evidence envelope; no
historical JSONL log is fabricated. Real record bindings verified offline for
V1/V2/V3. Private adoption still requires owned uploaded assets, fresh bound
provider GETs and the native verified transaction. No production import occurred.

Local silent 2.5-second previews and immutable poster copies are recorded in
`cinema-prepared-media.json`; original files, prepared media and private provenance
are preserved under `Documents/MaxVideoAI/2026-11-05-cinema`. Upload, HTTP/Range
readiness, public curation and final audio review remain separate gates.

The official MaxVideoAI local reference-import helper subsequently stored all
seven files in the connected private library. Its returned exact asset IDs were
used directly. A read-only lookup of those seven IDs confirmed one common owner,
ready status, dimensions and thumbnails, with no external job linkage. Short video
previews remain local. This is library-import evidence, not a paid App/Studio/MCP
generation or a public marketing adoption.
