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

  const json = parseJsonOrNull(await response.text());

  if (!response.ok) {
    throw new BytePlusSeedreamError('BytePlus Seedream generation failed.', {
      code: 'BYTEPLUS_SEEDREAM_REQUEST_FAILED',
      status: response.status,
      detail: json,
    });
  }

  return json;
}

