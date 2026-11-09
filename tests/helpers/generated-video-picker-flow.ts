import assert from 'node:assert/strict';
import { bundleClientFlow, createClientFlowDom } from './client-flow-dom';
import { mediaGridGlobals } from './media-grid-dom';
/** Real hosts, list hooks, common picker, validator and domain receivers. Only transport/auth/layout are fixtures. */
export async function exerciseGeneratedVideoPickers(request: typeof fetch) {
    const bundle = await bundleClientFlow(`
 import React,{act,useState} from 'react';import{createRoot}from'react-dom/client';
 import{useUpscaleLibraryAssets}from'./src/components/tools/upscale/_hooks/useUpscaleLibraryAssets';
 import{useUpscaleSourceMedia}from'./src/components/tools/upscale/_hooks/useUpscaleSourceMedia';
 import{UpscaleLibraryModal}from'./src/components/tools/upscale/_components/UpscaleLibraryModal';
 import{DEFAULT_UPSCALE_COPY}from'./src/components/tools/upscale/_lib/upscale-workspace-copy';
 import{useAudioGeneratedVideos}from'./app/(core)/(workspace)/app/audio/_hooks/useAudioGeneratedVideos';
 import AudioWorkspace from './app/(core)/(workspace)/app/audio/AudioWorkspace';
 import{I18nProvider}from'./lib/i18n/I18nProvider';
 const noop=()=>{};
 function Upscale(){const library=useUpscaleLibraryAssets({user:'alice',mediaType:'video',libraryErrorCopy:'Failed'});
 const[source,setSource]=useState(null),[mediaUrl,setMediaUrl]=useState('');window.selected=source;
 const actions=useUpscaleSourceMedia({changeMediaType:noop,onSourceChange:noop,copy:DEFAULT_UPSCALE_COPY,locale:'en',mediaType:'video',mediaUrl,source,setSource,setMediaUrl,setLibraryModalOpen:library.setLibraryModalOpen,setError:noop,setMessage:noop,setPreviewMode:noop,setResult:noop,setUploading:noop});window.openPicker=library.openLibraryModal;
 return <UpscaleLibraryModal userId='alice' mediaType='video' open={library.libraryModalOpen} assets={library.visibleLibraryAssets} copy={DEFAULT_UPSCALE_COPY} error={library.libraryError} hasMore={library.libraryHasMore} isLoading={library.libraryLoading} isLoadingMore={library.libraryLoadingMore} onClose={()=>library.setLibraryModalOpen(false)} onLoadMore={library.loadMoreLibraryAssets} onRefresh={library.fetchLibraryAssets} onSelectAsset={actions.selectLibraryAsset} onSourceChange={source=>library.fetchLibraryAssets({source})} source={library.librarySource} sourceOptions={library.librarySourceOptions}/>;}
 function Facts(){const library=useAudioGeneratedVideos({user:{id:'alice'},open:true,loadErrorMessage:'Failed'});window.candidates=library.generatedVideos;return null;}
 const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<I18nProvider locale='en' dictionary={{}} fallback={{}}>{window.host==='upscale'?<Upscale/>:window.host==='facts'?<Facts/>:<AudioWorkspace/>}</I18nProvider>),unmount:()=>root.unmount()};`, {
        'next/navigation': `export const useSearchParams=()=>new URLSearchParams();export const usePathname=()=>'/app/audio';export const useRouter=()=>({replace(){}});`,
        '@/hooks/useRequireAuth': `export const useRequireAuth=()=>({user:{id:'alice'},loading:false});`,
        './AudioLatestRendersRail': `export default()=>null;`,
        './_components/audio-workspace-composer-surface': `import React from 'react';export const AudioWorkspaceComposerSurface=p=>{window.selected=p.sourceVideo;window.openPicker=p.onOpenGeneratedPicker;window.prepare=()=>{p.handlePackChange('cinematic');p.setPrompt('Soundtrack');};window.canGenerate=p.canGenerate;window.generationHint=p.generationHint;return null;};`,
        './_hooks/useAudioActiveJobPolling': `export const useAudioActiveJobPolling=()=>{};`,
        './_hooks/useAudioGenerationRunner': `export const useAudioGenerationRunner=p=>({generate(){throw Error('Generation prohibited');},quote:null,canSubmit:p.canGenerate});`,
        './_hooks/useAudioWorkspaceRestoration': `import{useRef}from'react';export const useAudioWorkspaceRestoration=()=>({manualWorkspaceOverrideRef:useRef(false)});`,
        '@/lib/supabaseClientLoader': `export const loadSupabaseClient=async()=>({auth:{getSession:async()=>({data:{session:{access_token:'fixture',user:{id:'alice'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}});`,
    });
    for (const host of ['audio', 'upscale'])
        for (const source of ['long', 'historical', 'unsaved']) {
            const dom = createClientFlowDom('/app/' + host), w = dom.window as any;
            Object.assign(w, mediaGridGlobals(w));
            w.fetch = request;
            w.host = host;
            w.eval(bundle);
            try {
                await w.fx.act(async () => w.fx.render());
                if (host === 'audio') await w.fx.act(async () => w.prepare());
                await w.fx.act(async () => w.openPicker());
                const id = source === 'long' ? 'output:unsaved-long' : source === 'unsaved' ? 'output:unsaved-out' : host === 'upscale' ? 'job:historical' : 'historical';
                const tile = () => [...w.document.querySelectorAll("[data-media-key]")].find(n => JSON.parse(n.getAttribute("data-media-key"))[0] === id)?.querySelector("input");
                for (let n = 0; n < 40 && !tile(); n++)
                    await w.fx.act(async () => new Promise(r => setTimeout(r, 10)));
                assert.ok(tile(), `${host} offers actual API ${source} candidate: ${w.document.body.textContent}; keys=${[...w.document.querySelectorAll("[data-media-key]")].map(n => n.getAttribute("data-media-key"))}`);
                assert.equal(w.document.querySelectorAll('video,audio').length, 0, 'opening candidates loads no AV reader');
                await w.fx.act(async () => tile().click());
                await w.fx.act(async () => w.document.querySelector('.app-picker-use').click());
                for (let n = 0; n < 40 && !w.selected; n++)
                    await w.fx.act(async () => new Promise(r => setTimeout(r, 10)));
                if (host === 'audio') {
                    assert.equal(w.canGenerate, source !== 'long', 'actual AudioWorkspace enforces 10s against the selected output');
                    if (source === 'long') assert.equal(w.generationHint, 'Video: up to 10 seconds');
                }
                assert.equal(w.selected?.jobId, source === 'long' ? 'unsaved' : source, `${host} actual domain receiver accepts ${source}`);
                assert.equal(w.selected.url, `https://media.test/${source}.mp4`);
                if (source !== 'historical') {
                    const outputId = source === 'long' ? 'unsaved-long' : 'unsaved-out';
                    assert.equal(w.selected.sourceOutputId, outputId);
                    assert.equal(w.selected.ref.outputId, outputId);
                    assert.equal(typeof w.selected.sourceRevision, 'string');
                    assert.equal(w.selected.durationSec, source === 'long' ? 14 : 6);
                    assert.equal(w.selected.width, source === 'long' ? 1080 : 1920);
                    assert.equal(w.selected.height, source === 'long' ? 1920 : 1080);
                    if (host === 'audio') {
                        assert.equal(w.selected.aspectRatio, source === 'long' ? '9:16' : '16:9');
                        assert.equal(w.selected.hasAudio, source !== 'long');
                    }
                }
                else {
                    assert.equal(w.selected.sourceOutputId, undefined);
                    assert.equal(w.selected.assetId, undefined);
                    assert.equal(w.selected.ref, undefined);
                }
            }
            finally {
                await w.fx.act(async () => w.fx.unmount());
                w.close();
            }
        }
    const factsDom = createClientFlowDom('/app/audio'), factsWindow = factsDom.window as any;
    Object.assign(factsWindow, mediaGridGlobals(factsWindow), { fetch: request, host: 'facts' });
    factsWindow.eval(bundle);
    try {
        await factsWindow.fx.act(async () => factsWindow.fx.render());
        for (let n = 0; n < 40 && !factsWindow.candidates?.length; n++)
            await factsWindow.fx.act(async () => new Promise(r => setTimeout(r, 10)));
        const unknown = factsWindow.candidates.find(v => v.sourceOutputId === 'unsaved-unknown');
        assert.ok(unknown);
        for (const fact of ['durationSec', 'aspectRatio', 'hasAudio', 'width', 'height'])
            assert.equal(unknown[fact], null, `Audio adapter retains unknown ${fact}`);
    } finally { await factsWindow.fx.act(async () => factsWindow.fx.unmount()); factsWindow.close(); }
}
