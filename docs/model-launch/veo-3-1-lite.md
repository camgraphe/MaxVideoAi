# Google Veo 3.1 Lite launch packet

- Source template: `veo-3-1-fast`
- New slug: `veo-3-1-lite`
- Family: `veo`
- Stage: `indexed`
- Availability: `available`

## Generated artefacts

- Marketing JSON scaffold: `content/models/{en,fr,es}/veo-3-1-lite.json`
- Engine stub: `docs/model-launch/veo-3-1-lite.engine.stub.ts`
- Family stub: not generated (existing family)
- Launch packet: `docs/model-launch/veo-3-1-lite.md`

## Codex checklist

1. Complete the engine entry in `frontend/src/config/falEngines.ts` from real specs, modes, pricing, and provider ids.
2. Rewrite the EN model page with factual positioning, not template placeholders.
3. Rewrite FR and ES as marketing adaptations, not literal translations.
4. Verify title, meta description, canonical path, and locale coverage before promoting indexation.
5. Decide explicitly whether examples copy should mention this model by updating `publishedModelSlugs`.
6. Decide explicitly whether compare should publish any pairs by filling `surfaces.compare.publishedPairs`.
7. Decide explicitly whether pricing marketing should feature this model with `surfaces.pricing.featuredScenario`.

## Publication notes

- Family route is indexable. Keep `publishedModelSlugs` intentional so canonical examples copy does not drift automatically.
- Model pages remain public quickly, but compare hub/sitemap should not expand unless publication is explicit.
- App and estimator can stay automatic as long as the engine entry is complete and `surfaces.app` / `surfaces.pricing` are left enabled.

## After manual edits

```bash
npm run engine:catalog
npm run model:generate:write
npm run models:audit
```
