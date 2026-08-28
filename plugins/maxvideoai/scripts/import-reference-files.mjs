#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_FILES = 8;
const TOKEN_PATTERN = /^mru_[A-Za-z0-9_-]{43}$/u;
const ASSET_PATTERN = /^ma_[a-f0-9]{32}$/u;
const TRUSTED_ORIGIN = 'https://maxvideoai.com';
const MAX_BYTES_BY_KIND = Object.freeze({
  image: 25 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  audio: 30 * 1024 * 1024,
});
const MIME_BY_EXTENSION = new Map([
  ['.avif', 'image/avif'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.m4a', 'audio/mp4'],
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.mov', 'video/quicktime'],
  ['.mp4', 'video/mp4'],
]);

function fail(message) {
  throw new Error(`MaxVideoAI reference import rejected: ${message}`);
}

class ReferenceImportError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function parseHandoffUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail('expected a trusted MaxVideoAI upload link');
  }
  const match = parsed.pathname.match(/^\/mcp\/reference-upload\/(mru_[A-Za-z0-9_-]{43})$/u);
  if (
    parsed.origin !== TRUSTED_ORIGIN
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || !match
    || !TOKEN_PATTERN.test(match[1])
  ) {
    fail('expected a trusted MaxVideoAI upload link');
  }
  return { origin: parsed.origin, token: match[1] };
}

export function parseReferenceImportArguments(argv) {
  if (!Array.isArray(argv) || argv.length < 3 || argv.length % 3 !== 0) {
    fail('use --upload <handoff-url> <local-file> for each reference');
  }
  if (argv.length / 3 > MAX_FILES) fail('import no more than 8 files at once');
  const entries = [];
  const tokens = new Set();
  for (let index = 0; index < argv.length; index += 3) {
    const flag = argv[index];
    const handoffUrl = argv[index + 1];
    const filePath = argv[index + 2];
    if (flag !== '--upload' || typeof handoffUrl !== 'string' || typeof filePath !== 'string' || !filePath.trim()) {
      fail('use --upload <handoff-url> <local-file> for each reference');
    }
    const { token } = parseHandoffUrl(handoffUrl);
    if (tokens.has(token)) fail('each file needs its own one-use upload link');
    tokens.add(token);
    entries.push({ handoffUrl, filePath });
  }
  return entries;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function readJsonResponse(response, stage) {
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || body.ok !== true) {
    const code = typeof body?.error === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/u.test(body.error)
      ? body.error
      : 'UPLOAD_FAILED';
    throw new ReferenceImportError(code);
  }
  return body;
}

function uploadHeaders(token, contentType, extra = {}) {
  return {
    Authorization: 'Bearer' + ' ' + token,
    'Content-Type': contentType,
    ...extra,
  };
}

async function importOne(entry, dependencies) {
  const { origin, token } = parseHandoffUrl(entry.handoffUrl);
  const fileName = basename(entry.filePath);
  const declaredMime = MIME_BY_EXTENSION.get(extname(fileName).toLowerCase());
  if (!declaredMime) throw new ReferenceImportError('UNSUPPORTED_TYPE');
  const mediaKind = declaredMime.split('/', 1)[0];
  const maximumBytes = MAX_BYTES_BY_KIND[mediaKind];
  const base = `${origin}/api/mcp/reference-upload/${encodeURIComponent(token)}`;
  let uploadId = null;
  try {
    let fileBytes;
    try {
      const fileStats = await dependencies.statFile(entry.filePath);
      if (!fileStats.isFile()) throw new ReferenceImportError('READ_FAILED');
      if (!Number.isSafeInteger(fileStats.size) || fileStats.size < 1) {
        throw new ReferenceImportError('REFERENCE_INVALID');
      }
      if (fileStats.size > maximumBytes) throw new ReferenceImportError('FILE_TOO_LARGE');
      fileBytes = Buffer.from(await dependencies.readFile(entry.filePath));
    } catch (error) {
      if (error instanceof ReferenceImportError) throw error;
      throw new ReferenceImportError('READ_FAILED');
    }
    if (fileBytes.length < 1) throw new ReferenceImportError('REFERENCE_INVALID');
    if (fileBytes.length > maximumBytes) throw new ReferenceImportError('FILE_TOO_LARGE');
    const start = await readJsonResponse(await dependencies.fetchImpl(`${base}/start`, {
      method: 'POST',
      headers: uploadHeaders(token, 'application/json'),
      body: JSON.stringify({
        fileName,
        declaredMime,
        sizeBytes: fileBytes.length,
        fileSha256: sha256(fileBytes),
      }),
    }), 'start');
    if (
      typeof start.uploadId !== 'string'
      || !Number.isSafeInteger(start.chunkBytes)
      || start.chunkBytes < 1
      || !Number.isSafeInteger(start.totalParts)
      || start.totalParts < 1
      || start.totalParts !== Math.ceil(fileBytes.length / start.chunkBytes)
    ) throw new ReferenceImportError('UPLOAD_PLAN_INVALID');
    uploadId = start.uploadId;
    for (let partNumber = 1; partNumber <= start.totalParts; partNumber += 1) {
      const chunk = fileBytes.subarray(
        (partNumber - 1) * start.chunkBytes,
        Math.min(partNumber * start.chunkBytes, fileBytes.length),
      );
      await readJsonResponse(await dependencies.fetchImpl(`${base}/part`, {
        method: 'POST',
        headers: uploadHeaders(token, 'application/octet-stream', {
          'X-Upload-ID': uploadId,
          'X-Part-Number': String(partNumber),
          'X-Content-SHA256': sha256(chunk),
        }),
        body: chunk,
      }), `part ${partNumber}`);
    }
    const complete = await readJsonResponse(await dependencies.fetchImpl(`${base}/complete`, {
      method: 'POST',
      headers: uploadHeaders(token, 'application/json'),
      body: JSON.stringify({ uploadId }),
    }), 'complete');
    if (!ASSET_PATTERN.test(complete.assetId) || !['image', 'video', 'audio'].includes(complete.mediaKind)) {
      throw new ReferenceImportError('UPLOAD_RESULT_INVALID');
    }
    uploadId = null;
    return { fileName, assetId: complete.assetId, mediaKind: complete.mediaKind };
  } catch (error) {
    if (uploadId) {
      await dependencies.fetchImpl(`${base}/abort`, {
        method: 'POST',
        headers: uploadHeaders(token, 'application/json'),
        body: JSON.stringify({ uploadId }),
      }).catch(() => undefined);
    }
    if (error instanceof ReferenceImportError) throw error;
    throw new ReferenceImportError('UPLOAD_FAILED');
  }
}

export async function importReferenceFiles(entries, overrides = {}) {
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > MAX_FILES) {
    fail('import between 1 and 8 files');
  }
  const dependencies = {
    fetchImpl: globalThis.fetch,
    readFile,
    statFile: stat,
    ...overrides,
  };
  if (
    typeof dependencies.fetchImpl !== 'function'
    || typeof dependencies.readFile !== 'function'
    || typeof dependencies.statFile !== 'function'
  ) {
    fail('this Node.js runtime cannot perform private uploads');
  }
  const assets = [];
  const failures = [];
  for (const [index, entry] of entries.entries()) {
    try {
      assets.push({ index, ...await importOne(entry, dependencies) });
    } catch (error) {
      failures.push({
        index,
        fileName: basename(entry.filePath),
        code: error instanceof ReferenceImportError ? error.code : 'UPLOAD_FAILED',
      });
    }
  }
  return { assets, failures };
}

async function main() {
  const entries = parseReferenceImportArguments(process.argv.slice(2));
  const result = await importReferenceFiles(entries);
  const ok = result.failures.length === 0;
  process.stdout.write(`${JSON.stringify({ ok, ...result })}\n`);
  if (!ok) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'MaxVideoAI reference import failed.'}\n`);
    process.exitCode = 1;
  });
}
