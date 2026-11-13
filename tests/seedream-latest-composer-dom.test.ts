import assert from 'node:assert/strict';
import test from 'node:test';
import { mountToolFixture } from './helpers/tool-selection-fixture';

// Keep the real picker, settings controls, schema effects and submission hook.
// Only browser adapters, the current-price fixture and the outbound API are replaced.
const stubs = {
  'next/dynamic': "import React,{lazy,Suspense}from'react';export default load=>{const C=lazy(()=>load().then(value=>({default:value})));return props=>React.createElement(Suspense,{fallback:null},React.createElement(C,props));};",
  'next/image': "import React from'react';export default({fill,priority,unoptimized,fetchPriority,...props})=>React.createElement('img',props);",
  './model-picker.module.css': 'export default {};',
  '@/lib/last-known': "export const readLastKnownUserId=()=> 'fixture-owner';",
  '@/lib/supabaseClient': "export const supabase={auth:{getSession:async()=>({data:{session:{access_token:'offline-session'}}})}};",
  '@/lib/authFetch': "export const authFetch=async(url,init)=>{window.estimates.push({url,body:JSON.parse(init.body)});return{ok:true,json:async()=>({ok:true,pricing:{totalCents:20,currency:'USD'}})}};",
  '@/lib/api': "export const runImageGeneration=async(body,pricing,auth)=>{window.submissions.push({body,pricing,auth});return{jobId:'offline-generation',images:[{url:'https://fixture.invalid/output.png',width:2048,height:2048}]}};",
};

const source = `
import {I18nProvider} from './lib/i18n/I18nProvider';
import {EngineSelect} from './src/components/ui/EngineSelect';
import {ImageSettingsBar} from './components/ImageSettingsBar';
import {ImageAdvancedSettings} from './components/ImageAdvancedSettings';
import {listFalEngines} from './src/config/falEngines';
import {useImageComposerValues} from './app/(core)/(workspace)/app/image/_hooks/useImageComposerValues';
import {useImageSettingsFields} from './app/(core)/(workspace)/app/image/_hooks/useImageSettingsFields';
import {useImageModelPicker} from './app/(core)/(workspace)/app/image/_hooks/useImageModelPicker';
import {useImageGenerationRunner} from './app/(core)/(workspace)/app/image/_hooks/useImageGenerationRunner';
import {getReferenceConstraints} from './lib/image/inputSchema';
import {DEFAULT_COPY} from './app/(core)/(workspace)/app/image/_lib/image-workspace-copy';
const entries=listFalEngines().filter(entry=>['gpt-image-2-6-flare','seedream-5-5','seedream-5-0-flash'].includes(entry.id));
const engines=entries.map(entry=>entry.engine);
const sources=Array.from({length:10},(_,index)=>'https://fixture.invalid/source-'+index+'.png');
function Surface(){
  const values=useImageComposerValues('gpt-image-2-6-flare');
  const entry=entries.find(entry=>entry.id===values.engineId);
  const fields=useImageSettingsFields({...values,selectedEngineCaps:entry.engine,resolvedCopy:DEFAULT_COPY});
  const [error,setError]=useState(null),[status,setStatus]=useState(null),[localHistory,setLocalHistory]=useState([]),[pending,setPendingGroups]=useState([]);
  const references=values.mode==='i2i'?sources:[];
  const picker=useImageModelPicker({engines,engineId:values.engineId,accountId:'fixture-owner',
    settings:{...values,referenceImageCount:references.length,selectedReferenceCount:references.length,
      referenceIndices:references.map((_,index)=>index),readyReferenceSizes:references.map(()=>({width:1024,height:1024}))},
    apply:(id,settings)=>{values.setEngineId(id);for(const[key,value]of Object.entries(settings)){const setter=values['set'+key[0].toUpperCase()+key.slice(1)];if(setter)setter(value);}}});
  const run=useImageGenerationRunner({...values,selectedEngine:{id:entry.id,name:entry.marketingName,engineCaps:entry.engine},
    pricingSnapshot:{totalCents:20,currency:'USD'},resolvedCopy:DEFAULT_COPY,
    readyReferenceUrls:references,combinedReferenceUrls:references,readyReferenceSizes:references.map(()=>({width:1024,height:1024})),
    referenceMinRequired:getReferenceConstraints(entry.engine,values.mode).min,selectedCharacterReferences:[],
    hasAspectRatioField:!!fields.aspectRatioField,hasBackgroundField:!!fields.backgroundField,
    hasOutputFormatField:!!fields.outputFormatField,hasQualityField:!!fields.qualityField,
    hasEnableWebSearchField:!!fields.enableWebSearchField,hasLimitGenerationsField:!!fields.limitGenerationsField,
    hasMaskUrlField:!!fields.maskUrlField,hasSeedField:!!fields.seedField,hasStyleField:!!fields.styleField,
    hasThinkingLevelField:!!fields.thinkingLevelField,hasComplexityField:!!fields.complexityField,hasWatermarkField:!!fields.watermarkField,
    mutateJobs:async()=>{},setAuthModalOpen:noop,setError,setLocalHistory,setPendingGroups,
    setSelectedPreviewEntryId:noop,setSelectedPreviewImageIndex:noop,setStatusMessage:setStatus});
  return <>
    <EngineSelect engines={engines} engineId={values.engineId} onEngineChange={picker.select}
      mode={values.mode} onModeChange={values.setMode} modeOptions={['t2i','i2i']} showModeSelect={false} picker={picker.context}/>
    <form onSubmit={run}>
      <label>Operation<select aria-label="Operation" value={values.mode} onChange={event=>values.setMode(event.target.value)}><option value="t2i">Generate</option><option value="i2i">Edit</option></select></label>
      <label>Prompt<textarea aria-label="Prompt" value={values.prompt} onChange={event=>values.setPrompt(event.target.value)}/></label>
      <ImageSettingsBar resolution={{value:values.resolution,options:fields.resolutionSelectOptions,onChange:values.setResolution}}
        outputFormat={{value:values.outputFormat,options:fields.outputFormatSelectOptions,onChange:values.setOutputFormat}}/>
      <ImageAdvancedSettings title="Image options" background={fields.showBackgroundControl?{label:'Background',value:values.background,options:fields.backgroundSelectOptions,onChange:values.setBackground}:undefined}/>
      <button type="submit">Generate image</button>
    </form>
    <output data-current>{JSON.stringify({modelId:values.engineId,resolution:values.resolution,outputFormat:values.outputFormat,background:values.background,numImages:values.numImages,referenceCount:references.length,error,status,completed:localHistory.length})}</output>
  </>;
}
function App(){return <I18nProvider locale="en" dictionary={{}} fallback={{}}><Surface/></I18nProvider>}
`;

for (const model of [{ id: 'seedream-5-5', label: 'Seedream 5.5', format: 'png' }, { id: 'seedream-5-0-flash', label: 'Seedream 5.0 Flash', format: 'jpeg' }]) {
  test(`${model.label} is selectable and its real image controls reach a single-output submission`, async () => {
    const f = await mountToolFixture(source, stubs, window => {
      window.estimates = [];
      window.submissions = [];
      window.HTMLElement.prototype.scrollIntoView = () => {};
      Object.defineProperty(window.HTMLElement.prototype, 'getClientRects', { value: () => [{ width: 100, height: 44 }] });
    });
    try {
      const document = f.w.document as Document;
      const current = () => JSON.parse(document.querySelector('[data-current]')!.textContent!);
      const button = (text: string) => Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.trim() === text);
      const chooseOption = async (name: string) => {
        const option = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="option"]')).find(option => option.textContent?.trim().toLowerCase().endsWith(name.toLowerCase()));
        assert.ok(option, `Expected visible ${name} setting`);
        await f.act(async () => option.click());
      };
      const mode = document.querySelector<HTMLSelectElement>('select[aria-label="Operation"]')!;
      const prompt = document.querySelector<HTMLTextAreaElement>('textarea')!;
      await f.act(async () => {
        mode.value = 'i2i'; mode.dispatchEvent(new f.w.Event('change', { bubbles: true }));
        Object.getOwnPropertyDescriptor(f.w.HTMLTextAreaElement.prototype, 'value')!.set!.call(prompt, 'Keep the ten products; replace only the background.');
        prompt.dispatchEvent(new f.w.Event('input', { bubbles: true }));
      });
      const format = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.includes('File format:'));
      assert.ok(format);
      await f.act(async () => format.click());
      await chooseOption('webp');
      assert.equal(current().outputFormat, 'webp');

      const trigger = document.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]');
      assert.ok(trigger);
      await f.act(async () => trigger.click());
      const allModels = button('All models');
      if (allModels) await f.act(async () => allModels.click());
      const family = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button[aria-expanded="false"]')).find(button => button.textContent?.startsWith('Seedream'));
      if (family) await f.act(async () => family.click());
      const choose = document.querySelector<HTMLButtonElement>(`[data-model-id="${model.id}"] button[aria-label="Choose ${model.label}"]`);
      assert.ok(choose, `${model.label} is discoverable in the actual model picker: ${document.querySelector('[role="dialog"]')?.textContent}`);
      assert.equal(choose.getAttribute('aria-disabled'), 'false');
      await f.act(async () => choose.click());
      assert.equal(document.querySelector('[role="dialog"]'), null);
      assert.equal(current().modelId, model.id);
      assert.equal(current().resolution, '2K', 'The unsupported prior raster uses the authored new-model default.');
      assert.equal(current().outputFormat, model.format, 'The unsupported prior WebP uses the authored encoding default.');
      assert.equal(current().numImages, 1);
      assert.equal(current().referenceCount, 10);

      if (model.id === 'seedream-5-5') {
        const options = button('Image options');
        assert.ok(options);
        await f.act(async () => options.click());
        const background = Array.from(document.querySelectorAll('label')).find(label => label.textContent?.includes('Background'))?.querySelector<HTMLButtonElement>('button');
        assert.ok(background);
        await f.act(async () => background.click());
        await chooseOption('transparent');
        assert.equal(current().background, 'transparent');
      }
      const submit = button('Generate image');
      assert.ok(submit);
      await f.act(async () => submit.click());
      assert.equal(current().error, null);
      assert.equal(f.w.submissions.length, 1, 'The intercepted API is called once; no provider or payment API is used.');
      const { body, auth } = f.w.submissions[0];
      assert.equal(body.engineId, model.id);
      assert.equal(body.mode, 'i2i');
      assert.equal(body.resolution, '2K');
      assert.equal(body.outputFormat, model.format);
      assert.equal(body.numImages, 1);
      assert.equal(body.imageUrls.length, 10);
      assert.deepEqual(Array.from(body.imageUrls), Array.from({ length: 10 }, (_, index) => `https://fixture.invalid/source-${index}.png`));
      assert.equal(body.background, model.id === 'seedream-5-5' ? 'transparent' : undefined);
      assert.equal(auth.accessToken, 'offline-session');
      assert.equal(current().completed, 1);
    } finally { await f.close(); }
  });
}
