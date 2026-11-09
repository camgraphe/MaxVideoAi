import assert from 'node:assert/strict';
import test from 'node:test';
import { mountToolFixture } from './helpers/tool-selection-fixture';

const stubs = {
  '@/hooks/useRequireAuth': 'export const useRequireAuth=()=>({user:null,session:null,loading:false});',
  '@/lib/i18n/I18nProvider': 'export const useI18n=()=>({locale:"en",t:(_,fallback)=>fallback});',
  '@/hooks/usePaginatedMediaLibraryAssets': 'export const usePaginatedMediaLibraryAssets=()=>({assets:[],hasMore:false,isLoading:false,isLoadingMore:false});',
  'next/navigation': 'export const useRouter=()=>({push:()=>{throw Error("Unexpected navigation")}});export const usePathname=()=>"/app/tools/character-builder";export const useSearchParams=()=>new URLSearchParams();export const redirect=()=>{throw Error("Unexpected redirect")};export const permanentRedirect=redirect;',
  'next/link': 'import React from "react";export default p=>React.createElement("a",{href:p.href},p.children);',
  'next/dynamic': 'export default ()=>()=>null;',
};

async function mount(source: 'recent' | 'history', original: string) {
  return mountToolFixture(`
    import {CharacterBuilderResultsGallery} from './src/components/tools/character-builder/_components/character-builder-results-gallery';
    import {CharacterStudioOverlays} from './src/components/tools/character-builder/_components/CharacterStudioOverlays.client';
    import {DEFAULT_CHARACTER_COPY} from './src/components/tools/character-builder/_lib/character-builder-copy';
    import {getStudioLibraryCopy} from './src/components/tools/character-builder/_lib/character-studio-library-copy';
    function App() {
      const [entry,setEntry]=useState(null);
      const result={id:'result',jobId:'owned-job',runId:'run',url:window.original,thumbUrl:window.thumbnail,
        engineId:'nano-banana-2-1',engineLabel:'Character',createdAt:'2026-11-06',action:'generate',outputMode:'portrait-reference',qualityMode:'final'};
      return <>
        <CharacterBuilderResultsGallery copy={DEFAULT_CHARACTER_COPY} variant="grid"
          flattenedResults={window.source==='recent'?[result]:[]}
          historicalResults={window.source==='history'?[{...result,imageUrl:window.original,prompt:'Keep this exact character.'}]:[]}
          historicalHasMore={false} historicalIsFetchingMore={false} historicalJobsLoading={false} historicalJobsError={false}
          onRetryHistory={noop} outputModeLabelOptions={[]} qualityLabelOptions={[]} pendingRuns={[]} qualityMode="final"
          resultsScrollContainerRef={{current:null}} resultsSentinelRef={{current:null}} runs={[]}
          savingResultId={null} selectedResultId={null} onDuplicateHistoricalSettings={noop} onDuplicateSettings={noop}
          onOpenLightbox={value=>{window.openedEntry=value;setEntry(value)}} onSaveHistoricalResult={noop} onSaveResult={noop}
          onSelectResult={noop} onKeepCharacter={noop} onRecastResult={noop}/>
        <CharacterStudioOverlays library={{saveTarget:null}} libraryCopy={getStudioLibraryCopy('en')}
          copy={DEFAULT_CHARACTER_COPY} lightboxEntry={entry} onCloseLightbox={()=>setEntry(null)} referenceOpen={false}
          userId={null} onCloseReference={noop} onSelectReference={noop} authOpen={false} onCloseAuth={noop}
          loginRedirectTarget="/app/tools/character-builder" onSaved={noop}/>
      </>;
    }
  `, stubs, w => {
    w.source = source;
    w.original = original;
    w.thumbnail = 'https://media.maxvideoai.com/thumbs/character.webp';
    w.HTMLElement.prototype.getClientRects = function () { return [{ width: 44, height: 44 }]; };
  });
}

for (const source of ['recent', 'history'] as const) {
  for (const [label, original] of [
    ['local HTTP', 'http://127.0.0.1:19016/character-studio-test/owned-original.png'],
    ['signed private', 'https://media.maxvideoai.com/user-assets/owner/original.png?X-Amz-Signature=exact%2Fsignature'],
    ['public CDN', 'https://media.maxvideoai.com/renders/original.png'],
  ] as const) {
    test(`${source} Character preview opens the exact ${label} original without an optimizer request`, async () => {
      const f = await mount(source, original);
      try {
        const doc = f.w.document;
        const thumbnail = doc.querySelector('#root img');
        assert.equal(thumbnail?.getAttribute('src'), f.w.thumbnail);
        const opener = thumbnail.closest('button');
        opener.focus();
        await f.act(async () => opener.click());
        // The stored thumbnail remains visible while the real lazy reader mounts.
        // No qualified display is supplied, so its reading source must still be the exact original.
        for (let i = 0; i < 40 && ![...doc.querySelectorAll('[role="dialog"] img')].some(image => image.getAttribute('src') === original); i++) {
          await f.act(async () => new Promise(resolve => setTimeout(resolve, 5)));
        }
        const reader = [...doc.querySelectorAll('[role="dialog"] img')].find(image => image.getAttribute('src') === original);
        assert.ok(reader);
        assert.equal(reader.getAttribute('src'), original, 'inspection must use the original through the private-safe reader');
        assert.equal(reader.hasAttribute('srcset'), false);
        assert.equal(f.w.openedEntry.imageUrl, original);
        assert.equal(f.w.openedEntry.thumbUrl, f.w.thumbnail);
        assert.equal(doc.querySelector('[role="dialog"] a[aria-label="Open original"]')?.getAttribute('href'), original);
        const download = doc.querySelector('[role="dialog"] a[href^="/api/download?"]');
        assert.ok(download);
        assert.equal(new URL(download.href).searchParams.get('url'), original);
        assert.equal(f.w.requests.length, 0);
        await f.act(async () => doc.querySelector('[role="dialog"] button[aria-label="Close"]').click());
        assert.ok(!doc.querySelector('[role="dialog"]'));
        assert.equal(doc.activeElement, opener);
      } finally { await f.close(); }
    });
  }
}
