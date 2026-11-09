import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { mockBrowserSession } from './helpers/browser-session-fixture';
import { useUpscaleLibraryAssets } from '../frontend/src/components/tools/upscale/_hooks/useUpscaleLibraryAssets';
import { useAudioGeneratedVideos } from '../frontend/app/(core)/(workspace)/app/audio/_hooks/useAudioGeneratedVideos';
import { invalidateLibraryMedia } from '../frontend/hooks/useLibraryCacheRevision';
for (const host of ['upscale', 'audio'] as const)
    test(`${host} generated candidates refresh Trash without restoring Activity rows or retired responses`, async () => {
        const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' }), requests: string[] = [];
        const job = { jobId: 'owned-job', sourceOutputId: 'primary', videoUrl: 'https://media.test/video.mp4', createdAt: '2026-11-09T00:00:00Z' };
        let trashed = false, hold = false, release: ((r: Response) => void) | undefined;
        const globals = { window: dom.window, document: dom.window.document, React, IS_REACT_ACT_ENVIRONMENT: true, fetch: async (input: RequestInfo | URL) => {
                const url = String(input);
                requests.push(url);
                if (url.includes('/assets?'))
                    return Response.json({ ok: true, assets: [] });
                if (url.startsWith('/api/jobs?'))
                    return Response.json({ ok: true, jobs: [job] });
                if (url.startsWith('/api/media-library/generated-videos?')) {
                    if (hold)
                        return new Promise<Response>(r => { release = r; });
                    if (url.includes('cursor=generated-next')) return Response.json({ok:true,jobs:[{...job,sourceOutputId:'sibling'}],hasMore:false,nextCursor:null});
                    return Response.json({ ok: true, jobs: trashed ? [] : [job], hasMore: host==='upscale'&&!trashed, nextCursor: host==='upscale'&&!trashed ? 'generated-next' : null });
                }
                throw Error(url);
            } };
        const previous = new Map(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
        for (const [k, value] of Object.entries(globals))
            Object.defineProperty(globalThis, k, { configurable: true, writable: true, value });
        const session = await mockBrowserSession('candidate-owner');
        let upscale!: ReturnType<typeof useUpscaleLibraryAssets>, audio!: ReturnType<typeof useAudioGeneratedVideos>;
        function Fixture({ owner = 'candidate-owner', open = true }: {
            owner?: string;
            open?: boolean;
        }) { upscale = useUpscaleLibraryAssets({ user: owner, mediaType: 'video', libraryErrorCopy: 'Failed' }); audio = useAudioGeneratedVideos({ user: { id: owner }, open: host === 'audio' && open, loadErrorMessage: 'Failed' }); return null; }
        const root = createRoot(dom.window.document.getElementById('root')!);
        const visible = () => host === 'upscale' ? upscale.visibleLibraryAssets.map(a => a.url) : audio.generatedVideos.map(a => a.url);
        try {
            await act(async () => root.render(React.createElement(Fixture, {})));
            if (host === 'upscale')
                await act(async () => upscale.openLibraryModal());
            assert.deepEqual(visible(), [job.videoUrl]);
            assert.equal(requests.length, host === 'upscale' ? 2 : 1, 'opening uses the same bounded request count as the previous owners');
            if (host==='upscale') {
              assert.equal(upscale.libraryHasMore,true);
              await act(async()=>upscale.loadMoreLibraryAssets());
              assert.deepEqual(upscale.visibleLibraryAssets.map(a=>a.sourceOutputId),['primary','sibling'],'generated pagination preserves distinct same-URL siblings');
              assert.equal(upscale.libraryHasMore,false);
              assert.equal(requests.length,3,'generated-only next page does not reload saved media');
            }
            trashed = true;
            await act(async () => invalidateLibraryMedia('candidate-owner'));
            assert.deepEqual(visible(), [], 'Trash refresh cannot reintroduce the Activity video');
            if (host === 'upscale') {
                await act(async () => upscale.setLibraryModalOpen(false));
                await act(async () => upscale.openLibraryModal());
            }
            else {
                await act(async () => root.render(React.createElement(Fixture, { open: false })));
                await act(async () => root.render(React.createElement(Fixture, { open: true })));
            }
            assert.deepEqual(visible(), [], 'reopen preserves exclusion');
            trashed = false;
            await act(async () => invalidateLibraryMedia('candidate-owner'));
            assert.deepEqual(visible(), [job.videoUrl], 'restored source remains available');
            hold = true;
            await act(async () => invalidateLibraryMedia('candidate-owner'));
            assert.deepEqual(visible(), []);
            assert.ok(release);
            const releaseOld = release;
            session.setUserId('other-owner');
            await act(async () => root.render(React.createElement(Fixture, { owner: 'other-owner', open: false })));
            await act(async () => releaseOld(Response.json({ ok: true, jobs: [job] })));
            assert.deepEqual(visible(), [], 'retired owner cannot publish');
            assert.equal(requests.filter(url => url.startsWith('/api/jobs?')).length, 0, 'candidate selection must not read Activity');
        }
        finally {
            await act(async () => root.unmount());
            await session.restore();
            dom.window.close();
            for (const [k, d] of previous) {
                if (d)
                    Object.defineProperty(globalThis, k, d);
                else
                    Reflect.deleteProperty(globalThis, k);
            }
        }
    });
