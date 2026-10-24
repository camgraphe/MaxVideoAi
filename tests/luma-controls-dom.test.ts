import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';
const bundle = bundleClientFlow(`
import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SettingsGenericAdvancedFields} from './components/settings-controls/settings-control-generic-fields';
import {getFalEngineById} from './src/config/falEngines';
import {effectiveLumaEditValues} from './src/lib/luma-edit-controls';
const fields=getFalEngineById('luma-ray-3-2').engine.inputSchema.optional.filter(field=>field.id.startsWith('edit_')&&!field.id.includes('keyframe')).map(field=>({field,required:false}));
function Main(){const [values,setValues]=useState({edit_strength:'adhere_1',edit_face:true});window.probe={values,effective:effectiveLumaEditValues(values)};return <SettingsGenericAdvancedFields fields={fields} values={values} onChange={(field,value)=>setValues(old=>({...old,[field.id]:value}))}/>}
const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<Main/>),unmount:()=>root.unmount()};`, {});
test('manual strength and face controls coexist; automatic hides but retains values and Off is explicit', async () => {
  const dom=createClientFlowDom('/app');const w=dom.window as any;
  try {
    w.eval(await bundle);await w.fx.act(async()=>w.fx.render());
    const select=(value:string)=>Array.from(w.document.querySelectorAll('select')).find((e:any)=>e.value===value) as HTMLSelectElement;
    const change=async(element:HTMLSelectElement,value:string)=>w.fx.act(async()=>{element.value=value;element.dispatchEvent(new w.Event('change',{bubbles:true}));});
    assert.ok(select('adhere_1'));assert.ok(select('manual'));assert.ok(select('on'));
    await change(select('on'),'off');assert.equal(w.probe.effective.edit_face_mode,'off');
    await change(select('manual'),'automatic');assert.equal(select('adhere_1'),undefined);
    assert.equal(w.probe.values.edit_strength,'adhere_1');assert.equal(w.probe.values.edit_face_mode,'off');
    assert.equal(w.probe.effective.edit_strength,undefined);assert.equal(w.probe.effective.edit_face_mode,undefined);
    await change(select('automatic'),'manual');assert.ok(select('adhere_1'));assert.ok(select('off'));
  } finally {if(w.fx)await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});
