import type { ExampleWatchDetail } from './example-watch-detail';
import { exampleContinuationCopy } from './example-continuation-copy';
import { SITE_ORIGIN } from './siteOrigin';

export type ExampleRequestSource = Pick<ExampleWatchDetail,
  'id' | 'title' | 'prompt' | 'videoUrl' | 'engineLabel' | 'watchHref' | 'modelHref' |
  'aspectRatio' | 'durationSec' | 'hasAudio' | 'scenario' | 'references'> & {
    context: Pick<ExampleWatchDetail['context'], 'negativePrompt' | 'details' | 'controls'>;
  };

/** Only the already-public reader projection travels to a new conversation. */
export function exampleRequestSource(detail: ExampleWatchDetail): ExampleRequestSource {
  const { id, title, prompt, videoUrl, engineLabel, watchHref, modelHref, aspectRatio, durationSec, hasAudio, scenario, references } = detail;
  const { negativePrompt, details, controls } = detail.context;
  return { id, title, prompt, videoUrl, engineLabel, watchHref, modelHref, aspectRatio, durationSec, hasAudio, scenario, references,
    context: { negativePrompt, details, controls } };
}

export function parseExampleEntryId(value: unknown): string | null {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value) ? value : null;
}

export function buildExampleRequest(source: ExampleRequestSource, locale: string, destination: 'assistant' | 'studio'): string {
  const copy = exampleContinuationCopy(locale);
  const absolute = (href: string) => new URL(href, SITE_ORIGIN).href;
  const mode = source.context.details.find(row => row.key === 'mode')?.value;
  const recordedResolution = source.context.details.find(row => row.key === 'resolution')?.value;
  const settings = [
    `${copy.model}: ${source.engineLabel}${source.modelHref ? ` (${absolute(source.modelHref)})` : ''}`,
    ...(mode ? [`${copy.mode}: ${mode}`] : []),
    `${copy.duration}: ${source.durationSec} s`, `${copy.aspect}: ${source.aspectRatio}`,
    ...(source.scenario ? [`${copy.resolution}: ${source.scenario.resolution}`] : recordedResolution ? [`${copy.recordedResolution}: ${recordedResolution}`] : []),
    `${copy.audio}: ${source.hasAudio ? copy.on : copy.off}`,
    ...source.context.details.filter(row => row.key === 'fps').map(row => `${row.label}: ${row.value}`),
    ...source.context.controls.filter(row => row.key !== 'negative').map(row => `${row.label}: ${row.value}`),
  ];
  return [copy.intro, `${copy.source}: ${source.title}\n${absolute(source.watchHref)}`,
    `${copy.video}: ${absolute(source.videoUrl)}`,
    `${copy.settings}:\n${settings.join('\n')}`,
    ...(!source.scenario ? [copy.missing] : []),
    `${copy.prompt}:\n${source.prompt}`,
    ...(source.context.negativePrompt ? [`${copy.negative}:\n${source.context.negativePrompt}`] : []),
    ...(source.references.length ? [`${copy.references}:\n${source.references.map(ref => `${ref.label}: ${absolute(ref.url)}`).join('\n')}`] : []),
    copy.inputs,
    ...(destination === 'assistant' ? [`${copy.connector}\n${absolute('/mcp')}\nMCP: https://api.maxvideoai.com/mcp`] : []),
    copy.approval,
  ].join('\n\n');
}

/** These open a draft; they neither install a connector nor authorize generation. */
export function buildAssistantRequestHref(assistant: 'chatgpt' | 'claude', request: string): string {
  const base = assistant === 'chatgpt' ? 'https://chatgpt.com/' : 'https://claude.ai/new';
  const url = new URL(base);
  url.searchParams.set('q', request);
  // Keep the complete request in the explicit clipboard action for long prompts.
  return url.href.length <= 8_000 ? url.href : base;
}
