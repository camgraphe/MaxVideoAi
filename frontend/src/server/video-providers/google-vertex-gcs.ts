import { randomUUID } from 'node:crypto';

export function parseGoogleVertexGcsPrefix(value: string | undefined): { bucket: string; prefix: string } | null {
  const normalized = (value ?? '').trim().replace(/\/+$/, '');
  const match = normalized.match(/^gs:\/\/([^/]+)\/?(.*)$/);
  if (!match) return null;
  return { bucket: match[1], prefix: match[2] ? `${match[2]}/` : '' };
}

export async function uploadGoogleVertexGcsObject(params: {
  prefix: string;
  data: Buffer;
  mime: string;
  extension: string;
  accessToken: string;
  objectNamespace: string;
  fetchFn?: typeof fetch;
}): Promise<string> {
  const staging = parseGoogleVertexGcsPrefix(params.prefix);
  if (!staging) throw new Error('Google Vertex input GCS URI is missing or invalid.');
  const objectName = `${staging.prefix}${params.objectNamespace}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${params.extension}`;
  const gcsUri = `gs://${staging.bucket}/${objectName}`;
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(
    staging.bucket
  )}/o?uploadType=media&name=${encodeURIComponent(objectName)}`;
  const response = await (params.fetchFn ?? fetch)(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${params.accessToken}`, 'content-type': params.mime },
    body: new Uint8Array(params.data).buffer,
  });
  if (!response.ok) throw new Error(`Google GCS input upload failed (${response.status}).`);
  return gcsUri;
}
