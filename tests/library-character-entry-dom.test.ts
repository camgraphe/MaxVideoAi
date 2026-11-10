import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';
const bundle = bundleClientFlow(`import React,{act}from'react';import{createRoot}from'react-dom/client';import{useCharacterLibraryEntry}from'./src/components/tools/character-builder/_hooks/useCharacterLibraryEntry';const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;function Entry(){useCharacterLibraryEntry({...window.props,openCharacter:async id=>window.opened.push(id)});return null;}window.fx={act,render:()=>root.render(<Entry/>),unmount:()=>root.unmount()};`, {});
test('saved character entry waits for restoration and is consumed once without reopening after navigation', async () => {
  for (const interrupted of [false, true]) {
    const dom = createClientFlowDom('/app/tools/character-builder?tab=characters&character=42'), w = dom.window as any;
    w.props = { characterId: '42', hydrated: false, active: true }; w.opened = [];
    w.eval(await bundle);
    try {
      await w.fx.act(async () => w.fx.render()); assert.deepEqual([...w.opened], []);
      if (interrupted) { w.props.active = false; await w.fx.act(async () => w.fx.render()); }
      w.props.hydrated = true; w.props.active = true; await w.fx.act(async () => w.fx.render());
      await w.fx.act(async () => w.fx.render());
      assert.deepEqual([...w.opened], interrupted ? [] : ['42']);
    } finally { await w.fx.act(async () => w.fx.unmount()); w.close(); }
  }
});
