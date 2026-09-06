import path from 'node:path';
import { build } from 'esbuild';

// Keep the real rail, cards, grouping and media components. Only replace the
// authenticated data source, localization context and Next's host adapters.
export async function buildGalleryFixture() {
  const frontend = path.join(process.cwd(), 'frontend');
  const stubs: Record<string, string> = {
    '@/lib/api': `
      export function useInfiniteJobs() { return window.galleryFeed; }
      export function useEngines() { return { data: { engines: [] } }; }
      export async function saveImageToLibrary() {}
    `,
    '@/lib/i18n/I18nProvider': `
      const t = (_key, fallback) => fallback;
      export function useI18n() { return { t, locale: 'en' }; }
    `,
    'next/link': `import React from 'react'; export default function Link({prefetch, ...props}) { return React.createElement('a', props); }`,
    'next/image': `import React from 'react'; export default function Image({fill, priority, unoptimized, ...props}) { return React.createElement('img', props); }`,
  };
  const bundle = await build({
    absWorkingDir: frontend, bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"' }, write: false, outfile: 'gallery-fixture.js',
    tsconfig: path.join(frontend, 'tsconfig.json'),
    plugins: [{ name: 'gallery-host-adapters', setup(builder) {
      builder.onResolve({ filter: /.*/ }, (args) => args.path in stubs ? { path: args.path, namespace: 'gallery-host' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'gallery-host' }, (args) => ({ contents: stubs[args.path], loader: 'jsx', resolveDir: frontend }));
    } }],
    stdin: { loader: 'tsx', resolveDir: frontend, contents: `
      import React, { act } from 'react';
      import { createRoot } from 'react-dom/client';
      import { GalleryRail } from './components/GalleryRail';
      import { groupJobsIntoSummaries } from './lib/job-groups';
      const root = createRoot(document.getElementById('root'));
      const noop = () => {};
      const engine = { id: 'fixture', label: 'Fixture' };
      const newer = { jobId: 'newer', groupId: 'newer', engineId: 'fixture', engineLabel: 'Fixture', durationSec: 5, prompt: 'Newer render', createdAt: '2026-09-06T20:02:00Z', status: 'pending', message: 'IN_PROGRESS' };
      const older = { ...newer, jobId: 'older', groupId: 'older', durationSec: 8, prompt: 'Older render', createdAt: '2026-09-06T20:01:00Z' };
      let feedType = 'video';
      let background = [];
      let current = [newer, older];
      let active = [newer, older];
      function render() {
        window.galleryFeed = { data: [{ jobs: current }], stableJobs: current, mutate: noop, setSize: noop, isLoading: false, isValidating: false };
        const activeGroups = groupJobsIntoSummaries(active, { includeSinglesAsGroups: true }).groups.map(group => ({ ...group, source: 'active' }));
        root.render(<GalleryRail engine={engine} engineRegistry={[engine]} activeGroups={activeGroups} feedType={feedType} variant="desktop" />);
      }
      window.galleryFixture = {
        act,
        render,
        completeNewer() { current = [{ ...newer, status: 'completed', videoUrl: '/fixture.mp4' }, older, ...background]; active = [older, ...background]; render(); },
        refresh() { current = current.map(job => ({ ...job })); render(); },
        reset(type = 'video', count = 2) {
          feedType = type;
          background = Array.from({ length: Math.max(0, count - 2) }, (_, index) => ({ ...older, jobId: 'background-' + index, groupId: 'background-' + index, durationSec: index + 9, createdAt: '2026-09-06T19:0' + (5 - index) + ':00Z' }));
          current = [newer, older, ...background]; active = current; render();
        },
        unmount() { root.unmount(); },
      };
    ` },
  });
  return bundle.outputFiles[0].text;
}
