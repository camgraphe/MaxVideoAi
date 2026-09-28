import assert from 'node:assert/strict';
import test from 'node:test';
import { mapCreatedPlaylistRow } from '../frontend/server/playlists/mappers';
import { getExampleFamilyIds, getExampleFamilyModelSlugs } from '../frontend/lib/model-families';

function playlist(slug: string) {
  return mapCreatedPlaylistRow({ id: slug, slug, name: slug, description: null, is_public: true, created_at: '2026-09-28', updated_at: '2026-09-28' });
}

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
      for (const model of getExampleFamilyModelSlugs(family)) assert.ok(byId.has(`model:${model}`));
    }
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
