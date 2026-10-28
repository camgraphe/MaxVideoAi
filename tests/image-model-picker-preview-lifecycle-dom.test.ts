import assert from 'node:assert/strict';
import test from 'node:test';
import { mountToolFixture } from './helpers/tool-selection-fixture';

// Keep the actual surface, selector, dialog, image picker hook, and preview dock.
// Only unrelated composer controls and Next's browser adapters are substituted.
const stubs = {
  'next/dynamic': "import React,{lazy,Suspense} from 'react';export default load=>{const Component=lazy(()=>load().then(value=>({default:value})));return props=>React.createElement(Suspense,{fallback:null},React.createElement(Component,props));};",
  'next/image': "import React from 'react';export default ({fill,priority,unoptimized,fetchPriority,...props})=>React.createElement('img',props);",
  './model-picker.module.css': 'export default {};',
  './prompt-assistance.module.css': 'export default {};',
  '@/components/Composer': 'export const Composer=()=>null;',
  '@/components/ImageAdvancedSettings': 'export const ImageAdvancedSettings=()=>null;',
  '@/components/ImageSettingsBar': 'export const ImageSettingsBar=()=>null;export const ImageCountControl=()=>null;',
  '@/lib/authFetch': 'export const authFetch=(url,init)=>window.fixtureFetch(url,init);',
};

const source = `
import {I18nProvider} from './lib/i18n/I18nProvider';
import {listFalEngines} from './src/config/falEngines';
import {ImageWorkspaceComposerSurface} from './app/(core)/(workspace)/app/image/_components/ImageWorkspaceComposerSurface';
import {useImageModelPicker} from './app/(core)/(workspace)/app/image/_hooks/useImageModelPicker';
import {DEFAULT_COPY} from './app/(core)/(workspace)/app/image/_lib/image-workspace-copy';
const engines=listFalEngines().filter(entry=>entry.id==='nano-banana-2').map(entry=>entry.engine);
const settings={mode:'t2i',numImages:1,resolution:'2k',aspectRatio:'1:1',quality:null,enableWebSearch:false,
  customImageWidth:'',customImageHeight:'',referenceImageCount:0,selectedReferenceCount:0,readyReferenceSizes:[]};
const setters=Object.fromEntries(['setAspectRatio','setBackground','setCustomImageHeight','setCustomImageWidth',
  'setEnableWebSearch','setError','setLimitGenerations','setMaskUrl','setMode','setNumImagesPreset',
  'setOutputFormat','setPrompt','setQuality','setResolutionPreset','setSeed','setSelectedPreviewImageIndex',
  'setStyle','setThinkingLevel','setWatermark'].map(key=>[key,noop]));
function Surface(){
  const [entry,setEntry]=useState(null);window.setPreviewEntry=setEntry;
  const picker=useImageModelPicker({engines,engineId:engines[0].id,accountId:'account-a',settings,apply:noop});
  return <ImageWorkspaceComposerSurface {...settings} {...setters} selectedEngineId={engines[0].id}
    engineCapsList={engines} selectedEngineCaps={engines[0]} modelPicker={picker.context} setEngineId={picker.select}
    resolvedCopy={DEFAULT_COPY} advancedSettingsTitle="Options" compositePreviewEntry={entry}
    selectedPreviewImageIndex={0} previewEntry={undefined} copiedUrl={null} currency="USD" estimatedCostAmount={0.06}
    composerError={null} composerReferenceAssets={{}} referenceAssetFields={[]} prompt="An authored image prompt"
    pendingGenerations={[]} statusMessage={null} imageCountOptions={[]} aspectRatioSelectOptions={[]}
    booleanSelectOptions={[]} backgroundSelectOptions={[]} outputFormatSelectOptions={[]} qualitySelectOptions={[]}
    resolutionSelectOptions={[]} styleSelectOptions={[]} thinkingLevelSelectOptions={[]}
    background={null} outputFormat={null} style={null} thinkingLevel={null} seed="" maskUrl=""
    limitGenerations={false} watermark={false} isInLibrary={false} isRemovingFromLibrary={false}
    isSavingToLibrary={false} isResolutionLocked={false} handleRun={noop} handleAddToLibrary={noop}
    handleCopy={noop} handleDownload={noop} handleEditSelectedPreview={noop} handleOpenHistoryEntry={noop}
    handleReferenceFile={noop} handleReferenceUrl={noop} handleRemoveFromLibrary={noop}
    handleRemoveReferenceSlot={noop} openLibraryForSlot={noop}/>;
}
function App(){return <I18nProvider locale="en" dictionary={{}} fallback={{}}><Surface/></I18nProvider>}
`;

test('image model picker keeps its open dialog and search while late history changes the preview', async () => {
  const f = await mountToolFixture(source, stubs, w => {
    Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', { value: () => [{ width: 100, height: 44 }] });
  });
  try {
    const document = f.w.document as Document;
    const trigger = document.querySelector<HTMLButtonElement>('.app-image-model-selector button[aria-haspopup="dialog"]');
    assert.ok(trigger);
    await f.act(async () => trigger.click());
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    assert.ok(dialog, 'the real selector opens before any history result arrives');
    assert.equal(trigger.getAttribute('aria-expanded'), 'true');
    const search = dialog.querySelector<HTMLInputElement>('input[type="search"]');
    assert.ok(search);
    await f.act(async () => {
      Object.getOwnPropertyDescriptor(f.w.HTMLInputElement.prototype, 'value')!.set!.call(search, 'nano');
      search.dispatchEvent(new f.w.Event('input', { bubbles: true }));
    });
    assert.equal(search.value, 'nano');
    const entry = {
      id: 'late-history', engineLabel: 'Nano Banana 2', prompt: 'A previous image', createdAt: 1,
      mode: 't2i', aspectRatio: '1:1', images: [{ url: 'https://example.invalid/original.png', width: 512, height: 512 }],
    };
    for (const [label, preview] of [
      ['first history response', entry],
      ['another history entry', { ...entry, id: 'another-history', prompt: 'Another previous image' }],
      ['return to empty preview', null],
    ] as const) {
      await f.act(async () => f.w.setPreviewEntry(preview));
      assert.equal(document.querySelector('[role="dialog"]'), dialog, `${label}: an open picker must survive preview replacement`);
      assert.equal(document.querySelector('.app-image-model-selector button[aria-haspopup="dialog"]'), trigger, `${label}: keep the same selector instance`);
      assert.equal(trigger.getAttribute('aria-expanded'), 'true', label);
      assert.equal(dialog.querySelector('input[type="search"]'), search, label);
      assert.equal(search.value, 'nano', `${label}: preserve the user's provisional search`);
    }
  } finally { await f.close(); }
});
