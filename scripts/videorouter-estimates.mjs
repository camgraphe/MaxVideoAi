// Price qualification only. These public demo stills are owned by MaxVideoAI.
const assets = 'https://maxvideoai.com/media/mcp/project-demo/';
const stills = ['watch-static.png', 'watch-motion-poster.png', 'watch-wan-3-prime-poster.webp'];
const profiles = [
  {
    model: 'alibaba/wan-3.0-prime/botsmart', rate: 0.0397, seconds: 15, resolution: '480p', ratio: '16:9',
    hostModel: 'botsmart/wan-3.0-prime',
    prompt: 'A silver watch moves slowly through a narrow beam of light.',
    options: { generate_audio: true, prompt_extend: true }, references: 0,
  },
  {
    model: 'alibaba/wan-3.0/botsmart', rate: 0.0221, seconds: 30, resolution: '480p', ratio: '9:16',
    hostModel: 'botsmart/wan-3.0',
    prompt: 'The watch in Image 1 rotates slowly on a dark display stand.',
    options: { generate_audio: true, prompt_extend: true }, references: 1,
  },
  {
    model: 'kuaishou/kling-v4.0/sandbase', rate: 0.1335, seconds: 30, resolution: '720p', ratio: '16:9',
    hostModel: 'sandbase/kling-v4.0',
    prompt: 'Use the three reference photos to show the watch turning from its face to its side.',
    options: {}, references: 3,
  },
  {
    model: 'minimax/h3/atlas-cloud', rate: 0.038, seconds: 15, resolution: '480p', ratio: '21:9',
    hostModel: 'atlascloud/h3',
    prompt: 'Show the watch in @image1 turning toward the light in @image2.',
    options: { prompt_extend: true }, references: 2,
    qualification: 'The expansion switch is boolean. Equivalence to Fal balanced and the delivered framing require separate verification.',
  },
];

function makeRequest(profile) {
  const host = profile.model.split('/').at(-1);
  const inputReferences = stills.slice(0, profile.references).map(name => ({
    type: 'image_url', image_url: { url: assets + name },
  }));
  return {
    type: 'video', model: profile.model, provider: { only: [host], allow_fallbacks: false },
    prompt: profile.prompt, duration_secs: profile.seconds, strict_duration: true,
    resolution: profile.resolution, aspect_ratio: profile.ratio, ...profile.options,
    ...(inputReferences.length ? { input_references: inputReferences } : {}),
  };
}

function validAmount(value) {
  return Number.isFinite(value) && value >= 0;
}

async function getEstimate(request, hostModel, key) {
  const response = await fetch('https://videorouter.sh/v1/pricing/estimate', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20_000),
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return { status: 'rejected', http: response.status, code: data?.error?.code ?? null };
  }
  if (data?.object !== 'pricing.estimate' || data.type !== 'video' ||
      data.currency !== 'USD' || !validAmount(data.estimated_cost_usd)) {
    return { status: 'unpriced', http: response.status };
  }
  const assumptions = data.assumptions ?? {};
  const differences = ['duration_secs', 'resolution', 'aspect_ratio'].filter(
    field => String(assumptions[field]).toLowerCase() !== String(request[field]).toLowerCase()
  );
  if ((assumptions.reference_images ?? 0) !== (request.input_references?.length ?? 0)) differences.push('reference_images');
  if (data.model !== request.model && data.model !== hostModel) differences.push('model');
  if (validAmount(data.max_cost_usd) && data.max_cost_usd > data.estimated_cost_usd + 0.000001)
    differences.push('max_cost_usd');
  return {
    status: differences.length ? 'review' : 'quoted', usd: data.estimated_cost_usd,
    maxUsd: data.max_cost_usd ?? null, returnedModel: data.model ?? null, differences, assumptions,
    breakdown: data.breakdown ?? null, notes: data.notes ?? [],
  };
}

const mode = process.argv[2] ?? '--preview';
if (process.argv.length > 3 || !['--preview', '--estimate'].includes(mode)) {
  console.error('Usage: node scripts/videorouter-estimates.mjs [--preview | --estimate]');
  process.exit(2);
}
const key = process.env.VIDEOROUTER_API_KEY?.trim();
if (mode === '--estimate' && !key) {
  console.error('Set VIDEOROUTER_API_KEY for authenticated free estimates.');
  process.exit(2);
}

const results = [];
for (const profile of profiles) {
  const request = makeRequest(profile);
  const publishedUsd = Number((profile.rate * profile.seconds * 1.025).toFixed(8));
  const entry = { request, publishedUsd, qualification: profile.qualification };
  if (mode === '--estimate') {
    try {
      entry.estimate = await getEstimate(request, profile.hostModel, key);
    } catch (error) {
      entry.estimate = { status: 'unavailable', reason: error.name };
    }
    if (entry.estimate.status !== 'quoted') process.exitCode = 1;
  }
  results.push(entry);
  if ([401, 403].includes(entry.estimate?.http) && ['invalid_api_key', 'insufficient_scope'].includes(entry.estimate.code)) break;
}
console.log(JSON.stringify({ mode: mode.slice(2), asOf: new Date().toISOString(), results }, null, 2));
