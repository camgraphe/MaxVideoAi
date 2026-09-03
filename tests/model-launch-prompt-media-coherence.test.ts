import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import type { AppLocale } from '../frontend/i18n/locales.ts';
import { parseModelPromptingContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content.ts';
import { resolveModelPromptingDemoPromptSource } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-prompt-source.ts';
import { buildModelPromptingViewModel } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-view-model.ts';
import { PREFERRED_MEDIA } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static-media.ts';

const LOCALES = ['en', 'fr', 'es'] as const satisfies readonly AppLocale[];

const REVIEWED_MEDIA = {
  'wan-3': {
    hero: '322fa03b-47f1-4267-a384-1d04aac27167',
    demo: 'e2ef7bdf-e78c-4aca-94b4-d2ba74036dac',
  },
  'wan-3-prime': {
    hero: 'f9a9022c-e587-4c6a-b49a-f2985908eee9',
    demo: 'feccb90c-11ed-48ef-a96b-b7c80e5fe1c5',
  },
  'ltx-2-5-fast': {
    hero: '7b52c7eb-24fa-45a8-baa9-c675b7f50174',
    demo: 'bd943cbc-c500-49ff-baff-d7e1f03fb2dc',
  },
  'ltx-2-5-pro': {
    hero: 'a30e1f55-27ca-4cd5-9c6b-1cb990a5ca91',
    demo: '5d47efd3-c75c-42c0-91fc-e0e1d8b50357',
  },
  'grok-imagine-video-1-5': {
    hero: '2b74b648-63f2-4b19-b555-9dad0554ed40',
    demo: '4467d48a-8d6a-490c-96ba-09468aea313e',
  },
  'flux-3': {
    hero: '08ac14de-f53b-46c7-b6db-ae56c0095d7a',
    demo: 'abd1a29b-7de8-4bb5-bc24-1c670d3b0a88',
  },
  'flux-3-draft': {
    hero: 'b7014d70-b6a7-4e64-b41f-36f836756f76',
    demo: '34605e6e-0a3a-4b23-ac71-9985b486bd01',
  },
  'gemini-omni-flash': {
    hero: 'f06c01cf-86f4-4c91-81bd-5bc099566e05',
    demo: '46b7eafe-089c-4135-958c-95c6670150c2',
  },
  'kling-3-turbo-standard': {
    hero: '3c9d288d-5252-4ed9-9370-b75f5c123ee4',
    demo: '1e897756-8d78-4112-9c8f-98d4f5e5bd07',
  },
  'kling-3-turbo-pro': {
    hero: '4104d35b-a97a-4449-91fd-cfc628f626de',
    demo: '5981ead1-6b40-46e8-9dc3-ef5a1077f7e7',
  },
  'minimax-h3-max': {
    hero: '0caeabd8-4594-473d-aec6-e1998c2e67a8',
    demo: '2fbcc3d8-8001-465e-b5ed-8e5e5d8a40a5',
  },
} as const;

type LaunchAsset = {
  jobId: string;
  modelId: keyof typeof REVIEWED_MEDIA;
  prompt: string;
  durationSec: number;
  width: number;
  height: number;
};

const assets = ['p0', 'p1'].flatMap((wave) => {
  const document = JSON.parse(
    readFileSync(`docs/model-launch/${wave}-video-example-pack.json`, 'utf8'),
  ) as { assets: LaunchAsset[] };
  return document.assets;
});

test('P0 and P1 model pages pin the reviewed hero and demo videos', () => {
  for (const [modelId, expected] of Object.entries(REVIEWED_MEDIA)) {
    assert.deepEqual(PREFERRED_MEDIA[modelId], expected, modelId);
  }
});

test('P0 and P1 decision demos use the exact prompt and facts from the adjacent video', () => {
  for (const [modelId, reviewed] of Object.entries(REVIEWED_MEDIA)) {
    const asset = assets.find(({ jobId }) => jobId === reviewed.demo);
    assert.ok(asset, `${modelId}: missing reviewed demo asset`);
    const aspectRatio = `${asset.width}:${asset.height}`;

    for (const locale of LOCALES) {
      const document = JSON.parse(
        readFileSync(`content/models/${locale}/${modelId}.json`, 'utf8'),
      ) as Record<string, unknown>;
      const content = parseModelPromptingContent(
        document.prompting,
        modelId,
        locale,
      );
      const demoMedia = {
        id: asset.jobId,
        prompt: asset.prompt,
        videoUrl: `https://media.maxvideoai.com/${asset.jobId}.mp4`,
        posterUrl: `https://media.maxvideoai.com/${asset.jobId}.jpg`,
        durationSec: asset.durationSec,
        hasAudio: true,
        href: `/video/${asset.jobId}`,
        label: modelId,
        aspectRatio,
      };
      const demoPromptSource = resolveModelPromptingDemoPromptSource({
        content,
        demoMedia,
        engineId: modelId,
        locale,
      });
      const viewModel = buildModelPromptingViewModel({
        content,
        locale,
        engineId: modelId,
        modelSlug: modelId,
        appGenerationEnabled: true,
        imageAnchorId: 'prompting',
        isVideoEngine: true,
        isImageEngine: false,
        supportsNativeAudio: true,
        demoPromptSource,
        defaultDemoPromptSource: 'media',
        demoMedia,
        defaultDemoPresentation: {
          audioBadgeLabel: 'Audio on',
          altContext: 'Editorial fallback that must not describe reviewed media.',
        },
        referenceWorkflows: [],
      });

      assert.equal(demoPromptSource, 'media', `${locale}/${modelId}: prompt source`);
      assert.equal(viewModel.demo?.prompt, asset.prompt, `${locale}/${modelId}: exact prompt`);
      assert.equal(viewModel.demo?.summary, null, `${locale}/${modelId}: stale editorial summary`);
      assert.equal(viewModel.demo?.title, modelId, `${locale}/${modelId}: media title`);
      assert.equal(viewModel.demo?.aspectLabel, aspectRatio, `${locale}/${modelId}: media aspect`);
      assert.equal(
        viewModel.demo?.durationLabel,
        locale === 'en' ? `${asset.durationSec}s` : `${asset.durationSec} s`,
        `${locale}/${modelId}: media duration`,
      );
    }
  }
});
