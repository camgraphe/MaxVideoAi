import assert from 'node:assert/strict';
import test from 'node:test';

import { generateMetadata as generateBestForHubMetadata } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/page.tsx';
import { generateMetadata as generateBestForDetailMetadata } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/page.tsx';
import {
  buildBestForMetaDescription,
  buildReasonSentence,
} from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-presentation.ts';
import type { BestForEntry, RankedPick } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-config.ts';

const BEST_FOR_EXPECTED_SNIPPETS = [
  {
    path: '/ai-video-engines/best-for',
    title: 'Best AI Video Engines by Use Case, Price & Quality',
    description:
      'Choose the right AI video engine for cinematic shots, ads, image-to-video, 4K delivery, fast drafts, product videos and creator-style content.',
  },
  {
    path: '/ai-video-engines/best-for/image-to-video',
    slug: 'image-to-video',
    title: 'Best AI Video Engines for Image-to-Video Prompts',
    description:
      'Compare the best AI video engines for animating still images, product shots, style frames and approved references with Seedance, Veo, Kling and LTX.',
  },
  {
    path: '/ai-video-engines/best-for/cinematic-realism',
    slug: 'cinematic-realism',
    title: 'Best AI Video Engines for Cinematic Realism',
    description:
      'Compare AI video engines for cinematic realism, camera motion, lighting, character consistency and polished visual direction with Seedance, Kling, Veo and LTX.',
  },
  {
    path: '/ai-video-engines/best-for/character-reference',
    slug: 'character-reference',
    title: 'Best AI Video Engines for Character References',
    description:
      'Compare AI video engines for stable characters, wardrobe, props and product references across shots, including Kling, Seedance and other reference models.',
  },
  {
    path: '/ai-video-engines/best-for/reference-to-video',
    slug: 'reference-to-video',
    title: 'Best AI Video Engines for Reference-to-Video',
    description:
      'Compare AI video engines for turning image, video, audio, product, style or campaign references into usable video shots with the right model.',
  },
  {
    path: '/ai-video-engines/best-for/multi-shot-video',
    slug: 'multi-shot-video',
    title: 'Best AI Video Engines for Multi-Shot Videos',
    description:
      'Compare AI video engines for mini-films, trailers, ad sequences and edited-style clips from structured prompts, with pricing and best-use guidance.',
  },
  {
    path: '/ai-video-engines/best-for/4k-video',
    slug: '4k-video',
    title: 'Best AI Video Engines for 4K: Veo, Kling & LTX',
    description:
      'Compare the best AI video engines for 4K delivery, native 4K workflows, premium finishing, pricing, resolution limits and when to use Veo, Kling or LTX.',
  },
  {
    path: '/ai-video-engines/best-for/ads',
    slug: 'ads',
    title: 'Best AI Video Engines for Ads & Product Creative',
    description:
      'Compare AI video engines for product ads, ecommerce creative, paid social campaigns and polished commercial assets with pricing and model recommendations.',
  },
  {
    path: '/ai-video-engines/best-for/ugc-ads',
    slug: 'ugc-ads',
    title: 'Best AI Video Engines for UGC Ads & Social Videos',
    description:
      'Compare AI video engines for creator-style clips, selfie videos, short dialogue, social proof and TikTok-style ad tests with the right model for each format.',
  },
  {
    path: '/ai-video-engines/best-for/product-videos',
    slug: 'product-videos',
    title: 'Best AI Video Engines for Product Videos',
    description:
      'Compare AI video engines for product reveals, ecommerce shots, packshots, demos and clean commercial storytelling with prompts, pricing and best uses.',
  },
  {
    path: '/ai-video-engines/best-for/lipsync-dialogue',
    slug: 'lipsync-dialogue',
    title: 'Best AI Video Engines for Lip Sync & Dialogue',
    description:
      'Compare AI video engines for speaking characters, short dialogue, native audio, voice control and social narration with Seedance, Veo and other models.',
  },
  {
    path: '/ai-video-engines/best-for/fast-drafts',
    slug: 'fast-drafts',
    title: 'Best AI Video Engines for Fast Drafts & Prompt Tests',
    description:
      'Compare AI video engines for fast drafts, cheaper iterations, timing tests and concept exploration with LTX 2.3 Fast, Seedance Fast and other quick models.',
  },
  {
    path: '/ai-video-engines/best-for/stylized-anime',
    slug: 'stylized-anime',
    title: 'Best AI Video Engines for Anime & Stylized Video',
    description:
      'Compare AI video engines for anime-style motion, illustration, stylized loops and non-photoreal creative tests with Kling, Seedance, Pika and other models.',
  },
] as const;

function getAbsoluteTitle(metadataTitle: Awaited<ReturnType<typeof generateBestForHubMetadata>>['title']) {
  return typeof metadataTitle === 'object' && metadataTitle && 'absolute' in metadataTitle
    ? metadataTitle.absolute
    : metadataTitle;
}

test('best-for hub and detail pages expose SERP-focused English snippets without site-name suffixes', async () => {
  for (const expected of BEST_FOR_EXPECTED_SNIPPETS) {
    const metadata = expected.slug
      ? await generateBestForDetailMetadata({
          params: Promise.resolve({ locale: 'en', usecase: expected.slug }),
        })
      : await generateBestForHubMetadata({ params: Promise.resolve({ locale: 'en' }) });

    const title = getAbsoluteTitle(metadata.title);

    assert.equal(title, expected.title, `${expected.path} title`);
    assert.equal(metadata.description, expected.description, `${expected.path} meta description`);
    assert.doesNotMatch(title ?? '', /MaxVideoAI|—/);
    assert.ok((title ?? '').length <= 60, `${expected.path} title should stay within 60 chars`);
    assert.ok((metadata.description ?? '').length <= 160, `${expected.path} meta description should stay within 160 chars`);
    assert.doesNotMatch(metadata.description ?? '', /\.\./);
    assert.equal(metadata.alternates?.canonical, `https://maxvideoai.com${expected.path}`);
    assert.notEqual(typeof metadata.robots === 'object' ? metadata.robots?.index : metadata.robots, false);
  }
});

test('best-for meta builder strips duplicate punctuation before fallback compare copy', () => {
  const description = buildBestForMetaDescription(
    'en',
    {
      slug: 'custom-use',
      title: 'Best custom AI video generator',
      description: 'Custom video finishing.',
      tier: 1,
      topPicks: [],
    } satisfies BestForEntry,
    'Custom video finishing.'
  );

  assert.doesNotMatch(description, /\.\./);
  assert.equal(description, 'Custom video finishing. Compare leading AI video engines by quality, control, consistency, cost, and workflow fit.');
});

test('best-for visible reason sentences avoid mechanical ranking snippets', () => {
  const sentence = buildReasonSentence('en', '4k-video', {
    criterion: 'Delivery-ready upscale path',
    slug: 'ltx-2-3-fast',
  } as RankedPick);

  assert.doesNotMatch(sentence, /ranks here because|gives MaxVideoAI users a practical route/i);
  assert.match(sentence, /useful|works best|Use/i);
});
