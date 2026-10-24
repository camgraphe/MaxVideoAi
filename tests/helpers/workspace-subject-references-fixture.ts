/** Actual shared Composer, reference owner and Kling builder; synthetic media only. */
export const workspaceSubjectReferencesFixtureSource = `
  import { useState } from 'react';
  import { createRoot } from 'react-dom/client';
  import { Composer } from './components/Composer';
  import { KlingElementsBuilder } from './components/KlingElementsBuilder';
  import { I18nProvider } from './lib/i18n/I18nProvider';
  const config = globalThis.fixtureConfig;
  function Fixture() {
    const [elements,setElements] = useState(config.elements);
    const [assets,setAssets] = useState(config.assets);
    const [prompt,setPrompt] = useState('Keep @Element1 and @image_1 in the scene.');
    return <I18nProvider locale="en" dictionary={{}} fallback={{}}>
      <main className="app-workspace-main" style={{maxWidth:1000,margin:'40px auto',padding:16}}>
        <p style={{fontSize:12,marginBottom:16}}>Local interaction fixture · synthetic media · no generation</p>
        <h1 style={{fontSize:22,marginBottom:16}}>Kling subject references</h1>
        <Composer density="workspace" engine={config.engine} prompt={prompt} onPromptChange={setPrompt} promptRequired
          assetFields={config.fields} assets={assets} price={null} currency="USD" isLoading={false}
          onAssetRemove={(field,index)=>setAssets(previous=>({...previous,[field.id]:previous[field.id].map((asset,slot)=>slot===index?null:asset)}))}
          subjectReferences={{hasSubjects:elements.length>1||elements.some(element=>Boolean(element.frontal||element.video||element.references.some(Boolean))),
            content:<KlingElementsBuilder elements={elements}
              onAddElement={()=>setElements(previous=>[...previous,{id:'added',frontal:null,video:null,references:[null,null,null]}])}
              onRemoveElement={id=>setElements(previous=>previous.filter(element=>element.id!==id))}
              onAddAsset={()=>{}} onRemoveAsset={(id,slot,index)=>setElements(previous=>previous.map(element=>element.id!==id?element:
                slot==='reference'?{...element,references:element.references.map((asset,i)=>i===index?null:asset)}:{...element,[slot]:null}))} />}}
        />
        <output data-fixture-state hidden>{JSON.stringify({elements,assets,prompt})}</output>
      </main>
    </I18nProvider>;
  }
  createRoot(document.getElementById('root')).render(<Fixture />);
`;
