import assert from 'node:assert/strict';
import test from 'node:test';
import { mapCreatedPlaylistRow } from '../frontend/server/playlists/mappers';
import { createExampleFamilyResolver, getExampleFamilyIds, getExampleFamilyModelSlugs } from '../frontend/lib/model-families';
import { buildModelFamilyDefinitions } from '../frontend/config/model-families';
import { listRuntimeModels } from '../frontend/config/model-runtime';
import { isDiscoverableExampleEngine } from '../frontend/lib/examples/discovery';
import { MODEL_LAUNCH_READY_MODELS } from '../frontend/config/model-launch-readiness';

function playlist(slug: string) {
  return mapCreatedPlaylistRow({ id: slug, slug, name: slug, description: null, is_public: true, created_at: '2026-09-28', updated_at: '2026-09-28' });
}

test('connects the Max model collection for admin preparation before public launch assets are ready', async () => {
  const models = listRuntimeModels();
  const publicFamilies = createExampleFamilyResolver({ families: buildModelFamilyDefinitions(models, []) });
  assert.equal(publicFamilies.getModelSlugs('flux').includes('flux-3-max'), false);
  const { buildPlaylistDestinations } = await import('../frontend/server/playlists/destinations');
  const rows = buildPlaylistDestinations([playlist('examples-flux-3-max')], new Map());
  const destination = rows.find(row => row.id === 'model:flux-3-max');
  assert.ok(destination, 'A discoverable model must be available to admin curation before public readiness');
  assert.equal(destination.status, 'connected');
  assert.equal(destination.kind, 'model');
  assert.equal(destination.editable, true);
  assert.equal(destination.playlistId, 'examples-flux-3-max');
  assert.equal(destination.path, '/models/flux-3-max');
  assert.equal(destination.familyId, 'flux');
  assert.equal(destination.publicCount, 0);
  assert.equal(rows.some(row => row.id === 'playlist:examples-flux-3-max'), false);
  assert.equal(publicFamilies.getModelSlugs('flux').includes('flux-3-max'), false);
});

test('unready admin model destinations are missing until their exact collection exists', async () => {
  const { buildPlaylistDestinations } = await import('../frontend/server/playlists/destinations');
  const rows = buildPlaylistDestinations([playlist('custom-flux-3-max')], new Map());
  const destination = rows.find(row => row.id === 'model:flux-3-max');
  assert.equal(destination?.status, 'missing');
  assert.equal(destination?.editable, false);
  assert.equal(destination?.playlistId, null);
  assert.equal(rows.find(row => row.id === 'playlist:custom-flux-3-max')?.status, 'unconnected');
});

test('Kling V4 can be curated while the family and discovery gates are explicitly closed', async () => {
  const models = listRuntimeModels().map(model => structuredClone(model));
  const beforeFamilyOpening = models.find(model => model.id === 'kling-v4')!;
  beforeFamilyOpening.publication.model.indexable = false;
  beforeFamilyOpening.publication.compare.published = false;
  beforeFamilyOpening.publication.sitemap.published = false;
  beforeFamilyOpening.publication.examples.current = false;
  beforeFamilyOpening.publication.examples.includeInFamilyCopy = false;
  const { buildPlaylistDestinations } = await import('../frontend/server/playlists/destinations');
  const missing = buildPlaylistDestinations([playlist('family-kling')], new Map(), models);
  const destination = missing.find(row => row.id === 'model:kling-v4');
  assert.ok(destination, 'Kling V4 must have an admin destination before its media pack exists');
  assert.equal(destination.status, 'missing');
  assert.equal(destination.editable, false);
  assert.equal(destination.slug, 'examples-kling-v4');

  const connected = buildPlaylistDestinations([playlist('family-kling'), playlist('examples-kling-v4')], new Map(), models)
    .find(row => row.id === 'model:kling-v4');
  assert.equal(connected?.status, 'connected');
  assert.equal(connected?.editable, true);
  assert.equal(connected?.playlistId, 'examples-kling-v4');

  const withoutKlingMedia = MODEL_LAUNCH_READY_MODELS.filter(model => model.modelId !== 'kling-v4');
  const kling = buildModelFamilyDefinitions(models, withoutKlingMedia).find(family => family.id === 'kling')!;
  assert.equal(kling.defaultModelSlug, 'kling-o3-pro');
  assert.equal(kling.examplesPage?.publishedModelSlugs?.includes('kling-v4'), false);
  const v4 = models.find(model => model.id === 'kling-v4')!;
  assert.equal(v4.publication.model.indexable, false);
  assert.equal(v4.publication.examples.current, false);
  assert.equal(v4.publication.examples.includeInFamilyCopy, false);
  assert.equal(v4.publication.pricing.published, false);
  assert.equal(v4.publication.compare.published, false);
  assert.equal(v4.publication.sitemap.published, false);
});

test('admin model bootstrap excludes retired, deep legacy and unpublished identities', async () => {
  const { buildPlaylistDestinations } = await import('../frontend/server/playlists/destinations');
  for (const variant of ['retired', 'deep_legacy', 'app-hidden', 'examples-hidden'] as const) {
    const models = listRuntimeModels().map(model => model.id !== 'flux-3-max' ? model : {
      ...model,
      lifecycle: variant === 'retired' || variant === 'deep_legacy' ? variant : model.lifecycle,
      publication: {
        ...model.publication,
        app: { ...model.publication.app, published: variant !== 'app-hidden' },
        examples: { ...model.publication.examples, published: variant !== 'examples-hidden' },
      },
    });
    const rows = buildPlaylistDestinations([playlist('examples-flux-3-max')], new Map(), models);
    assert.equal(rows.some(row => row.id === 'model:flux-3-max'), false, variant);
    const diagnostic = rows.find(row => row.id === 'playlist:examples-flux-3-max');
    assert.equal(diagnostic?.kind, 'maintenance', variant);
    assert.equal(diagnostic?.status, 'unconnected', variant);
  }
});

test('projects_missing_and_historical_core_destinations', async () => {
  const previous = { hub: process.env.EXAMPLES_PLAYLIST_SLUG, starter: process.env.STARTER_PLAYLIST_SLUG };
  try {
    process.env.EXAMPLES_PLAYLIST_SLUG = ' marketing-examples ';
    process.env.STARTER_PLAYLIST_SLUG = 'starter';
    const { buildPlaylistDestinations } = await import('../frontend/server/playlists/destinations');
    const rows = buildPlaylistDestinations([playlist('examples'), playlist(' WELCOME '), playlist('family-wan')], new Map([['family-wan', 7]]));
    const byId = new Map(rows.map(row => [row.id, row]));
    const bySlug = new Map(rows.map(row => [row.slug.trim().toLowerCase(), row]));
    assert.equal(byId.get('examples')?.status, 'missing');
    assert.equal(bySlug.get('examples')?.status, 'historical');
    assert.equal(bySlug.get('welcome')?.editable, false);
    assert.equal(byId.get('examples')?.editable, false);
    assert.match(bySlug.get('examples')?.warning ?? '', /configuration/i);
    assert.equal(bySlug.get('family-wan')?.itemCount, 0);
    assert.equal(bySlug.get('family-wan')?.publicCount, 7);
    for (const family of getExampleFamilyIds()) {
      assert.ok(byId.has(`family:${family}`));
      for (const model of getExampleFamilyModelSlugs(family).filter(slug => isDiscoverableExampleEngine(slug))) {
        assert.ok(byId.has(`model:${model}`));
      }
    }
    const missingModel = byId.get('model:happy-horse-1-1');
    assert.equal(missingModel?.status, 'missing');
    assert.equal(missingModel?.label, 'Happy Horse 1.1');
    assert.equal(byId.get('model:dreamina-seedance-2-0-mini')?.label, 'Dreamina Seedance 2.0 Mini');
    assert.match(missingModel?.warning ?? '', /editable collection/i);
    assert.match(missingModel?.warning ?? '', /currently displays 0 public videos/i);
    assert.match(missingModel?.warning ?? '', /examples-happy-horse-1-1/);
    process.env.EXAMPLES_PLAYLIST_SLUG = ' EXAMPLES ';
    process.env.STARTER_PLAYLIST_SLUG = ' WELCOME ';
    const mismatched = buildPlaylistDestinations([playlist('examples'), playlist('welcome')], new Map([['examples', 99]]));
    for (const id of ['examples', 'starter']) {
      assert.equal(mismatched.find(row => row.id === id)?.status, 'missing');
      assert.equal(mismatched.find(row => row.id === id)?.editable, false);
    }
    assert.equal(mismatched.find(row => row.id === 'examples')?.publicCount, 0);
    for (const slug of ['examples', 'welcome']) {
      const diagnostic = mismatched.find(row => row.id === `playlist:${slug}`);
      assert.equal(diagnostic?.status, 'historical');
      assert.equal(diagnostic?.editable, false);
    }
    process.env.EXAMPLES_PLAYLIST_SLUG = 'examples';
    process.env.STARTER_PLAYLIST_SLUG = 'welcome';
    const variants = buildPlaylistDestinations([playlist('examples'), playlist('welcome'), playlist(' EXAMPLES '), playlist(' WELCOME ')], new Map());
    assert.equal(variants.find(row => row.id === 'examples')?.playlistId, 'examples');
    assert.equal(variants.find(row => row.id === 'starter')?.playlistId, 'welcome');
    for (const slug of [' EXAMPLES ', ' WELCOME ']) {
      assert.equal(variants.find(row => row.id === `playlist:${slug}`)?.status, 'historical');
      assert.equal(variants.find(row => row.id === `playlist:${slug}`)?.editable, false);
    }
    const connected = buildPlaylistDestinations([playlist('examples'), playlist('welcome')], new Map());
    assert.equal(connected.find(row => row.id === 'examples')?.status, 'connected');
    assert.equal(connected.find(row => row.id === 'starter')?.slug, 'welcome');
    const { isHistoricalCoreSlug } = await import('../frontend/server/playlists/destination-protection');
    for (const slug of [' EXAMPLES ', 'Marketing-Examples', ' WELCOME ', 'STARTER']) assert.equal(isHistoricalCoreSlug(slug), true);
    assert.equal(isHistoricalCoreSlug('custom'), false);
    for (const slug of ['examples', 'welcome']) {
      const matches = connected.filter(row => row.slug.trim().toLowerCase() === slug);
      assert.equal(matches.length, 1);
      assert.equal(matches[0].status, 'connected');
      assert.equal(matches[0].editable, true);
    }
  } finally {
    for (const [name, value] of [['EXAMPLES_PLAYLIST_SLUG', previous.hub], ['STARTER_PLAYLIST_SLUG', previous.starter]]) {
      if (value === undefined) delete process.env[name!]; else process.env[name!] = value;
    }
  }
});
