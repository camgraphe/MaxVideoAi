import assert from 'node:assert/strict';
import test from 'node:test';
import { mountToolFixture } from './helpers/tool-selection-fixture';

async function mount() {
  return mountToolFixture(`
    import{useUpscaleRecentActions}from'./src/components/tools/upscale/_hooks/useUpscaleRecentActions';
    import{useUpscalePreviewState}from'./src/components/tools/upscale/_hooks/useUpscalePreviewState';
    import{useUpscaleSourceMedia}from'./src/components/tools/upscale/_hooks/useUpscaleSourceMedia';
    import{UpscalePreviewCard}from'./src/components/tools/upscale/_components/UpscalePreviewCard';
    import{DEFAULT_UPSCALE_COPY}from'./src/components/tools/upscale/_lib/upscale-workspace-copy';
    window.group=id=>{const job={jobId:id,engineId:'real-esrgan',engineLabel:'Real ESRGAN',status:'completed',createdAt:'2026-10-18T10:00:00Z',renderIds:['https://example.invalid/'+id+'-output.png']};return{id,hero:{id:id+'-image-0',job},members:[]};};
    function App(){
      const[state,setState]=useState({mediaUrl:'https://example.invalid/current.png',source:{url:'https://example.invalid/current.png',width:100,height:100},previewMode:'source',result:null,mediaType:'image'});
      const set=k=>v=>setState(s=>({...s,[k]:v}));
      window.actions=useUpscaleRecentActions({copy:{saved:'Saved',saveFailed:'Failed'},hasSourcePreview:!!state.mediaUrl,locale:'en',mediaType:state.mediaType,setActiveRecentGroupId:set('active'),setEngineId:set('engine'),setError:set('error'),setMediaType:set('mediaType'),setMediaUrl:set('mediaUrl'),setMessage:set('message'),setMode:set('mode'),setOutputFormat:set('format'),setPreviewMode:set('previewMode'),setResult:set('result'),setSource:set('source'),setTargetResolution:set('resolution'),setUpscaleFactor:set('factor')});
      window.sourceActions=useUpscaleSourceMedia({changeMediaType:set('mediaType'),copy:{library:'Library'},locale:'en',mediaType:state.mediaType,mediaUrl:state.mediaUrl,setError:set('error'),setLibraryModalOpen:noop,setMediaUrl:set('mediaUrl'),setMessage:set('message'),setPreviewMode:set('previewMode'),setResult:set('result'),setSource:set('source'),setUploading:set('uploading'),source:state.source,onSourceChange:()=>window.actions.cancelRecentSelection?.()});
      window.observation=state;
      window.preview=useUpscalePreviewState({mediaType:state.mediaType,mediaUrl:state.mediaUrl,mode:'factor',previewMode:state.previewMode,previewZoom:'fit',result:state.result,source:state.source,upscaleFactor:2});
      window.changePreview=set('previewMode');
      return <UpscalePreviewCard {...window.preview} copy={DEFAULT_UPSCALE_COPY} previewZoom='fit' previewScrollerRef={{current:null}} onPreviewModeChange={set('previewMode')} onPreviewZoomChange={noop} onSave={noop} onDownload={noop} />;
    }`, {
    '@/lib/i18n/I18nProvider': "export const useI18n=()=>({locale:'en'});",
    '@/lib/authFetch': 'export const authFetch=(url,init)=>window.fixtureFetch(url,init);',
    '@/lib/api': "export const saveAssetToLibrary=()=>{throw Error('unexpected save')};",
  });
}
const details = (id: string) => ({ ok: true, settingsSnapshot: { mediaType: 'image', source: { mediaUrl: `https://example.invalid/${id}-source.png` } } });

test('Upscale keeps the last history click when job details arrive in reverse order', async () => {
  const f = await mount();
  try {
    let a!: Promise<void>, b!: Promise<void>;
    await f.act(async () => { a = f.w.actions.selectRecentUpscale(f.w.group('A')); b = f.w.actions.selectRecentUpscale(f.w.group('B')); });
    await f.respond(f.w.requests[1], details('B')); await b;
    await f.respond(f.w.requests[0], details('A')); await a;
    assert.equal(f.w.observation.active, 'B');
    assert.equal(f.w.observation.mediaUrl, 'https://example.invalid/B-source.png');
    assert.equal(f.w.observation.result.jobId, 'B');
    assert.equal(f.w.preview.compareEnabled, true);
  } finally { await f.close(); }
});

for (const status of [200, 500]) {
  test(`Upscale shows only the historical result when its source cannot be recovered (HTTP ${status})`, async () => {
    const f = await mount();
    try {
      let pending!: Promise<void>;
      await f.act(async () => { pending = f.w.actions.selectRecentUpscale(f.w.group('legacy')); });
      await f.respond(f.w.requests[0], { ok: status === 200 }, status); await pending;
      assert.equal(f.w.observation.mediaUrl, '');
      assert.equal(f.w.observation.source, null);
      assert.equal(f.w.preview.compareEnabled, false);
      assert.equal(f.w.preview.activePreviewMode, 'result');
      assert.equal(f.w.preview.resultPreviewUrl, 'https://example.invalid/legacy-output.png');
    } finally { await f.close(); }
  });
}

test('a manual Upscale library choice invalidates pending history restoration', async () => {
  const f = await mount();
  try {
    let pending!: Promise<void>;
    await f.act(async () => { pending = f.w.actions.selectRecentUpscale(f.w.group('A')); });
    await f.act(async () => f.w.sourceActions.selectLibraryAsset({ id: 'manual', url: 'https://example.invalid/manual.png', kind: 'image', width: 100, height: 100 }));
    await f.respond(f.w.requests[0], details('A')); await pending;
    assert.equal(f.w.observation.mediaUrl, 'https://example.invalid/manual.png');
    assert.equal(f.w.observation.result, null);
    assert.equal(f.w.requests[0].init.signal.aborted, true);
  } finally { await f.close(); }
});

test('Upscale aborts history hydration when the account session unmounts', async () => {
  const f = await mount();
  try {
    let pending!: Promise<void>;
    await f.act(async () => { pending = f.w.actions.selectRecentUpscale(f.w.group('A')); });
    await f.act(async () => f.w.fx.unmount());
    await f.respond(f.w.requests[0], details('A')); await pending;
    assert.equal(f.w.requests[0].init?.signal?.aborted, true);
  } finally { await f.close(); }
});

for (const action of ['original-control', 'stale-source-mode'] as const) {
  test(`Upscale never presents a sample as a missing historical original: ${action}`, async () => {
    const f = await mount();
    try {
      let pending!: Promise<void>;
      await f.act(async () => { pending = f.w.actions.selectRecentUpscale(f.w.group('legacy')); });
      await f.respond(f.w.requests[0], { ok: true }); await pending;
      if (action === 'original-control') {
        const original = Array.from(f.w.document.querySelectorAll('button')).find((button: any) => button.textContent === 'Original') as HTMLButtonElement;
        assert.ok(original); assert.equal(original.disabled, true);
        await f.act(async () => original.click());
      } else {
        await f.act(async () => f.w.changePreview('source'));
      }
      assert.equal(f.w.preview.activePreviewMode, 'result');
      assert.deepEqual(Array.from(f.w.document.querySelectorAll('img'), (image: any) => image.src), ['https://example.invalid/legacy-output.png']);
    } finally { await f.close(); }
  });
}
