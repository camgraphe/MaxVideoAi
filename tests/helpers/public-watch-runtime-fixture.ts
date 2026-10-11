import { build } from 'esbuild';
import { resolve } from 'node:path';

export async function buildPublicWatchRuntimeFixture() {
  const frontend = resolve('frontend');
  const stubs: Record<string, string> = {
    'next/headers': 'export async function cookies(){return {get(name){return window.runtimeHost.cookies[name] ? {value:window.runtimeHost.cookies[name]} : undefined;}};}',
    'next-intl/server': 'export async function getMessages({locale}){return window.runtimeHost.messages[locale];}export async function getLocale(){throw Error("Unexpected locale detection");}',
    'next/font/local': 'export default ()=>({variable:"fixture-font"});',
    'next/navigation': 'export function usePathname(){return window.location.pathname;}export function useRouter(){return window.runtimeHost.router;}',
    'next/script': 'export default function Script(){return null;}',
    'next/dynamic': 'export default ()=>()=>null;',
    '@vercel/analytics/react': 'export function Analytics(){return null;}',
  };
  const output = await build({
    absWorkingDir: frontend, bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic', write: false,
    define: { 'process.env': '{}', 'process.env.NODE_ENV': '"test"', 'process.env.NEXT_PUBLIC_SITE_URL': '"https://maxvideoai.com"' },
    tsconfig: resolve('frontend/tsconfig.json'),
    plugins: [{ name: 'public-watch-host-boundaries', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => {
        if (Object.hasOwn(stubs, args.path)) return { path: args.path, namespace: 'host' };
        if (args.path.endsWith('.css')) return { path: args.path, namespace: 'style' };
      });
      builder.onLoad({ filter: /.*/, namespace: 'host' }, args => ({ contents: stubs[args.path], loader: 'js', resolveDir: frontend }));
      builder.onLoad({ filter: /.*/, namespace: 'style' }, () => ({ contents: '', loader: 'js' }));
    } }],
    stdin: { loader: 'tsx', resolveDir: frontend, contents: `
      import React, { act } from 'react';
      import { createRoot } from 'react-dom/client';
      import useSWR, { mutate } from 'swr';
      import CoreLayout from './app/(core)/layout';
      import PublicWatchLayout from './app/(public-watch)/layout';
      import { useI18n } from './lib/i18n/I18nProvider';
      const root = createRoot(document.getElementById('root'));
      function Consumer() {
        const { locale, dictionary, t } = useI18n();
        const { data } = useSWR('/api/runtime-fixture', async () => ++window.runtimeHost.revalidations,
          { revalidateOnMount: false, revalidateOnFocus: false });
        return <output data-namespaces={Object.keys(dictionary).sort().join(',')}>
          {locale+'|'+t('nav.cta')+'|'+t('nav.account.signOut')+'|'+data}
        </output>;
      }
      window.runtimeFixture = {
        act,
        async seedCache() { await mutate('/api/runtime-fixture', 'cached', {revalidate:false}); },
        async render(group, path, locale, browserLocale = locale) {
          window.history.replaceState(null, '', path);
          window.runtimeHost.cookies = { mvid_locale: locale, NEXT_LOCALE: locale };
          document.cookie = 'mvid_locale='+browserLocale+'; path=/';
          document.cookie = 'NEXT_LOCALE='+browserLocale+'; path=/';
          if (!group) { await act(async () => root.render(<main>Gallery boundary</main>)); return; }
          const Layout = group === 'watch' ? PublicWatchLayout : CoreLayout;
          const runtime = Layout({children:<Consumer/>});
          const tree = await runtime.type(runtime.props);
          await act(async () => root.render(<React.Fragment key={group}>{tree}</React.Fragment>));
        },
        async unmount() { await act(async () => root.unmount()); },
      };
    ` },
  });
  return output.outputFiles[0].text;
}
