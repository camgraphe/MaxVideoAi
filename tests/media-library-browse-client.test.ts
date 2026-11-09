import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
test('common client key binds owner and server scope, maps job links and rejects malformed filters', async () => {
    assert.ok(existsSync('frontend/lib/library-browse-client.ts'), 'shared browse client must exist');
    const { buildLibraryBrowseKey, libraryBrowseScopeFromSearchParams } = await import('../frontend/lib/library-browse-client');
    const scope = libraryBrowseScopeFromSearchParams(new URLSearchParams('view=review&kind=video&job=job-123'));
    assert.deepEqual(scope, { view: 'review', kind: 'video', sort: 'recent', jobId: 'job-123' });
    const key = buildLibraryBrowseKey({ userId: 'alice', scope });
    assert.equal(key?.[1], 'alice');
    assert.match(key![0], /jobId=job-123/);
    assert.equal(buildLibraryBrowseKey({ userId: null, scope }), null);
    assert.deepEqual(buildLibraryBrowseKey({ userId: 'alice', scope: { ...scope, favorite: false, trash: false, source: 'all' } }), key);
    assert.throws(() => libraryBrowseScopeFromSearchParams(new URLSearchParams('kind=bogus')), /INVALID/);
    assert.throws(() => libraryBrowseScopeFromSearchParams(new URLSearchParams('job=')), /INVALID/);
    assert.throws(() => libraryBrowseScopeFromSearchParams(new URLSearchParams('job=a&jobId=b')), /INVALID/);
});
