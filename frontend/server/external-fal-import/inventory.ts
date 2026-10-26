import { externalFalImportPlan, parseExternalFalImport } from './contract';

/** Offline candidate inventory only. No database, provider, curation or publication authority. */
export function externalFalImportInventory(value: unknown) {
  const input = parseExternalFalImport(value);
  const plan = externalFalImportPlan(input);
  return { ...plan, verified: false, externalWrites: 0, currentCuration: null,
    engineId: input.engineId, mode: input.mode, endpoint: input.endpoint,
    promptAndSettings: input.providerInput,
    media: [{ role: 'original', assetId: input.videoAssetId, sha256: input.videoSha256 },
      ...(input.engineId === 'kling-v4' ? [
        { role: 'poster', ...input.media.poster }, { role: 'short-preview', ...input.media.preview },
      ] : [])],
    references: input.references,
    placements: input.engineId === 'kling-v4' ? [
      { destination: 'examples-kling-v4', path: '/models/kling-v4', admin: '/admin/playlists', status: 'pending-review' },
      { destination: 'family-kling', path: '/examples/kling', admin: '/admin/playlists', status: 'pending-review' },
      { destination: 'selected-video-seo', path: null, admin: '/admin/video-seo', status: 'pending-review' },
    ] : [],
    prerequisites: ['real accepted provider journal', 'live GET completion and byte verification', 'owned media and admin checks',
      'reviewed apply plan and ready import runtime', 'complete visual/audio review', 'current admin curation revision and preview',
      'separate publication and selected SEO approval'],
  };
}
