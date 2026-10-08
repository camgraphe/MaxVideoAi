import { createServer } from 'node:http';
import {gzipSync} from 'node:zlib';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import tailwindConfig from '../../frontend/tailwind.config';

const frontendRoot = resolve(process.env.MARKETING_NAV_SOURCE_ROOT ?? 'frontend');
const frontendRequire = createRequire(join(frontendRoot, 'package.json'));

// Keep application markup, styles, i18n and state real. These boundaries replace
// Next's router/image runtime, which needs an App Router server to initialize.
const boundaries: Record<string, string> = {
  '@/i18n/navigation': `
    import React, {useSyncExternalStore} from 'react';
    import {useI18n} from '@/lib/i18n/I18nProvider';
    import {buildMarketingLocaleSwitchHref} from '@/lib/i18n/marketing-locale-switch';
    const subscribe = listener => {window.addEventListener('popstate',listener); return ()=>window.removeEventListener('popstate',listener)};
    export const usePathname = () => useSyncExternalStore(subscribe,()=>window.location.pathname,()=>globalThis.__fixtureConfiguration.pathname);
    export const Link = React.forwardRef(function Link({href,prefetch,children,onClick,...props},ref) {
      const {locale} = useI18n();
      let path = typeof href === 'string' ? href : href.pathname;
      for (const [key,value] of Object.entries(href.params ?? {})) path=path.replace('['+key+']',value);
      const [basePath,search=''] = path.split('?');
      const target = buildMarketingLocaleSwitchHref({pathname:basePath,targetLocale:locale}).split('?')[0]+(search?'?'+search:'');
      return <a {...props} ref={ref} href={target} onClick={event=>{
        onClick?.(event);
        if (!event.defaultPrevented && event.button===0 && !event.metaKey && !event.ctrlKey && target.startsWith('/')) {
          event.preventDefault();window.history.pushState(null,'',target);window.dispatchEvent(new PopStateEvent('popstate'));
        }
      }}>{children}</a>;
    });`,
  'next/image': `import React from 'react';export default function Image({priority,fill,unoptimized,...props}){return <img {...props}/>}`,
};

const fixture = `
  import {useEffect,useState} from 'react';
  import {MarketingNav} from './components/marketing/MarketingNav';
  import {I18nProvider} from './lib/i18n/I18nProvider';
  import en from './messages/en.json';
  import fr from './messages/fr.json';
  import es from './messages/es.json';
  for (const dictionary of [en,fr,es]) {
    const labels=dictionary.nav.dropdown.models.items;
    Object.defineProperty(dictionary.nav.dropdown.models,'items',{enumerable:true,get(){
      globalThis.__fixtureModelLabelReads=(globalThis.__fixtureModelLabelReads??0)+1;return labels;
    }});
  }
  export function Fixture() {
    const [locale,setLocale] = useState(globalThis.__fixtureConfiguration.locale);
    useEffect(()=>{window.__fixtureSetLocale=setLocale},[]);
    useEffect(()=>{window.__fixtureHydrated=true;window.__fixtureHydrationDuration=performance.now()-window.__fixtureHydrationStarted},[]);
    return <I18nProvider locale={locale} dictionary={{en,fr,es}[locale]} fallback={en}>
      <div className={globalThis.__fixtureConfiguration.marketingSite ? "marketing-site" : undefined}><MarketingNav/><main style={{minHeight:'1800px'}}><h1>Navigation fixture</h1><a href="#after">After navigation</a></main></div>
      <aside className="cookie-consent-overlay"><button type="button">Consent fixture</button></aside>
    </I18nProvider>;
  }
`;

export async function createMarketingNavigationBrowserFixture({forcePopoverFallback=false,marketingSite=true}: {forcePopoverFallback?:boolean;marketingSite?:boolean}={}) {
  const directory = await mkdtemp(join(tmpdir(), 'marketing-navigation-browser-'));
  const nodeOutput = join(directory, 'fixture.cjs');
  const plugin = (external: boolean) => ({ name: 'navigation-next-boundaries', setup(builder: import('esbuild').PluginBuild) {
    builder.onResolve({ filter: /.*/ }, args => {
      if (args.path in boundaries) return { path: args.path, namespace: 'boundary' };
      if (!args.path.startsWith('.') && !args.path.startsWith('/') && !args.path.startsWith('@/')) {
        return { path: frontendRequire.resolve(args.path), external };
      }
    });
    builder.onLoad({ filter: /.*/, namespace: 'boundary' }, args => ({ contents: boundaries[args.path], loader: 'tsx', resolveDir: frontendRoot }));
    builder.onLoad({filter:/messages\/(en|fr|es)\.json$/},async args=>({contents:'export default JSON.parse('+JSON.stringify(await readFile(args.path,'utf8'))+')',loader:'js'}));
  } });
  await build({ stdin: { contents: fixture + `import {renderToString} from 'react-dom/server';export const renderFixture=()=>renderToString(<Fixture/>);`, loader: 'tsx', resolveDir: frontendRoot },
    outfile: nodeOutput, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', tsconfig: join(frontendRoot,'tsconfig.json'), plugins: [plugin(true)] });
  const browserBundle = await build({ stdin: { contents: fixture + `import {hydrateRoot} from 'react-dom/client';window.__fixtureHydrationStarted=performance.now();window.__fixtureRoot=hydrateRoot(document.getElementById('root'),<Fixture/>,{onRecoverableError:error=>window.__fixtureHydrationErrors.push(error.message)});`, loader:'tsx',resolveDir:frontendRoot },
    write:false,bundle:true,platform:'browser',format:'iife',jsx:'automatic',tsconfig:join(frontendRoot,'tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'},plugins:[plugin(false)] });
  const styles = await Promise.all(['app/globals.css','src/styles/tokens.css','src/styles/skeleton.css','src/styles/marketing-cinema.css','src/styles/marketing-navigation.css','src/styles/cookie-consent.css'].map(path => readFile(join(frontendRoot,path),'utf8')));
  const cssInput = styles.join('\n').replace(/^@import .*;$/gm,'');
  const postcss = frontendRequire('postcss');
  const tailwind = frontendRequire('tailwindcss');
  const realCss = (await postcss([tailwind({...tailwindConfig,content:tailwindConfig.content.map(path=>join(frontendRoot,path))})]).process(cssInput,{from:undefined})).css;
  // Chromium cannot disable CSS support; force only the authored fallback rule
  // for a separate compatibility check, without pretending this is an old engine.
  const css=forcePopoverFallback?realCss.replace('@supports not selector(:popover-open)','@supports selector(:popover-open)'):realCss;
  const {renderFixture} = createRequire(import.meta.url)(nodeOutput);
  let releaseScripts = false;
  const pendingScripts: Array<()=>void> = [];
  const server = createServer((request,response) => {
    if (request.url?.startsWith('/fixture.js')) {
      const send = ()=> {response.writeHead(200,{'content-type':'application/javascript'});response.end(browserBundle.outputFiles[0].text)};
      if (releaseScripts) send(); else pendingScripts.push(send);
      return;
    }
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname.startsWith('/assets/') || /\.(?:svg|png|jpg|webp|ico)$/.test(pathname)) {
      response.writeHead(200,{'content-type':'image/svg+xml'});response.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"/>');return;
    }
    const locale = pathname.startsWith('/fr') ? 'fr' : pathname.startsWith('/es') ? 'es' : 'en';
    const configuration = {locale,pathname,marketingSite};
    Object.assign(globalThis,{__fixtureConfiguration:configuration});
    const markup = renderFixture();
    response.writeHead(200,{'content-type':'text/html; charset=utf-8'});
    response.end(`<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div id="root">${markup}</div><script>
      window.process={env:{NODE_ENV:"production"}};
      window.__fixtureConfiguration=${JSON.stringify(configuration)};
      window.__fixtureSSRBytes=${Buffer.byteLength(markup)};
      window.__fixtureSSRGzipBytes=${gzipSync(markup).length};
      window.__fixtureHydrationErrors=[];
      window.__fixtureOpenSamples=[];
      window.__fixtureLayoutShifts=[];
      if(PerformanceObserver.supportedEntryTypes.includes('layout-shift'))new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__fixtureLayoutShifts.push(e.value)}).observe({type:'layout-shift',buffered:true});
      document.addEventListener('click',event=>{if(event.target.closest('[aria-label="Open menu"], [aria-label="Ouvrir le menu"], [aria-label="Abrir menú"]'))window.__fixtureTap={trusted:event.isTrusted,time:performance.now()}},true);
      const sample=()=>{const panel=document.querySelector('.marketing-menu-overlay');window.__fixtureOpenSamples.push({time:performance.now(),open:!!panel&&getComputedStyle(panel).display!=='none'&&panel.getClientRects().length>0});requestAnimationFrame(sample)};requestAnimationFrame(sample);
    </script><script defer src="/fixture.js"></script></body></html>`);
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();
  if (!address || typeof address==='string') throw new Error('Fixture HTTP server address missing');
  return {
    url:`http://127.0.0.1:${address.port}`,
    cssBytes:Buffer.byteLength(css),
    releaseHydration(){releaseScripts=true;for(const send of pendingScripts.splice(0))send()},
    delayHydration(){releaseScripts=false},
    async close(){for(const send of pendingScripts.splice(0))send();server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await rm(directory,{recursive:true,force:true})},
  };
}
