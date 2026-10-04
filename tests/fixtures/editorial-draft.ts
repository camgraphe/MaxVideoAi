export function makeEditorialDraft() {
  const blocks = [
    { id: 'intro', type: 'text', heading: 'Start with the brief', paragraphs: [{ text: 'Define the intended viewer and outcome.', sourceIds: ['s1'] }] },
    { id: 'cover', type: 'media', assetId: 'a1', alt: 'A storyboard of three shots', caption: 'Generated illustration of a planning board.' },
    { id: 'compare', type: 'comparison', heading: 'Choose a shot', columns: ['Choice', 'Purpose'], rows: [['Wide', 'Set the scene']] },
    { id: 'steps', type: 'steps', heading: 'Plan the sequence', steps: [{ title: 'Pick a subject', body: 'Write one clear subject.' }] },
    { id: 'prompt', type: 'prompt', heading: 'Prompt template', template: 'Subject: [subject]\nAction: [action]', note: 'Replace bracketed fields.' },
    { id: 'end', type: 'conclusion', heading: 'Next step', paragraphs: ['Review the shot list.'], cta: { label: 'Explore video tools', href: '/tools' } },
  ];
  const variant = (locale: string) => ({
    locale,
    slug: `shot-list-${locale}`,
    title: `Shot list ${locale}`,
    description: `A practical shot list guide in ${locale}.`,
    keywords: ['shot list'],
    blocks: structuredClone(blocks),
  });
  return {
    canonicalSlug: 'shot-list-en',
    sourceLocale: 'en',
    topicKey: 'shot-list-from-brief',
    runKey: 'manual-2026-09-18-shot-list',
    locales: { en: variant('en'), fr: variant('fr'), es: variant('es') },
    sources: [{ id: 's1', title: 'Shot list guide', publisher: 'Example Studio', url: 'https://example.org/shot-list', retrievedAt: '2026-09-18', publishedAt: '2026-01-10' }],
    assets: [{ id: 'a1', kind: 'generated-illustration', storageKey: 'editorial/drafts/a1.webp', mime: 'image/webp', width: 1200, height: 630, bytes: 120000, rights: 'owned', generationPrompt: 'Illustrate a planning board.' }],
    research: {
      scannedAt: '2026-09-18T12:00:00Z',
      queries: ['AI video storyboard shot list'],
      signals: [],
      existingArticleSlugs: ['change-camera-angle-with-ai'],
      recommendation: 'new',
      productFit: { path: '/tools', rationale: 'The workflow leads naturally to MaxVideoAI production tools.' },
    },
    quality: { checkedAt: '2026-09-18T12:00:00Z', linksOk: true, mediaOk: true, mobileOk: true, seoOk: true, geoOk: true },
  };
}
