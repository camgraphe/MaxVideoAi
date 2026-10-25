# Shared video excerpt selection

The user explicitly requested implementation of the previously discussed shared
start/end selector for imported videos, model-specific limits and prices, and
mobile/desktop demonstration without deployment. The existing agreed approach
keeps originals and creates a compatible copy only when a passage is selected.

## Approach

Use the existing owned-media resolver, bounded media preparation and canonical
quote pipeline. A shared accessible selector previews a start/end range; applying
it prepares a distinct measured owned asset. The normal quote and generation
paths then consume that asset. Browser-only playback offsets cannot substitute
for a real cut, and a new provider-specific trimming system would duplicate the
existing media infrastructure.

The selector belongs to source-video workflows (Modify, Extend and Reframe),
including files and library imports. Keep output-duration controls independent
where a model accepts them. Derive source limits from the active input field and
existing engine policy; never use output duration as an input cap or impose a
new cap on existing full-video generation.

## Behavior

- Show an explicit Choose excerpt action on a ready owned source.
- Show video playback, start/end handles plus precise numeric fields, selected
  length and model source limits. Mobile uses touch-sized controls.
- Preview loops only the selection. No autoplay or eager full-video download.
- Invalid, reversed or oversized ranges cannot be applied. No silent cut.
- Applying creates H.264/AAC MP4 with original rotation displayed correctly,
  frame-aware duration verification, and explicit source/range lineage.
- Preserve originals, exact source identity, references and all model options.
- Preparation is uncharged; generation still needs the existing fresh exact
  quote. Invalidate/hide stale pricing while changing/preparing the source.
- Cancel, preparation failure, account change, source replacement and model
  switch cannot insert a stale derivative or accidentally generate from it.
- Preparation uses bounded server resources and owned media only, never arbitrary
  browser URLs. Source and result are independently measured and re-authorized.
- Reuse the prepared asset in ordinary web/MCP/Studio quote and generation paths.
  Do not create alternate tariffs or silently activate unavailable tariff cells.
- No provider render, production mutation, push or deployment in this task.

## Verification

Behavioral tests cover policy, actual FFmpeg cuts/audio/rotation, ownership and
invalid requests, source/account races, cancellation and quote invalidation.
Exercise actual shared UI on mobile and desktop with the supplied phone video
and a local one-minute fixture. Local demonstrator must distinguish real cutting
and measured media from any fixture pricing. Complete focused architecture,
TypeScript/lint/exposure tests and a production build before completion.
