import type { BytePlusSeedreamPayload } from './byteplus-seedream-payload';
import { BytePlusSeedreamError } from './byteplus-seedream-error';

function parseJsonOrNull(text: string): unknown {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 1000) };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function shouldParseStreamingResponse(response: Response, payload: BytePlusSeedreamPayload): boolean {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  return payload.stream === true || contentType.includes('text/event-stream');
}

async function parseStreamingResponse(response: Response): Promise<unknown> {
  if (!response.body) {
    return parseJsonOrNull(await response.text());
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let raw = '';
  let latest: unknown = null;
  let responseBase: Record<string, unknown> | null = null;
  const dataItems: unknown[] = [];
  const seenDataItems = new Set<string>();

  const addDataItem = (item: unknown) => {
    const key =
      isRecord(item) && typeof item.url === 'string' && item.url.trim()
        ? item.url.trim()
        : JSON.stringify(item);
    if (seenDataItems.has(key)) return;
    seenDataItems.add(key);
    dataItems.push(item);
  };

  const parseLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(':')) return;
    if (trimmed.startsWith('event:') || trimmed.startsWith('id:') || trimmed.startsWith('retry:')) return;
    if (!trimmed.startsWith('data:') && !trimmed.startsWith('{') && !trimmed.startsWith('[')) return;

    const dataText = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
    if (!dataText || dataText === '[DONE]') return;
    raw += `${dataText}\n`;

    let parsed: unknown;
    try {
      parsed = JSON.parse(dataText);
    } catch (error) {
      throw new BytePlusSeedreamError('BytePlus Seedream streaming response was not valid JSON.', {
        code: 'BYTEPLUS_SEEDREAM_STREAM_PARSE_FAILED',
        status: 502,
        detail: { chunk: dataText.slice(0, 1000), error: error instanceof Error ? error.message : String(error) },
      });
    }

    latest = parsed;
    if (isRecord(parsed)) {
      responseBase = parsed;
      if (Array.isArray(parsed.data)) {
        parsed.data.forEach(addDataItem);
      } else if (typeof parsed.url === 'string' && parsed.url.trim()) {
        addDataItem(parsed);
      }
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let lineEnd = buffer.indexOf('\n');
    while (lineEnd >= 0) {
      const line = buffer.slice(0, lineEnd);
      buffer = buffer.slice(lineEnd + 1);
      parseLine(line);
      lineEnd = buffer.indexOf('\n');
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    parseLine(buffer);
  }

  const finalResponseBase = responseBase as Record<string, unknown> | null;
  if (finalResponseBase && dataItems.length) {
    return {
      ...finalResponseBase,
      data: dataItems,
    };
  }
  return latest ?? parseJsonOrNull(raw);
}

export async function callBytePlusSeedream(
  params: {
    baseUrl: string;
    apiKey: string;
    payload: BytePlusSeedreamPayload;
  },
  fetchImpl: typeof fetch = fetch
): Promise<unknown> {
  const baseUrl = params.baseUrl.replace(/\/+$/, '');
  const response = await fetchImpl(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(params.payload),
  });

  if (!response.ok) {
    const json = parseJsonOrNull(await response.text());
    throw new BytePlusSeedreamError('BytePlus Seedream generation failed.', {
      code: 'BYTEPLUS_SEEDREAM_REQUEST_FAILED',
      status: response.status,
      detail: json,
    });
  }

  return shouldParseStreamingResponse(response, params.payload)
    ? parseStreamingResponse(response)
    : parseJsonOrNull(await response.text());
}
