import path from 'node:path';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

export async function mountToolFixture(contents: string, stubs: Record<string, string>, setup?: (window: any) => void) {
  const frontend = path.join(process.cwd(), 'frontend');
  const bundle = await build({
    absWorkingDir: frontend, bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic', write: false,
    define: { 'process.env.NODE_ENV': '"test"' }, loader: { '.css': 'empty' }, tsconfig: path.join(frontend, 'tsconfig.json'),
    plugins: [{ name: 'test-boundaries', setup(b) {
      b.onResolve({ filter: /.*/ }, a => a.path in stubs ? { path: a.path, namespace: 'stub' } : undefined);
      b.onLoad({ filter: /.*/, namespace: 'stub' }, a => ({ contents: stubs[a.path], loader: 'js', resolveDir: frontend }));
    } }],
    stdin: { loader: 'tsx', resolveDir: frontend, contents: `
      import React,{act,useState}from'react';import{createRoot}from'react-dom/client';
      window.IS_REACT_ACT_ENVIRONMENT=true;const noop=()=>{};${contents}
      const root=createRoot(document.getElementById('root'));
      window.fx={act,render:()=>root.render(<App/>),unmount:()=>root.unmount()};
    ` },
  });
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.invalid/app/tools/angle', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window as any;
  w.MessageChannel = class { port1 = { onmessage: () => {} }; port2 = { postMessage: () => setTimeout(() => this.port1.onmessage(), 0) }; };
  w.process = { env: {} }; w.framesSeen = []; w.requests = []; w.revoked = [];
  let blobId = 0;
  w.URL.createObjectURL = () => `blob:test-${++blobId}`;
  w.URL.revokeObjectURL = (url: string) => w.revoked.push(url);
  w.fetch = () => { throw Error('Unexpected network request'); };
  w.fixtureFetch = (url: string, init: unknown) => new Promise((resolve, reject) => w.requests.push({ url, init, resolve, reject }));
  setup?.(w);
  w.eval(bundle.outputFiles[0].text);
  await w.fx.act(async () => w.fx.render());
  return {
    w,
    render: () => w.fx.act(async () => w.fx.render()),
    act: (fn: () => unknown) => w.fx.act(fn),
    respond: (request: any, body: unknown, status = 200) => w.fx.act(async () => request.resolve({ ok: status < 400, status, json: async () => body })),
    close: async () => { await w.fx.act(async () => w.fx.unmount()); dom.window.close(); },
  };
}

export async function mountAngle(options: { userId?: string | null; loading?: boolean; storage?: Record<string, string> } = {}) {
  const stubs = {
    'next/navigation': "export const usePathname=()=>'/app/tools/angle';export const useSearchParams=()=>new URLSearchParams();",
    'next/link': "export default p=>p.children;",
    'swr': "export default()=>({data:{unitPriceCents:10}});",
    '@/hooks/useRequireAuth': "export const useRequireAuth=()=>window.auth;",
    '@/lib/i18n/I18nProvider': "export const useI18n=()=>({locale:'en',t:(_,fallback)=>fallback});",
    '@/lib/analytics-client': "export const dispatchAnalyticsEvent=()=>{};",
    '@/lib/client-image-upload': "export const prepareImageFileForUpload=file=>window.prepareUpload(file);",
    '@/components/HeaderBar': "export const HeaderBar=()=>null;",
    '@/components/AppSidebar': "export const AppSidebar=()=>null;",
    '@/components/library/ToolMediaHandoff.client': "export const ToolMediaHandoff=()=>null;",
    '@/lib/api': "const jobs=[];export const saveImageToLibrary=()=>{throw Error('unexpected save')};export const runAngleTool=()=>window.fixtureFetch('generation',{});export const useInfiniteJobs=()=>({stableJobs:jobs});",
    '@/lib/authFetch': "export const authFetch=(url,init)=>window.fixtureFetch(url,init);",
    './angle/_components/angle-auth-gate-modal': "export const AngleAuthGateModal=()=>null;",
    './angle/_components/angle-generation-settings-panel': "export const AngleGenerationSettingsPanel=p=>{window.settings=p;window.framesSeen.push({user:window.auth.user?.id,source:p.sourceImage?.url});return null};",
    './angle/_components/angle-image-library-modal': "export const AngleImageLibraryModal=p=>{window.library=p;return null};",
    './angle/_components/angle-output-panel': "export const AngleOutputPanel=p=>{window.outputs=p;return null};",
    './angle/_components/angle-recent-job-modal': "export const AngleRecentJobModal=()=>null;",
  };
  const auth = (id: string | null, loading = false) => ({ loading, user: id ? { id } : null, session: id ? { access_token: `token-${id}` } : null });
  const f = await mountToolFixture("import App from './src/components/tools/AngleWorkspace';", stubs, w => {
    w.auth = auth(options.userId === undefined ? 'A' : options.userId, options.loading);
    w.prepareUpload = async (file: File) => file;
    for (const [key, value] of Object.entries(options.storage ?? {})) w.localStorage.setItem(key, value);
  });
  return { ...f,
    auth: async (id: string | null, loading = false) => { f.w.auth = auth(id, loading); await f.render(); },
    choose: (id: string) => f.act(async () => f.w.library.onSelect({ id, url: `https://example.invalid/${id}.png` })),
    upload: async () => {
      let pending!: Promise<void>;
      await f.act(async () => { pending = f.w.settings.onFileSelect({ target: { files: [new f.w.File(['image'], 'A.png', { type: 'image/png' })], value: '' } }); });
      return { pending };
    },
  };
}
