import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';
import { build } from 'esbuild';
import tailwindConfig from '../../frontend/tailwind.config';

export const workspaceReferenceFixtureSource = `
  import { useState } from 'react';
  import { createRoot } from 'react-dom/client';
  import { Composer } from './components/Composer';
  import { I18nProvider } from './lib/i18n/I18nProvider';
  const config = globalThis.fixtureConfig;
  function Fixture() {
    const [assets,setAssets] = useState(config.assets);
    const [prompt,setPrompt] = useState(config.prompt ?? 'Keep this visible.');
    globalThis.updateReferences = setAssets;
    return <I18nProvider locale={config.locale ?? 'fr'} dictionary={config.dictionary ?? {}} fallback={{}}>
      <main className="app-workspace-main" style={{maxWidth:1000,margin:'40px auto',padding:16}}>
        <p style={{fontSize:12,marginBottom:16}}>Local interaction fixture · synthetic media · no generation</p>
        <h1 style={{fontSize:22,marginBottom:16}}>{config.engine.label}</h1>
        <Composer density="workspace" engine={config.engine} caps={config.caps} activeManualMode={config.mode}
          assistance={config.assistance} promptField={config.promptField} prompt={prompt} onPromptChange={setPrompt} promptRequired={false}
          assetFields={config.fields} assets={assets} price={1.23} currency="USD" isLoading={false}
          onAssetRemove={(field,index)=>setAssets(previous=>({...previous,[field.id]:previous[field.id].map((asset,slot)=>slot===index?null:asset)}))}
          onGenerate={()=>{globalThis.submissions=(globalThis.submissions??0)+1;}} />
      </main>
    </I18nProvider>;
  }
  createRoot(document.getElementById('root')).render(<Fixture />);
`;

/** Real Composer/CSS with a local synthetic-data boundary; usable by tests and manual preview. */
export async function startWorkspaceReferenceFixture(options: { source?: string; config?: unknown; assistancePreview?: boolean; assistanceLive?: boolean; perception?:boolean; hostModules?: Record<string, string> } = {}) {
  const frontend = join(process.cwd(), 'frontend');
  const requireFrontend = createRequire(join(frontend, 'package.json'));
  const source = options.source ?? workspaceReferenceFixtureSource;
  const bundle = await build({ stdin: { contents: source, loader: 'tsx', resolveDir: frontend },
    outdir: '/reference-fixture', external: ['/assets/*'], write: false, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', minify: true,
    tsconfig: join(frontend, 'tsconfig.json'), define: { 'process.env.NODE_ENV': JSON.stringify(options.assistancePreview ? 'development' : 'production'), 'process.env.NEXT_PUBLIC_PROMPT_ASSISTANCE_PERCEPTION': JSON.stringify(options.perception?'1':''), 'process.env.NEXT_PUBLIC_PROMPT_ASSISTANCE_LIVE': JSON.stringify(options.assistanceLive ? '1' : ''), 'process.env.NEXT_PUBLIC_PROMPT_ASSISTANCE_PREVIEW': JSON.stringify(options.assistancePreview ? '1' : '') },
    plugins: options.hostModules ? [{ name: 'workspace-host-boundaries', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => options.hostModules?.[args.path] !== undefined ? { path: args.path, namespace: 'workspace-host' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'workspace-host' }, args => ({ contents: options.hostModules![args.path], loader: 'tsx', resolveDir: frontend }));
    } }] : [],
  });
  const styles = await Promise.all(['app/globals.css', 'src/styles/tokens.css', 'src/styles/skeleton.css', 'src/styles/app-experience.css', 'src/styles/app-shell.css'].map(path => readFile(join(frontend, path), 'utf8')));
  const css = await requireFrontend('postcss')([requireFrontend('tailwindcss')({ ...tailwindConfig, content: [
    ...tailwindConfig.content.map(pattern => join(frontend, pattern)), { raw: source, extension: 'tsx' },
  ] })]).process(styles.join('\n').replace(/@(?:import|config)[^;]+;/g, ''), { from: join(frontend, 'app/globals.css') });
  const files = new Map(bundle.outputFiles.map(file => [basename(file.path), file.text]));
  files.set('styles.css', css.css + bundle.outputFiles.filter(file => file.path.endsWith('.css')).map(file => file.text).join('\n'));
  const script = [...files.keys()].find(name => name.endsWith('.js'))!;
  const server = createServer((request, response) => {
    const name = basename(new URL(request.url ?? '/', 'http://fixture').pathname);
    if (files.has(name)) {
      response.writeHead(200, { 'content-type': name.endsWith('.css') ? 'text/css' : 'text/javascript' }); response.end(files.get(name));
    } else if (/\.(?:mp4|wav|mp3)$/.test(name)) {
      response.writeHead(404); response.end();
    } else if (/\.svg$/.test(name)) {
      response.writeHead(200, { 'content-type': 'image/svg+xml' });
      response.end(name.includes('portrait')
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="280"><rect width="160" height="280" fill="#c5a2a3"/><circle cx="80" cy="105" r="45" fill="#f4d8c7"/><path d="M20 280v-45a60 60 0 0 1 120 0v45" fill="#4f4763"/></svg>'
        : `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="${name.includes('second') ? '#a3c8b4' : '#a9c7de'}"/><circle cx="175" cy="40" r="22" fill="#fae4a6"/><path d="M0 160 75 60 155 160M100 160 180 80 240 160" fill="${name.includes('second') ? '#39785c' : '#456987'}"/></svg>`);
    } else {
      response.writeHead(200, { 'content-type': 'text/html' });
      const init = options.config ? `<script>globalThis.fixtureConfig=${JSON.stringify(options.config).replace(/</g, '\\u003c')}</script><script src="/${script}"></script>` : '';
      response.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body class="app-experience"><div id="root"></div><script>globalThis.process={env:{NODE_ENV:'production'}};globalThis.__name=value=>value;</script>${init}</body></html>`);
    }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture server did not bind');
  return { url: `http://127.0.0.1:${address.port}`, script,
    async close() { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); } };
}
