import assert from 'node:assert/strict';
import test from 'node:test';
import { mountToolFixture } from './helpers/tool-selection-fixture';

const stubs = {
  'next/dynamic': "import React,{lazy,Suspense} from 'react';export default load=>{const Component=lazy(()=>load().then(value=>({default:value})));return props=>React.createElement(Suspense,{fallback:null},React.createElement(Component,props));};",
  'next/image': "import React from 'react';export default ({fill,priority,unoptimized,fetchPriority,...props})=>React.createElement('img',props);",
  './model-picker.module.css': 'export default {};',
  './prompt-assistance.module.css': 'export default {};',
  // Retain the actual surface, options button, lazy advanced panel and selectors.
  // The unrelated prompt/quote shell renders its supplied controls unchanged.
  '@/components/Composer': "import React from 'react';export const Composer=({optionsControl,extraFields})=>React.createElement('section',null,optionsControl,extraFields);",
  '@/components/ui/EngineSelect': 'export const EngineSelect=()=>null;',
  '@/components/ImageSettingsBar': 'export const ImageSettingsBar=()=>null;export const ImageCountControl=()=>null;',
};

for (const field of ['complexity', 'background'] as const) {
  test(`image options remain reachable when ${field} is the only advanced field`, async () => {
    const fixture = await mountToolFixture(`
      import {I18nProvider} from './lib/i18n/I18nProvider';
      import {ImageWorkspaceComposerSurface} from './app/(core)/(workspace)/app/image/_components/ImageWorkspaceComposerSurface';
      import {DEFAULT_COPY} from './app/(core)/(workspace)/app/image/_lib/image-workspace-copy';
      function Surface(){
        const [complexity,setComplexity]=useState('high');
        const [background,setBackground]=useState('auto');
        return <><output data-current-settings>{JSON.stringify({complexity,background})}</output>
          <ImageWorkspaceComposerSurface selectedEngineId="gpt-image-2-6-flare"
            engineCapsList={[]} selectedEngineCaps={{id:'gpt-image-2-6-flare'}}
            mode="t2i" prompt="An image" numImages={1} quality="high" resolution="1024x1024"
            resolvedCopy={DEFAULT_COPY} advancedSettingsTitle="Advanced settings"
            compositePreviewEntry={null} pendingGenerations={[]} composerReferenceAssets={{}}
            referenceAssetFields={[]} estimatedCostAmount={0.10} currency="USD"
            showComplexityControl={${field === 'complexity'}} showBackgroundControl={${field === 'background'}}
            complexity={complexity} setComplexity={setComplexity}
            background={background} setBackground={setBackground}
            complexitySelectOptions={[{value:'low',label:'Low'},{value:'medium',label:'Medium'},{value:'high',label:'High'}]}
            backgroundSelectOptions={[{value:'auto',label:'Auto'},{value:'opaque',label:'Opaque'}]}
          /></>;
      }
      function App(){return <I18nProvider locale="en" dictionary={{}} fallback={{}}><Surface/></I18nProvider>}
    `, stubs);
    try {
      const document = fixture.w.document as Document;
      const toggle = document.querySelector<HTMLButtonElement>('.app-options-button');
      assert.ok(toggle, 'a supported advanced setting must have an accessible options toggle');
      assert.equal(document.querySelector('label'), null, 'advanced fields stay deferred while closed');
      await fixture.act(async () => toggle.click());
      const label = Array.from(document.querySelectorAll('label')).find(element =>
        element.textContent?.includes(field === 'complexity' ? 'Planning complexity' : 'Background'));
      assert.ok(label, 'opening options renders the supported field through the lazy wrapper');
      const trigger = label.querySelector<HTMLButtonElement>('button');
      assert.ok(trigger);
      assert.equal(trigger.textContent?.trim(), field === 'complexity' ? 'High' : 'Auto');
      await fixture.act(async () => trigger.click());
      const choice = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="option"]')).find(element =>
        element.textContent?.trim() === (field === 'complexity' ? 'Low' : 'Opaque'));
      assert.ok(choice);
      await fixture.act(async () => choice.click());
      assert.deepEqual(JSON.parse(document.querySelector('[data-current-settings]')!.textContent!),
        field === 'complexity' ? { complexity: 'low', background: 'auto' } : { complexity: 'high', background: 'opaque' });
      await fixture.act(async () => toggle.click());
      await fixture.act(async () => toggle.click());
      assert.equal(label.isConnected, false, 'closed fields unmount');
      assert.match(document.querySelector('label')!.textContent!, field === 'complexity' ? /Low/ : /Opaque/);
    } finally { await fixture.close(); }
  });
}

for (const locale of ['en', 'fr', 'es']) test(`raster options expose compression and explain automatic quotes in ${locale}`, async () => {
  const fixture = await mountToolFixture(`
    import {I18nProvider} from './lib/i18n/I18nProvider';
    import {ImageWorkspaceComposerSurface} from './app/(core)/(workspace)/app/image/_components/ImageWorkspaceComposerSurface';
    import {DEFAULT_COPY,mergeCopy} from './app/(core)/(workspace)/app/image/_lib/image-workspace-copy';
    import messages from './messages/${locale}.json';
    const copy=mergeCopy(DEFAULT_COPY,messages.workspace.image);window.expectedCompressionCopy=copy.composer;
    function Surface(){const [outputCompression,setOutputCompression]=useState(0);
      return <ImageWorkspaceComposerSurface selectedEngineId="gpt-image-2-6-flare"
        engineCapsList={[]} selectedEngineCaps={{id:'gpt-image-2-6-flare'}}
        mode="t2i" prompt="An image" numImages={1} quality="auto" resolution="auto"
        resolvedCopy={copy} advancedSettingsTitle="Options" compositePreviewEntry={null}
        pendingGenerations={[]} composerReferenceAssets={{}} referenceAssetFields={[]}
        estimatedCostAmount={1} currency="USD" outputFormat="webp"
        showOutputCompressionControl outputCompression={outputCompression} setOutputCompression={setOutputCompression} />;
    }
    function App(){return <I18nProvider locale="${locale}" dictionary={{}} fallback={{}}><Surface/></I18nProvider>}
  `, stubs);
  try {
    const document = fixture.w.document as Document;
    const copy = fixture.w.expectedCompressionCopy;
    assert.ok(document.body.textContent?.includes(copy.gpt26AutoQuoteHint), 'automatic-price explanation is visible before opening options');
    const toggle = document.querySelector<HTMLButtonElement>('.app-options-button');
    assert.ok(toggle, 'compression alone exposes the options button');
    await fixture.act(async () => toggle.click());
    const label = Array.from(document.querySelectorAll('label')).find(element => element.textContent?.includes(copy.outputCompressionLabel));
    assert.ok(label);
    assert.ok(label.textContent?.includes(copy.outputCompressionHint));
    const input = label.querySelector<HTMLInputElement>('input');
    assert.ok(input);
    assert.equal(input.value, '0'); assert.equal(input.min, '0'); assert.equal(input.max, '100'); assert.equal(input.step, '1');
  } finally { await fixture.close(); }
});
