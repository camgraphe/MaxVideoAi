import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';

test('finishing recovery renders localized safe causes and confirms only settled refunds', async () => {
  const script = await bundleClientFlow(`
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {FinishingSession} from './src/components/tools/FinishingWorkspace';
    window.root=createRoot(document.getElementById('root'));
    window.root.render(<FinishingSession auth={{loading:false,user:{id:'owner'}}} toolId="denoise" releasedQualities={['standard']}/>);
  `, {
    '@/hooks/useRequireAuth': 'export const useRequireAuth=()=>({loading:false,user:null});',
    '@/lib/i18n/I18nProvider': 'export const useI18n=()=>({locale:window.fixtureLocale});',
    '@/lib/authFetch': `export const authFetch=async()=>Response.json({ok:true,status:'failed',errorCode:window.fixtureCode,refunded:window.fixtureRefunded,error:'https://private.example/?token=secret'});`,
    '@/components/library/ToolMediaHandoff.client': 'export const ToolMediaHandoff=()=>null;',
    '@/components/library/MediaDestinationActions.client': 'export const MediaDestinationActions=()=>null;',
    './ToolboxVideoPreview': 'export const ToolboxVideoPreview=()=>null;',
    './ToolWorkbench': 'export const ToolWorkbench=({children})=><main>{children}</main>;export const ToolSourceInput=()=>null;export const ToolProcessing=()=>null;export const ToolAuthNotice=()=>null;',
    './upscale/_hooks/useUpscaleLibraryAssets': 'export const useUpscaleLibraryAssets=()=>({visibleLibraryAssets:[],librarySourceOptions:[]});',
    './upscale/_components/UpscaleLibraryModal': 'export const UpscaleLibraryModal=()=>null;',
  });
  for (const [locale, cause, refund] of [['fr', /fournisseur a bloqué/, /recrédité à votre portefeuille/], ['en', /provider blocked/, /refunded to your wallet/], ['es', /proveedor bloqueó/, /devuelto a tu monedero/]] as const) {
    for (const refunded of [false, true]) {
      const dom = createClientFlowDom('/app/tools/denoise');
      Object.assign(dom.window, { Response, fixtureLocale: locale, fixtureCode: 'TOOL_CONTENT_BLOCKED', fixtureRefunded: refunded });
      dom.window.sessionStorage.setItem('toolbox:pending:owner:denoise', 'tool_finish_stored');
      dom.window.eval(script);
      try {
        for (let i=0;i<100&&!dom.window.document.querySelector('[role=alert]');i++) await new Promise(resolve=>setTimeout(resolve,10));
        const text = dom.window.document.querySelector('[role=alert]')?.textContent ?? '';
        assert.match(text, cause);
        assert.equal(refund.test(text), refunded);
        assert.doesNotMatch(text, /private\.example|token=secret|TOOL_CONTENT_BLOCKED/);
        assert.equal(dom.window.sessionStorage.getItem('toolbox:pending:owner:denoise'), null);
      } finally { (dom.window as unknown as {root:{unmount():void}}).root.unmount(); dom.window.close(); }
    }
  }
});
