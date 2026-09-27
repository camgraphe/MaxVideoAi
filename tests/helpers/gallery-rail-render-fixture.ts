import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

// Real rail, grouping, cards, media and I18nProvider. Only host/data adapters
// are replaced. Counters observe function entry without replacing behavior.
export async function buildGalleryRenderFixture() {
  const frontend = path.join(process.cwd(), 'frontend');
  const stubs: Record<string, string> = {
    '@/hooks/useRequireAuth': `export function useRequireAuth() { return { user: { id: 'fixture-user' }, loading: false }; }`,
    'next/navigation': `export function useRouter() { return { push() {}, replace() {}, prefetch() {} }; }`,
    '@/lib/authFetch': `export async function authFetch() { throw new Error('Unexpected network request'); }`,
    '@/lib/api': `export function useInfiniteJobs() { return window.galleryFeed; } export function useEngines() { return { data: { engines: [] } }; } export async function saveImageToLibrary() {}`,
    'next-intl': `export function NextIntlClientProvider({children}) { return children; }`,
    'next/link': `import React from 'react'; export default function Link({prefetch, ...props}) { return React.createElement('a', props); }`,
    'next/image': `import React from 'react'; export default function Image({fill, priority, unoptimized, ...props}) { return React.createElement('img', props); }`,
  };
  const bundle = await build({
    absWorkingDir: frontend, bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"' }, write: false, outfile: 'gallery-render-fixture.js',
    tsconfig: path.join(frontend, 'tsconfig.json'),
    plugins: [{ name: 'gallery-render-host', setup(builder) {
      builder.onLoad({ filter: /(?:GalleryRail|GalleryRailCards|GroupedJobCard|GroupedJobCardPreviewGrid|ProcessingOverlay|GenerationPendingArtwork|GenerationPendingStatus)\.tsx$/ }, async (args) => {
        let contents = await readFile(args.path, 'utf8');
        const name = path.basename(args.path, '.tsx');
        const anchors: Record<string, string> = {
          GalleryRail: 'const { t, locale } = useI18n();',
          GalleryRailCards: 'const { locale } = useI18n();',
          GroupedJobCard: 'const [menuOpen, setMenuOpen] = useState(false);',
          GroupedJobCardPreviewGrid: 'return (',
        };
        if (anchors[name]) {
          if (!contents.includes(anchors[name])) throw new Error(`Missing counter anchor: ${name}`);
          contents = contents.replace(anchors[name], `window.galleryProbe.counts.${name}++;\n${name === 'GroupedJobCard' ? 'window.galleryProbe.cards[group.id] = { group, engine };' : ''}\n${anchors[name]}`);
        }
        return { contents: contents.replace(/<style jsx>/g, '<style>'), loader: 'tsx', resolveDir: path.dirname(args.path) };
      });
      builder.onResolve({ filter: /.*/ }, (args) => args.path in stubs ? { path: args.path, namespace: 'gallery-host' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'gallery-host' }, (args) => ({ contents: stubs[args.path], loader: 'jsx', resolveDir: frontend }));
    } }],
    stdin: { loader: 'tsx', resolveDir: frontend, contents: `
      import React, { act, useCallback, useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import { GalleryRail } from './components/GalleryRail';
      import { I18nProvider } from './lib/i18n/I18nProvider';
      const root = createRoot(document.getElementById('root'));
      const dictionary = {}, activeGroups = [];
      const engine = { id: 'selected-engine', label: 'Selected engine' };
      let registry = [{ id: 'fixture', label: 'Fixture' }], locale = 'en', selectedGroupId = null, callbackVersion = 0;
      const noop = () => {};
      const makeJob = (index) => ({ jobId: 'job-' + index, groupId: 'group-' + index,
        engineId: 'fixture', engineLabel: 'Fixture', durationSec: 5, prompt: 'Completed ' + index,
        createdAt: new Date(1757000000000-index*60000).toISOString(), status: 'completed',
        videoUrl: 'https://fixture.invalid/video-' + index + '.mp4' });
      let jobs = [];
      function updateFeed(extra = {}) {
        window.galleryFeed = { data: [{ jobs, nextCursor: 'next-page' }], stableJobs: jobs,
          mutate: noop, setSize: () => window.galleryProbe.pageRequests++, isLoading: false, isValidating: false, ...extra };
      }
      function Parent() {
        const [prompt, setPrompt] = useState('');
        const version = callbackVersion;
        const onGroupAction = useCallback((group, action) => window.galleryProbe.actions.push({version, id: group.id, action}), [version]);
        return <I18nProvider locale={locale} dictionary={dictionary} fallback={dictionary}>
          <textarea aria-label="Fixture prompt" value={prompt} onInput={event => setPrompt(event.currentTarget.value)} onChange={noop} />
          <GalleryRail engine={engine} engineRegistry={registry} activeGroups={activeGroups}
            selectedGroupId={selectedGroupId} onGroupAction={onGroupAction} variant="desktop" />
        </I18nProvider>;
      }
      const render = () => root.render(<Parent />);
      window.galleryFixture = { act, render,
        reset(count) { jobs = Array.from({length:count}, (_,i) => makeJob(i)); updateFeed(); render(); },
        select(id) { selectedGroupId=id; render(); },
        locale(next) { locale=next; render(); },
        callback() { callbackVersion++; render(); },
        registry() { registry=[{id:'fixture',label:'Fixture',brandId:'openai'}]; render(); },
        job(index, patch) { jobs=jobs.map((job,i)=>i===index?{...job,...patch}:job); updateFeed(); render(); },
        append() { jobs=[...jobs,makeJob(jobs.length)]; updateFeed(); render(); },
        addMember() { jobs=[...jobs,{...makeJob(jobs.length),groupId:'group-0'}]; updateFeed(); render(); },
        loading(value) { updateFeed({isValidating:value}); render(); },
        unmount() { root.unmount(); }
      };
    ` },
  });
  return bundle.outputFiles[0].text;
}
