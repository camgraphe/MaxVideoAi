import { NextResponse } from 'next/server';

type IndexNowPayload = {
  urls: string[];
};

export async function POST(req: Request) {
  try {
    const { urls }: IndexNowPayload = await req.json();
    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ ok: false, error: 'Missing urls' }, { status: 400 });
    }

    const key = process.env.INDEXNOW_KEY;
    if (!key) {
      return NextResponse.json({ ok: false, error: 'Missing INDEXNOW_KEY' }, { status: 400 });
    }

    const keyLocation = `https://maxvideoai.com/${key}.txt`;
    const endpoint = `https://www.bing.com/indexnow?key=${key}&keyLocation=${encodeURIComponent(keyLocation)}`;
    const body = {
      host: 'maxvideoai.com',
      key,
      keyLocation,
      urlList: urls,
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return NextResponse.json({ ok: res.ok });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
