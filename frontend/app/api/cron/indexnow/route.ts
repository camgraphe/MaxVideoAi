import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const HOST = 'maxvideoai.com';
const OVERRIDE_TOKEN = (process.env.INDEXNOW_CRON_TOKEN ?? '').trim();

const URL_PATHS = [
  '/',
  '/fr',
  '/es',
  '/ai-video-engines',
  '/fr/comparatif',
  '/es/comparativa',
  '/models',
  '/examples',
  '/pricing',
  '/sitemap.xml',
  '/sitemap-en.xml',
  '/sitemap-fr.xml',
  '/sitemap-es.xml',
  '/sitemap-models.xml',
  '/sitemap-video.xml',
] as const;

function looksLikeVercelCron(req: NextRequest) {
  const cronHeader = req.headers.get('x-vercel-cron');
  const userAgent = (req.headers.get('user-agent') ?? '').toLowerCase();
  return Boolean(cronHeader || userAgent.includes('vercel'));
}

function hasValidOverrideToken(req: NextRequest) {
  const token =
    req.headers.get('x-indexnow-cron-token') ??
    (req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '');
  return Boolean(OVERRIDE_TOKEN) && token === OVERRIDE_TOKEN;
}

function isAuthorized(req: NextRequest) {
  if (looksLikeVercelCron(req)) return true;
  return hasValidOverrideToken(req);
}

function toAbsoluteUrl(path: string) {
  return path === '/' ? `https://${HOST}` : `https://${HOST}${path}`;
}

async function submitBatch() {
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key) {
    return NextResponse.json({ ok: false, error: 'Missing INDEXNOW_KEY' }, { status: 503 });
  }

  const urlList = URL_PATHS.map(toAbsoluteUrl);
  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host: HOST,
      key,
      keyLocation: `https://${HOST}/${key}.txt`,
      urlList,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => null);
    return NextResponse.json(
      { ok: false, error: detail ?? `IndexNow responded with ${response.status}` },
      { status: response.status }
    );
  }

  return NextResponse.json({
    ok: true,
    submitted: urlList.length,
    urls: urlList,
  });
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }
  try {
    return await submitBatch();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
